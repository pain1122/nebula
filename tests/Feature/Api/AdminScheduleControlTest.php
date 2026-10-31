<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\Checkup;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\Reservation;
use App\Models\ReservationScheduleChange;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminScheduleControlTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Isolated schedule-control acceptance only.');
        }
        parent::setUp();
        $this->travelTo(now()->setDate(2026, 10, 15)->setTime(10, 0));
    }

    private function actor(string $role = 'admin'): User
    {
        $actor = User::factory()->create();
        $actor->syncRoles([$role]);
        $this->actingAs($actor)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000'])->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function graph(string $timezone = 'Asia/Tehran'): array
    {
        $rule = DoctorWorkingWindow::factory()->create(['weekday' => 0, 'starts_at' => '08:00:00', 'ends_at' => '12:00:00', 'visit_duration_minutes' => 30]);
        $workplace = $rule->workplace;
        $workplace->hospital->forceFill(['timezone' => $timezone])->save();
        $workplace->doctorProfile->forceFill(['verified' => true])->save();
        $workplace->doctorProfile->user->syncRoles(['doctor']);
        $rule->checkup->forceFill(['is_active' => true])->save();
        $workplace->checkups()->syncWithoutDetaching([$rule->checkup_id => ['is_active' => true]]);
        $slots = collect(['2026-10-18 05:00:00', '2026-10-18 05:30:00', '2026-10-19 05:00:00', '2026-10-26 05:00:00'])->map(fn ($start) => DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => $start, 'ends_at' => \Carbon\Carbon::parse($start)->addMinutes(30), 'price' => 1000, 'currency' => 'IRR']));

        return [$workplace, $rule, $slots];
    }

    private function path($workplace): string
    {
        return '/api/admin/schedules/workplaces/'.$workplace->id.'/slot-control';
    }

    private function selection($rule, string $scope = 'day', ?DoctorVisitSlot $slot = null): array
    {
        return ['checkup_id' => $rule->checkup_id, 'scope' => $scope, 'date' => '2026-10-18'] + ($slot ? ['slot_public_id' => $slot->public_id] : []);
    }

    private function preview($workplace, array $selection): array
    {
        return $this->getJson($this->path($workplace).'?'.http_build_query($selection))->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data');
    }

    private function body($workplace, array $selection, array $changes = ['price' => '1234567']): array
    {
        $preview = $this->preview($workplace, $selection);

        return $selection + $changes + ['expected_revision' => $preview['revision'], 'preview_expires_at' => $preview['preview_expires_at'], 'reason' => 'Synthetic schedule acceptance.', 'confirmed' => true];
    }

    public function test_individual_price_and_enabled_change_preserves_other_slots_times_currency_and_default(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $admin = $this->actor();
        $slot = $slots[0];
        $before = $slot->only(['starts_at', 'ends_at', 'currency', 'doctor_working_window_id', 'doctor_workplace_id', 'checkup_id']);
        $body = $this->body($workplace, $this->selection($rule, 'slot', $slot), ['price' => '9007199254740991', 'is_active' => false]);
        $this->putJson($this->path($workplace), $body)->assertOk()->assertJsonPath('data.changed_slot_public_ids', [$slot->public_id]);
        $this->assertSame(9007199254740991, $slot->fresh()->price);
        $this->assertFalse($slot->fresh()->is_active);
        $this->assertEquals($before, $slot->fresh()->only(array_keys($before)));
        foreach ($slots->skip(1) as $other) {
            $this->assertSame(1000, $other->fresh()->price);
            $this->assertTrue($other->fresh()->is_active);
        }
        $this->assertNull($rule->fresh()->price_override);
        $audit = AuditEvent::sole();
        $this->assertSame($admin->id, $audit->actor_user_id);
        $this->assertSame('admin.visit_slots.controlled', $audit->action);
        $this->assertSame('9007199254740991', $audit->after['slots'][0]['price']);
        $this->assertSame('1000', $audit->before['slots'][0]['price']);
        $this->getJson('/api/admin/activity?category=schedule')->assertOk()->assertJsonPath('data.0.action', 'admin.visit_slots.controlled');
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_day_and_iso_week_scope_change_only_exact_workplace_service_and_week(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $this->actor('root-admin');
        $this->putJson($this->path($workplace), $this->body($workplace, $this->selection($rule), ['is_active' => false]))->assertOk()->assertJsonCount(2, 'data.changed_slot_public_ids');
        $this->assertFalse($slots[0]->fresh()->is_active);
        $this->assertTrue($slots[2]->fresh()->is_active);
        $selection = array_replace($this->selection($rule, 'week'), ['date' => '2026-10-20']);
        $preview = $this->preview($workplace, $selection);
        $this->assertSame(['from' => '2026-10-19', 'to' => '2026-10-25', 'timezone' => 'Asia/Tehran'], $preview['period']);
        $this->putJson($this->path($workplace), $this->body($workplace, $selection))->assertOk()->assertJsonPath('data.changed_slot_public_ids', [$slots[2]->public_id]);
        $this->assertSame(1000, $slots[3]->fresh()->price);
    }

    public function test_reserved_and_rescheduled_away_history_are_excluded_without_leaking_patient_or_payment_facts(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $reservation = Reservation::factory()->create(['doctor_visit_slot_id' => $slots[2]->id, 'status' => 'cancelled']);
        ReservationScheduleChange::create(['reservation_id' => $reservation->id, 'actor_id' => $workplace->doctorProfile->user_id,
            'previous_doctor_visit_slot_id' => $slots[0]->id, 'new_doctor_visit_slot_id' => $slots[2]->id,
            'previous_doctor_workplace_id' => $workplace->id, 'new_doctor_workplace_id' => $workplace->id,
            'previous_starts_at' => $slots[0]->starts_at, 'previous_ends_at' => $slots[0]->ends_at, 'previous_duration_minutes' => 30,
            'new_starts_at' => $slots[2]->starts_at, 'new_ends_at' => $slots[2]->ends_at, 'new_duration_minutes' => 30, 'reason' => 'Synthetic move.']);
        $this->actor();
        $preview = $this->preview($workplace, $this->selection($rule));
        $this->assertFalse($preview['items'][0]['eligible']);
        $this->assertSame(['reservation_history'], $preview['items'][0]['exclusions']);
        $this->assertStringNotContainsString($reservation->user->email, json_encode($preview));
        $this->assertStringNotContainsString($reservation->public_id, json_encode($preview));
        $before = $reservation->fresh()->getAttributes();
        $this->putJson($this->path($workplace), $this->body($workplace, $this->selection($rule)))->assertOk()->assertJsonPath('data.changed_slot_public_ids', [$slots[1]->public_id]);
        $this->assertSame(1000, $slots[0]->fresh()->price);
        $this->assertSame($before, $reservation->fresh()->getAttributes());
        $this->getJson('/api/admin/schedules/workplaces/'.$workplace->id.'/slots?from=2026-10-18&to=2026-10-18&history=with')->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.public_id', $slots[0]->public_id)->assertJsonPath('data.0.has_reservation_history', true);
    }

    public function test_new_booking_after_preview_conflicts_and_preserves_every_slot(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $this->actor();
        $body = $this->body($workplace, $this->selection($rule));
        Reservation::factory()->create(['doctor_visit_slot_id' => $slots[0]->id, 'status' => 'pending', 'hold_expires_at' => now()->addHour()]);
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $this->assertTrue($slots->every(fn ($slot) => $slot->fresh()->price === 1000));
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_conflicts_at_other_workplace_past_and_inactive_rule_are_explicit_exclusions(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        Reservation::factory()->create(['doctor_profile_id' => $workplace->doctor_profile_id, 'starts_at' => $slots[0]->starts_at, 'ends_at' => $slots[0]->ends_at, 'status' => 'confirmed']);
        $this->actor();
        $preview = $this->preview($workplace, $this->selection($rule));
        $this->assertSame(['blocking_reservation'], $preview['items'][0]['exclusions']);
        $this->travelTo(now()->setDate(2026, 10, 19));
        $rule->forceFill(['is_active' => false])->save();
        $preview = $this->preview($workplace, $this->selection($rule));
        $this->assertContains('past', $preview['items'][0]['exclusions']);
        $this->assertContains('rule_unavailable', $preview['items'][0]['exclusions']);
        $this->assertSame(0, $preview['eligible_count']);
        $this->putJson($this->path($workplace), $this->body($workplace, $this->selection($rule)))->assertConflict();
    }

    public function test_revision_binds_actor_selection_eligibility_values_and_expiry(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $admin = $this->actor();
        $body = $this->body($workplace, $this->selection($rule));
        $this->actor('root-admin');
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $this->actingAs($admin);
        $this->putJson($this->path($workplace), array_replace($body, ['scope' => 'week']))->assertConflict();
        $slots[1]->forceFill(['price' => 123])->save();
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $body = $this->body($workplace, $this->selection($rule));
        $this->travel(301)->seconds();
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_strict_input_password_confirmation_reason_and_safe_price_boundaries(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $this->actor();
        $body = $this->body($workplace, $this->selection($rule));
        $this->withSession(['auth.password_confirmed_at' => 0])->putJson($this->path($workplace), $body)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        foreach (['confirmed' => false, 'reason' => ' ', 'price' => '-1', 'expected_revision' => 'bad', 'preview_expires_at' => null, 'scope' => 'month', 'date' => '2026-02-30'] as $key => $value) {
            $this->putJson($this->path($workplace), array_replace($body, [$key => $value]))->assertUnprocessable();
        }
        $this->travel(61)->seconds();
        foreach (['currency' => 'USD', 'starts_at' => '2026-11-01', 'actor_id' => 1] as $key => $value) {
            $this->putJson($this->path($workplace), $body + [$key => $value])->assertUnprocessable();
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_audit_failure_rolls_back_every_target_and_noop_does_not_write_audit(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $this->actor();
        $this->putJson($this->path($workplace), $this->body($workplace, $this->selection($rule), ['price' => '1000']))->assertUnprocessable();
        $body = $this->body($workplace, $this->selection($rule));
        $this->mock(AuditLogger::class, function ($mock) {
            $mock->shouldReceive('log')->once()->andThrow(new \RuntimeException('Synthetic audit failure.'));
        });
        $this->putJson($this->path($workplace), $body)->assertStatus(500);
        $this->assertTrue($slots->every(fn ($slot) => $slot->fresh()->price === 1000));
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_non_admin_and_privileged_doctor_owner_refuse(): void
    {
        [$workplace, $rule] = $this->graph();
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($role);
            $this->getJson($this->path($workplace).'?'.http_build_query($this->selection($rule)))->assertForbidden();
            $this->putJson($this->path($workplace), [])->assertForbidden();
        }
        $workplace->doctorProfile->user->syncRoles(['doctor', 'root-admin']);
        $this->actor();
        $this->getJson($this->path($workplace).'?'.http_build_query($this->selection($rule)))->assertNotFound();
    }

    public function test_cached_role_revocation_and_transaction_revocation_fail_closed(): void
    {
        [$workplace, $rule] = $this->graph();
        $actor = $this->actor();
        $body = $this->body($workplace, $this->selection($rule));
        $actor->load('roles');
        User::findOrFail($actor->id)->syncRoles(['patient']);
        $this->putJson($this->path($workplace), $body)->assertForbidden();
        $actor->syncRoles(['admin']);
        $state = (object) ['changed' => false];
        DB::listen(function ($query) use ($actor, $state) {
            if (! $state->changed && str_starts_with(strtolower($query->sql), 'update "doctor_visit_slots"')) {
                $state->changed = true;
                User::findOrFail($actor->id)->syncRoles(['patient']);
            }
        });
        $this->putJson($this->path($workplace), $body)->assertForbidden();
        $this->assertTrue($state->changed);
        $this->assertSame([1000], DoctorVisitSlot::pluck('price')->unique()->values()->all());
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_offering_change_new_target_and_authority_change_invalidate_preview(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $actor = $this->actor();
        $body = $this->body($workplace, $this->selection($rule));
        $workplace->checkups()->updateExistingPivot($rule->checkup_id, ['is_active' => false]);
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $this->assertSame(0, $this->preview($workplace, $this->selection($rule))['eligible_count']);
        $workplace->checkups()->updateExistingPivot($rule->checkup_id, ['is_active' => true]);
        $body = $this->body($workplace, $this->selection($rule));
        DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-18 06:00:00', 'ends_at' => '2026-10-18 06:30:00']);
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $body = $this->body($workplace, $this->selection($rule));
        $actor->syncRoles(['root-admin']);
        $this->putJson($this->path($workplace), $body)->assertConflict();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_price_zero_is_exact_and_mixed_currency_bulk_prices_refuse(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        // Currencies are immutable after creation; create a distinct dated occurrence.
        DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-18 06:00:00', 'ends_at' => '2026-10-18 06:30:00', 'currency' => 'USD']);
        $this->actor();
        $this->putJson($this->path($workplace), $this->body($workplace, $this->selection($rule)))->assertUnprocessable();
        $this->putJson($this->path($workplace), $this->body($workplace, $this->selection($rule, 'slot', $slots[0]), ['price' => '0']))->assertOk();
        $this->assertSame(0, $slots[0]->fresh()->price);
        $this->assertSame('IRR', $slots[0]->fresh()->currency);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_slot_binding_local_date_and_strict_preview_queries_refuse(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $this->getJson($this->path($workplace))->assertUnauthorized();
        $this->putJson($this->path($workplace), [])->assertUnauthorized();
        $this->actor();
        $selected = $this->selection($rule, 'slot', $slots[0]);
        foreach ([array_replace($selected, ['date' => '2026-10-19']), $selected + ['include' => 'users'], array_replace($selected, ['slot_public_id' => 'invalid'])] as $selection) {
            $this->getJson($this->path($workplace).'?'.http_build_query($selection))->assertUnprocessable();
        }
        $this->getJson($this->path($workplace).'?'.http_build_query(array_replace($selected, ['checkup_id' => Checkup::factory()->create()->id])))->assertNotFound();
        $preview = $this->preview($workplace, $selected);
        $this->assertSame($preview['revision'], $this->preview($workplace, $selected + ['preview_expires_at' => $preview['preview_expires_at']])['revision']);
        $this->assertArrayNotHasKey('internal', $preview);
    }

    public function test_bounded_preview_refuses_overflow_and_local_dst_day_uses_exclusive_next_midnight(): void
    {
        [$workplace, $rule] = $this->graph('Europe/Berlin');
        DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-24 22:00:00', 'ends_at' => '2026-10-24 22:30:00']);
        DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-25 22:30:00', 'ends_at' => '2026-10-25 23:00:00']);
        DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-25 23:00:00', 'ends_at' => '2026-10-25 23:30:00']);
        $this->actor();
        $preview = $this->preview($workplace, array_replace($this->selection($rule), ['date' => '2026-10-25']));
        $this->assertCount(2, $preview['items']);
        $this->assertStringEndsWith('+02:00', $preview['items'][0]['starts_at']);
        $this->assertStringEndsWith('+01:00', $preview['items'][1]['starts_at']);
        for ($index = 0; $index < 249; $index++) {
            $start = \Carbon\Carbon::parse('2026-10-18 00:00:00')->addMinutes($index);
            DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => $start, 'ends_at' => $start->copy()->addMinutes(30)]);
        }
        $this->getJson($this->path($workplace).'?'.http_build_query($this->selection($rule)))->assertStatus(503);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_same_second_price_round_trip_does_not_revive_an_old_revision(): void
    {
        [$workplace, $rule, $slots] = $this->graph();
        $this->actor();
        $selection = $this->selection($rule, 'slot', $slots[0]);
        $old = $this->body($workplace, $selection, ['price' => '3000']);
        $this->putJson($this->path($workplace), $this->body($workplace, $selection, ['price' => '2000']))->assertOk();
        $this->putJson($this->path($workplace), $this->body($workplace, $selection, ['price' => '1000']))->assertOk();
        $this->putJson($this->path($workplace), $old)->assertConflict();
        $this->assertSame(1000, $slots[0]->fresh()->price);
        $this->assertDatabaseCount('audit_events', 2);
    }
}
