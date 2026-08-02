<?php

namespace Tests\Feature\Services;

use App\Models\AuditEvent;
use App\Models\SettingValue;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\MarketplaceSettingService;
use Database\Seeders\PlatformPrimitiveSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class MarketplaceSettingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlatformPrimitiveSeeder::class);
    }

    public function test_root_admin_sets_typed_scoped_value_with_sanitized_audit(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $service = app(MarketplaceSettingService::class);
        $setting = $service->set(
            Request::create('/api/admin/settings/booking.pending_hold_minutes', 'PUT'),
            $actor,
            'booking.pending_hold_minutes',
            'site',
            'marketplace',
            45,
            '  Booking policy updated  ',
        );

        $this->assertSame(45, $setting->value);
        $this->assertNull($setting->secret_reference);
        $this->assertSame($actor->id, $setting->updated_by);

        $event = AuditEvent::query()->sole();
        $this->assertSame('settings.marketplace.updated', $event->action);
        $this->assertSame('Booking policy updated', $event->reason);
        $this->assertSame(45, $event->after['value']);
        $this->assertArrayNotHasKey('secret_reference', $event->after);
    }

    public function test_non_root_admin_invalid_value_and_disallowed_scope_are_rejected(): void
    {
        $service = app(MarketplaceSettingService::class);
        $request = Request::create('/api/admin/settings', 'PUT');

        try {
            $service->set(
                $request,
                User::factory()->admin()->create(),
                'booking.pending_hold_minutes',
                'platform',
                'marketplace',
                45,
                'Unauthorized',
            );
            $this->fail('Non-root admin setting mutation must fail.');
        } catch (AuthorizationException) {
            $this->assertDatabaseCount('audit_events', 0);
        }

        $actor = User::factory()->rootAdmin()->create();

        foreach ([
            ['booking.pending_hold_minutes', 'platform', 'marketplace', '45'],
            ['payments.default_currency', 'user', (string) $actor->public_id, 'IRR'],
            ['booking.default_timezone', 'site', 'unknown-site', 'UTC'],
        ] as [$key, $scopeType, $scopeKey, $value]) {
            try {
                $service->set($request, $actor, $key, $scopeType, $scopeKey, $value, 'Invalid request');
                $this->fail('Invalid setting mutation must fail.');
            } catch (ValidationException) {
                $this->assertDatabaseCount('audit_events', 0);
            }
        }
    }

    public function test_audit_failure_rolls_back_setting_change(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $original = SettingValue::query()
            ->whereHas('definition', fn ($query) => $query->where('key', 'booking.pending_hold_minutes'))
            ->where('scope_type', 'platform')
            ->firstOrFail();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(MarketplaceSettingService::class)->set(
                Request::create('/api/admin/settings', 'PUT'),
                $actor,
                'booking.pending_hold_minutes',
                'platform',
                'marketplace',
                30,
                'Attempt rollback',
            );
            $this->fail('Audit failure must escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertSame(60, $original->fresh()->value);
        $this->assertDatabaseCount('audit_events', 0);
    }
}
