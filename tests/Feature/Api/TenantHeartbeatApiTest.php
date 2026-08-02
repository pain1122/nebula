<?php

namespace Tests\Feature\Api;

use App\Models\TenantInstance;
use App\Support\TenantHeartbeatSignature;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantHeartbeatApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_signed_allowlisted_heartbeat_is_accepted_without_echoing_health_payload(): void
    {
        CarbonImmutable::setTestNow('2026-08-02 12:00:00 UTC');
        config([
            'tenant_monitoring.max_age_seconds' => 300,
            'tenant_monitoring.machine_secrets' => [
                'tenant-api-v1' => base64_encode(str_repeat("\x0b", 32)),
            ],
        ]);
        $tenant = TenantInstance::query()->create([
            'display_name' => 'Heartbeat API Tenant',
            'domain' => 'heartbeat-api.example.test',
        ]);
        $tenant->forceFill(['machine_secret_reference' => 'tenant-api-v1'])->save();
        $payload = [
            'tenant_public_id' => (string) $tenant->public_id,
            'nonce' => (string) Str::ulid(),
            'observed_at' => CarbonImmutable::now()->format('Y-m-d\TH:i:s\Z'),
            'health_status' => 'healthy',
            'application_version' => '1.0.0',
            'schema_version' => '2026.08.02',
            'component_statuses' => ['database' => 'healthy'],
            'aggregate_counters' => ['queue_depth' => 2],
        ];
        $signature = app(TenantHeartbeatSignature::class)->sign($payload, 'tenant-api-v1');

        $response = $this->withHeader('X-Tenant-Signature', $signature)
            ->postJson('/api/tenant-heartbeats/'.$tenant->public_id, $payload)
            ->assertAccepted()
            ->assertJsonPath('message', 'Heartbeat accepted.');

        $this->assertStringNotContainsString('queue_depth', $response->getContent());
        $this->assertDatabaseCount('tenant_health_snapshots', 1);

        $this->withHeader('X-Tenant-Signature', $signature)
            ->postJson('/api/tenant-heartbeats/'.$tenant->public_id, $payload + [
                'medical_report' => ['private' => true],
            ])
            ->assertUnprocessable();

        $this->withHeader('X-Tenant-Signature', 'invalid')
            ->postJson('/api/tenant-heartbeats/'.$tenant->public_id, [
                ...$payload,
                'nonce' => (string) Str::ulid(),
            ])
            ->assertUnauthorized()
            ->assertJsonPath('code', 'heartbeat_authentication_failed');

        CarbonImmutable::setTestNow();
    }
}
