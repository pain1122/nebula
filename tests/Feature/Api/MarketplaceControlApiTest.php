<?php

namespace Tests\Feature\Api;

use App\Models\Feature;
use App\Models\TenantInstance;
use App\Models\User;
use Database\Seeders\PlatformPrimitiveSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketplaceControlApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_admin_controls_tenant_metadata_reports_feature_and_marketplace_settings(): void
    {
        $this->seed(PlatformPrimitiveSeeder::class);
        $root = User::factory()->rootAdmin()->create();
        $tenant = TenantInstance::query()->create([
            'display_name' => 'Initial Tenant',
            'domain' => 'initial.example.test',
            'plan_key' => 'starter',
        ]);
        $reports = Feature::query()->where('key', 'tenant.reports')->sole();

        $this->statefulRoot($root)
            ->putJson('/api/admin/tenant-instances/'.$tenant->public_id, [
                'changes' => [
                    'display_name' => 'Controlled Tenant',
                    'subscription_status' => 'active',
                ],
                'reason' => 'Subscription reviewed',
            ])
            ->assertOk()
            ->assertJsonPath('data.tenant.public_id', (string) $tenant->public_id)
            ->assertJsonPath('data.tenant.subscription_status', 'active');

        $this->statefulRoot($root)
            ->putJson('/api/admin/tenant-instances/'.$tenant->public_id.'/features/'.$reports->key, [
                'enabled' => true,
                'expires_at' => now()->addMonth()->toISOString(),
                'reason' => 'Reports included in subscription',
            ])
            ->assertOk()
            ->assertJsonPath('data.feature_override.feature_key', 'tenant.reports')
            ->assertJsonPath('data.feature_override.enabled', true);

        $this->statefulRoot($root)
            ->putJson('/api/admin/settings/booking.pending_hold_minutes', [
                'scope_type' => 'platform',
                'scope_key' => 'marketplace',
                'value' => 45,
                'reason' => 'Operations-approved hold duration',
            ])
            ->assertOk()
            ->assertJsonPath('data.setting.value', 45);

        $this->assertDatabaseHas('tenant_feature_overrides', [
            'tenant_instance_id' => $tenant->id,
            'feature_id' => $reports->id,
            'enabled' => true,
        ]);
        $this->assertDatabaseCount('audit_events', 3);
    }

    public function test_control_endpoints_require_root_step_up_and_reject_operational_field_injection(): void
    {
        $tenant = TenantInstance::query()->create([
            'display_name' => 'Protected Tenant',
            'domain' => 'protected.example.test',
        ]);
        $normalAdmin = User::factory()->admin()->create();

        $this->actingAs($normalAdmin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/tenant-instances/'.$tenant->public_id, [
                'changes' => ['display_name' => 'Unauthorized'],
                'reason' => 'Unauthorized',
            ])
            ->assertForbidden();

        $root = User::factory()->rootAdmin()->create();
        $this->actingAs($root)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => 0])
            ->putJson('/api/admin/tenant-instances/'.$tenant->public_id, [
                'changes' => ['display_name' => 'Missing step-up'],
                'reason' => 'Missing step-up',
            ])
            ->assertStatus(423);

        $this->statefulRoot($root)
            ->putJson('/api/admin/tenant-instances/'.$tenant->public_id, [
                'changes' => ['application_version' => 'attacker-controlled'],
                'reason' => 'Field injection',
            ])
            ->assertUnprocessable();

        $this->assertSame('Protected Tenant', $tenant->fresh()->display_name);
        $this->assertNull($tenant->fresh()->application_version);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function statefulRoot(User $root): static
    {
        return $this->actingAs($root)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()]);
    }
}
