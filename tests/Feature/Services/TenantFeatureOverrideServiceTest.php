<?php

namespace Tests\Feature\Services;

use App\Models\AuditEvent;
use App\Models\Feature;
use App\Models\TenantInstance;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OutboxPublisher;
use App\Services\TenantFeatureOverrideService;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class TenantFeatureOverrideServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_admin_sets_and_replaces_feature_override_with_audit(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();
        $feature = $this->feature('tenant.reports');
        $service = app(TenantFeatureOverrideService::class);

        $created = $service->set(
            $this->requestFor($tenant),
            $actor,
            $tenant,
            $feature,
            true,
            '  Reports added to contract  ',
            CarbonImmutable::now()->addMonth(),
        );
        $updated = $service->set(
            $this->requestFor($tenant),
            $actor,
            $tenant,
            $feature,
            false,
            'Reports removed from contract',
        );

        $this->assertSame($created->id, $updated->id);
        $this->assertFalse($updated->enabled);
        $this->assertSame($actor->id, $updated->actor_id);
        $this->assertSame('Reports removed from contract', $updated->reason);
        $this->assertNull($updated->expires_at);
        $this->assertDatabaseCount('tenant_feature_overrides', 1);

        $events = AuditEvent::query()->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertSame('tenant.feature_override.set', $events->last()->action);
        $this->assertSame('tenant.reports', $events->last()->after['feature_key']);
        $this->assertTrue($events->last()->before['enabled']);
        $this->assertFalse($events->last()->after['enabled']);

        $outboxEvents = DB::table('outbox_events')->orderBy('id')->get();
        $this->assertCount(2, $outboxEvents);
        $this->assertSame('tenant.entitlement.changed', $outboxEvents->last()->event_type);
        $payload = json_decode($outboxEvents->last()->payload, true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame((string) $tenant->public_id, $payload['tenant_public_id']);
        $this->assertSame('tenant.reports', $payload['feature_key']);
        $this->assertFalse($payload['enabled']);
        $this->assertNull($payload['expires_at']);
    }

    public function test_non_root_admin_is_denied(): void
    {
        $this->expectException(AuthorizationException::class);

        app(TenantFeatureOverrideService::class)->set(
            $this->requestFor($tenant = $this->tenant()),
            User::factory()->admin()->create(),
            $tenant,
            $this->feature('tenant.reports'),
            true,
            'Unauthorized attempt',
        );
    }

    public function test_inactive_feature_and_non_future_expiry_are_rejected(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();
        $inactiveFeature = $this->feature('tenant.legacy', false);

        try {
            app(TenantFeatureOverrideService::class)->set(
                $this->requestFor($tenant),
                $actor,
                $tenant,
                $inactiveFeature,
                true,
                'Invalid inactive feature',
            );

            $this->fail('Inactive feature assignment must fail.');
        } catch (DomainException) {
            $this->assertDatabaseCount('tenant_feature_overrides', 0);
        }

        $this->expectException(InvalidArgumentException::class);

        app(TenantFeatureOverrideService::class)->set(
            $this->requestFor($tenant),
            $actor,
            $tenant,
            $this->feature('tenant.reports'),
            true,
            'Expired override',
            CarbonImmutable::now()->subSecond(),
        );
    }

    public function test_audit_failure_rolls_back_feature_override(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(TenantFeatureOverrideService::class)->set(
                $this->requestFor($tenant),
                $actor,
                $tenant,
                $this->feature('tenant.reports'),
                true,
                'Contract change',
            );

            $this->fail('Audit failure must escape the feature transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertDatabaseCount('tenant_feature_overrides', 0);
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_outbox_failure_rolls_back_feature_override_and_audit(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();

        $this->mock(OutboxPublisher::class, function (MockInterface $mock): void {
            $mock->shouldReceive('marketplace')->once()->andThrow(new RuntimeException('outbox failed'));
        });

        try {
            app(TenantFeatureOverrideService::class)->set(
                $this->requestFor($tenant),
                $actor,
                $tenant,
                $this->feature('tenant.reports'),
                true,
                'Contract change',
            );

            $this->fail('Outbox failure must escape the feature transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('outbox failed', $exception->getMessage());
        }

        $this->assertDatabaseCount('tenant_feature_overrides', 0);
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    private function tenant(): TenantInstance
    {
        return TenantInstance::query()->create([
            'display_name' => 'Tenant One',
            'domain' => 'tenant-one.example.test',
        ]);
    }

    private function feature(string $key, bool $active = true): Feature
    {
        $feature = Feature::query()->create([
            'key' => $key,
            'name' => $key,
        ]);

        $feature->forceFill(['is_active' => $active])->save();

        return $feature->fresh();
    }

    private function requestFor(TenantInstance $tenant): Request
    {
        return Request::create('/api/admin/tenants/'.$tenant->public_id.'/features', 'PUT');
    }
}
