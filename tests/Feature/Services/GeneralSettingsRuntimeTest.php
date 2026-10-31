<?php

namespace Tests\Feature\Services;

use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use App\Services\BookingService;
use App\Services\GeneralMarketplaceRuntime;
use App\Services\SchedulingService;
use App\Services\SettingsRegistry;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class GeneralSettingsRuntimeTest extends TestCase
{
    use IsolatedProfileApplication, RefreshDatabase;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated general settings runtime acceptance only.');
        }
        parent::setUp();
    }

    private function value(string $key, mixed $value, string $scope = 'platform'): SettingValue
    {
        $rule = app(SettingsRegistry::class)->definition('marketplace', $key);
        $definition = SettingDefinition::firstOrCreate(['key' => $key], ['group' => $rule['group'], 'value_type' => $rule['value_type'],
            'default_value' => $rule['default'], 'validation_rules' => $rule['validation_rules'], 'sensitivity' => $rule['sensitivity'],
            'allowed_scopes' => $rule['allowed_scopes'], 'description' => $rule['description']]);

        return SettingValue::updateOrCreate(['setting_definition_id' => $definition->id, 'scope_type' => $scope, 'scope_key' => 'marketplace'], ['value' => $value]);
    }

    public function test_no_override_preserves_operator_hold_and_registry_fallbacks_without_provisioning(): void
    {
        config(['payments.hold_minutes' => 75]);
        $runtime = app(GeneralMarketplaceRuntime::class);
        $this->assertSame(75, $runtime->holdMinutes());
        $this->assertSame('Asia/Tehran', $runtime->timezone(null));
        $this->assertSame('IRR', $runtime->currency(null));
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_site_then_platform_override_explicit_values_and_uncached_reset_behavior(): void
    {
        $runtime = app(GeneralMarketplaceRuntime::class);
        foreach (['booking.pending_hold_minutes' => [30, 15], 'booking.default_timezone' => ['UTC', 'Europe/Berlin'], 'payments.default_currency' => ['USD', 'EUR']] as $key => [$platform, $site]) {
            $this->value($key, $platform);
            $this->value($key, $site, 'site');
        }
        $this->assertSame(15, $runtime->holdMinutes());
        $this->assertSame('Europe/Berlin', $runtime->timezone(''));
        $this->assertSame('EUR', $runtime->currency(''));
        $this->assertSame('Asia/Tehran', $runtime->timezone('Asia/Tehran'));
        $this->assertSame('IRR', $runtime->currency('IRR'));
        SettingValue::where('scope_type', 'site')->delete();
        $this->assertSame(30, $runtime->holdMinutes());
        $this->assertSame('UTC', $runtime->timezone(null));
        $this->assertSame('USD', $runtime->currency(null));
    }

    public function test_unrelated_corrupt_currency_does_not_block_hold_or_explicit_currency(): void
    {
        $this->value('payments.default_currency', '12#');
        $runtime = app(GeneralMarketplaceRuntime::class);
        $this->assertSame(60, $runtime->holdMinutes());
        $this->assertSame('IRR', $runtime->currency('IRR'));
        $this->assertSame('UTC', $runtime->timezone('UTC'));
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        $runtime->currency(null);
    }

    public function test_invalid_explicit_currency_is_refused_instead_of_relabelled(): void
    {
        $this->value('payments.default_currency', 'EUR');
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(GeneralMarketplaceRuntime::class)->currency('12#');
    }

    public function test_invalid_explicit_timezone_is_refused_instead_of_reinterpreted(): void
    {
        $this->value('booking.default_timezone', 'UTC');
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(GeneralMarketplaceRuntime::class)->timezone('Mars/Unknown');
    }

    public function test_new_booking_uses_hold_override_but_retains_saved_money_timezone_and_idempotent_history(): void
    {
        Carbon::setTestNow('2026-10-16 10:00:00 UTC');
        try {
            $slot = DoctorVisitSlot::factory()->create(['price' => 1234567, 'currency' => 'IRR']);
            $slot->workplace->hospital->forceFill(['timezone' => 'Asia/Tehran'])->save();
            $patient = User::factory()->create();
            $this->value('booking.pending_hold_minutes', 15, 'site');
            $this->value('booking.default_timezone', 'Europe/Berlin');
            $this->value('payments.default_currency', 'EUR');
            [$reservation, $payment] = app(BookingService::class)->createReservation($patient, $slot->public_id, 'synthetic-general-defaults');
            $this->assertTrue(now()->addMinutes(15)->equalTo($reservation->hold_expires_at));
            $this->assertSame('Asia/Tehran', $reservation->timezone);
            $this->assertSame(1234567, $reservation->price_snapshot);
            $this->assertSame('IRR', $reservation->currency_snapshot);
            $this->assertSame(1234567, $payment->amount);
            $this->assertSame('IRR', $payment->currency);
            $before = $reservation->fresh()->getAttributes();
            $paymentBefore = $payment->fresh()->getAttributes();
            $this->value('booking.pending_hold_minutes', 45, 'site');
            [$replayed, $replayedPayment] = app(BookingService::class)->createReservation($patient, $slot->public_id, 'synthetic-general-defaults');
            $this->assertSame($before, $replayed->getAttributes());
            $this->assertSame($paymentBefore, $replayedPayment->getAttributes());
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_scheduling_preserves_explicit_rule_and_manual_occurrence_prices_across_default_changes(): void
    {
        $rule = DoctorWorkingWindow::factory()->create(['weekday' => 0, 'starts_at' => '09:00:00', 'ends_at' => '10:00:00',
            'visit_duration_minutes' => 30, 'price_override' => 7000, 'currency_override' => 'IRR']);
        $rule->workplace->hospital->forceFill(['timezone' => 'Asia/Tehran'])->save();
        $this->value('booking.default_timezone', 'Europe/Berlin');
        $this->value('payments.default_currency', 'EUR');
        $scheduler = app(SchedulingService::class);
        $date = Carbon::parse('2026-10-18');
        $this->assertSame(2, $scheduler->materializeRule($rule->fresh(), $date, $date));
        $slots = DoctorVisitSlot::orderBy('starts_at')->get();
        $this->assertSame('2026-10-18 05:30:00', $slots[0]->starts_at->utc()->format('Y-m-d H:i:s'));
        $this->assertSame(7000, $slots[0]->price);
        $this->assertSame('IRR', $slots[0]->currency);
        $slots[0]->forceFill(['price' => 8000, 'is_active' => false])->save();
        $before = DoctorVisitSlot::orderBy('id')->get()->map->getAttributes()->all();
        $this->value('payments.default_currency', 'USD');
        $this->value('booking.default_timezone', 'UTC');
        $this->assertSame(0, $scheduler->materializeRule($rule->fresh(), $date, $date));
        $this->assertSame($before, DoctorVisitSlot::orderBy('id')->get()->map->getAttributes()->all());
    }

    public function test_new_schedule_uses_defaults_only_for_missing_source_values(): void
    {
        $rule = DoctorWorkingWindow::factory()->create(['weekday' => 0, 'starts_at' => '09:00:00', 'ends_at' => '09:30:00', 'visit_duration_minutes' => 30]);
        $rule->workplace->hospital->forceFill(['timezone' => ''])->save();
        $rule->checkup->forceFill(['currency' => ''])->save();
        $this->value('booking.default_timezone', 'UTC', 'site');
        $this->value('payments.default_currency', 'EUR', 'site');
        $date = Carbon::parse('2026-10-18');
        $this->assertSame(1, app(SchedulingService::class)->materializeRule($rule->fresh(), $date, $date));
        $slot = DoctorVisitSlot::sole();
        $this->assertSame('2026-10-18 09:00:00', $slot->starts_at->utc()->format('Y-m-d H:i:s'));
        $this->assertSame('EUR', $slot->currency);
    }
}
