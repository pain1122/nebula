<?php

namespace Tests\Feature\Services;

use App\Models\TenantHealthSnapshot;
use App\Models\TenantInstance;
use App\Services\TenantHeartbeatIngestor;
use App\Support\TenantHeartbeatSignature;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class TenantHeartbeatIngestorTest extends TestCase
{
    use RefreshDatabase;

    private TenantInstance $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        CarbonImmutable::setTestNow('2026-08-02 12:00:00 UTC');
        config([
            'tenant_monitoring.max_age_seconds' => 300,
            'tenant_monitoring.machine_secrets' => [
                'tenant-one-v1' => base64_encode(str_repeat("\x0b", 32)),
            ],
        ]);

        $this->tenant = TenantInstance::query()->create([
            'display_name' => 'Tenant One',
            'domain' => 'tenant-one.example.test',
        ]);
        $this->tenant->forceFill(['machine_secret_reference' => 'tenant-one-v1'])->save();
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_valid_sanitized_heartbeat_updates_health_and_versions(): void
    {
        $payload = $this->payload();
        $snapshot = $this->ingest($payload);

        $this->assertSame('healthy', $snapshot->health_status);
        $this->assertSame(['database' => 'healthy', 'queue' => 'degraded'], $snapshot->component_statuses);
        $this->assertSame(['queue_depth' => 4, 'failed_jobs_24h' => 1], $snapshot->aggregate_counters);

        $tenant = $this->tenant->fresh();
        $this->assertSame('1.4.2', $tenant->application_version);
        $this->assertSame('2026.08.02', $tenant->schema_version);
        $this->assertTrue($tenant->last_heartbeat_at->equalTo(CarbonImmutable::now()));
    }

    public function test_business_medical_and_unknown_payload_fields_are_rejected(): void
    {
        foreach (['patient_id', 'reservation', 'payment', 'questionnaire_answers', 'medical_report'] as $field) {
            try {
                $this->ingest($this->payload() + [$field => ['private' => 'data']]);
                $this->fail("Heartbeat field {$field} should be rejected.");
            } catch (ValidationException) {
                $this->assertDatabaseCount('tenant_health_snapshots', 0);
            }
        }

        $payload = $this->payload();
        $payload['aggregate_counters']['reservation_count'] = 10;

        $this->expectException(ValidationException::class);
        $this->ingest($payload);
    }

    public function test_tampering_wrong_tenant_and_missing_secret_fail_closed(): void
    {
        $payload = $this->payload();
        $signature = app(TenantHeartbeatSignature::class)->sign($payload, 'tenant-one-v1');
        $payload['health_status'] = 'degraded';

        try {
            app(TenantHeartbeatIngestor::class)->ingest($this->tenant, $payload, $signature);
            $this->fail('Tampered heartbeat should fail.');
        } catch (DomainException) {
            $this->assertDatabaseCount('tenant_health_snapshots', 0);
        }

        $wrongTenant = $this->payload();
        $wrongTenant['tenant_public_id'] = (string) Str::ulid();

        try {
            $this->ingest($wrongTenant);
            $this->fail('Mismatched tenant identity should fail.');
        } catch (DomainException) {
            $this->assertDatabaseCount('tenant_health_snapshots', 0);
        }

        $this->tenant->forceFill(['machine_secret_reference' => 'missing'])->save();

        $this->expectException(DomainException::class);
        $this->ingest($this->payload());
    }

    public function test_stale_future_and_replayed_heartbeats_are_rejected(): void
    {
        $stale = $this->payload();
        $stale['observed_at'] = CarbonImmutable::now()->subSeconds(301)->format('Y-m-d\TH:i:s\Z');

        try {
            $this->ingest($stale);
            $this->fail('Stale heartbeat should fail.');
        } catch (DomainException) {
            $this->assertDatabaseCount('tenant_health_snapshots', 0);
        }

        $future = $this->payload();
        $future['observed_at'] = CarbonImmutable::now()->addSeconds(301)->format('Y-m-d\TH:i:s\Z');

        try {
            $this->ingest($future);
            $this->fail('Future heartbeat should fail.');
        } catch (DomainException) {
            $this->assertDatabaseCount('tenant_health_snapshots', 0);
        }

        $payload = $this->payload();
        $this->ingest($payload);

        $this->expectException(DomainException::class);
        $this->ingest($payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function ingest(array $payload): TenantHealthSnapshot
    {
        $signature = app(TenantHeartbeatSignature::class)->sign($payload, 'tenant-one-v1');

        return app(TenantHeartbeatIngestor::class)->ingest($this->tenant, $payload, $signature);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'tenant_public_id' => (string) $this->tenant->public_id,
            'nonce' => (string) Str::ulid(),
            'observed_at' => CarbonImmutable::now()->format('Y-m-d\TH:i:s\Z'),
            'health_status' => 'healthy',
            'application_version' => '1.4.2',
            'schema_version' => '2026.08.02',
            'component_statuses' => ['database' => 'healthy', 'queue' => 'degraded'],
            'error_fingerprints' => ['queue.timeout:7f12ab34'],
            'aggregate_counters' => ['queue_depth' => 4, 'failed_jobs_24h' => 1],
        ];
    }
}
