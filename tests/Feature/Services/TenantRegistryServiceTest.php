<?php

namespace Tests\Feature\Services;

use App\Models\AuditEvent;
use App\Models\TenantInstance;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TenantRegistryService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class TenantRegistryServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_admin_updates_allowlisted_registry_metadata_with_audit(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();

        $updated = app(TenantRegistryService::class)->update(
            $this->requestFor($tenant),
            $actor,
            $tenant,
            [
                'state' => 'disabled',
                'plan_key' => 'clinic-pro',
                'subscription_status' => 'active',
                'feature_set_version' => 'features-v2',
            ],
            '  Contract updated  ',
        );

        $this->assertSame('disabled', $updated->state);
        $this->assertSame('clinic-pro', $updated->plan_key);
        $this->assertSame('active', $updated->subscription_status);
        $this->assertSame('features-v2', $updated->feature_set_version);

        $event = AuditEvent::query()->sole();
        $this->assertSame('tenant.registry.updated', $event->action);
        $this->assertSame('Contract updated', $event->reason);
        $this->assertSame('active', $event->before['state']);
        $this->assertSame('disabled', $event->after['state']);
        $this->assertArrayNotHasKey('machine_secret_reference', $event->after);
    }

    public function test_non_root_admin_is_denied(): void
    {
        $this->expectException(AuthorizationException::class);

        app(TenantRegistryService::class)->update(
            $this->requestFor($tenant = $this->tenant()),
            User::factory()->admin()->create(),
            $tenant,
            ['plan_key' => 'clinic-pro'],
            'Attempted plan change',
        );
    }

    public function test_operational_or_secret_fields_and_invalid_states_are_rejected(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();

        try {
            app(TenantRegistryService::class)->update(
                $this->requestFor($tenant),
                $actor,
                $tenant,
                ['machine_secret_reference' => 'plaintext-secret'],
                'Unsafe request',
            );

            $this->fail('Secret fields must not be accepted by registry mutation.');
        } catch (ValidationException) {
            $this->assertNull($tenant->fresh()->machine_secret_reference);
        }

        $this->expectException(ValidationException::class);

        app(TenantRegistryService::class)->update(
            $this->requestFor($tenant),
            $actor,
            $tenant,
            ['state' => 'cross_tenant_access'],
            'Invalid state',
        );
    }

    public function test_audit_failure_rolls_back_registry_change(): void
    {
        $actor = User::factory()->rootAdmin()->create();
        $tenant = $this->tenant();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(TenantRegistryService::class)->update(
                $this->requestFor($tenant),
                $actor,
                $tenant,
                ['subscription_status' => 'suspended'],
                'Risk review',
            );

            $this->fail('Audit failure must escape the registry transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertNull($tenant->fresh()->subscription_status);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function tenant(): TenantInstance
    {
        return TenantInstance::query()->create([
            'display_name' => 'Tenant One',
            'domain' => 'tenant-one.example.test',
        ]);
    }

    private function requestFor(TenantInstance $tenant): Request
    {
        return Request::create('/api/admin/tenants/'.$tenant->public_id, 'PUT');
    }
}
