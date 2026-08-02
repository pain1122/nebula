<?php

namespace Tests\Unit\Support;

use App\Support\TenantHeartbeatSignature;
use Tests\TestCase;

class TenantHeartbeatSignatureTest extends TestCase
{
    public function test_signature_is_bound_to_tenant_timestamp_nonce_and_sanitized_payload(): void
    {
        config([
            'tenant_monitoring.machine_secrets' => [
                'tenant-one-v1' => base64_encode(str_repeat("\x08", 32)),
            ],
        ]);
        $payload = $this->payload();
        $signer = app(TenantHeartbeatSignature::class);
        $signature = $signer->sign($payload, 'tenant-one-v1');

        $this->assertTrue($signer->verify($payload, 'tenant-one-v1', $signature));
        $this->assertFalse($signer->verify(
            array_replace($payload, ['tenant_public_id' => 'another-tenant']),
            'tenant-one-v1',
            $signature,
        ));
        $this->assertFalse($signer->verify(
            array_replace($payload, ['nonce' => 'another-nonce']),
            'tenant-one-v1',
            $signature,
        ));
    }

    public function test_unknown_short_or_rotated_secret_fails_closed(): void
    {
        config([
            'tenant_monitoring.machine_secrets' => [
                'old' => base64_encode(str_repeat("\x09", 32)),
                'short' => base64_encode('short'),
            ],
        ]);
        $signer = app(TenantHeartbeatSignature::class);
        $signature = $signer->sign($this->payload(), 'old');

        $this->assertFalse($signer->verify($this->payload(), 'missing', $signature));
        $this->assertFalse($signer->verify($this->payload(), 'short', $signature));

        config([
            'tenant_monitoring.machine_secrets.old' => base64_encode(str_repeat("\x0a", 32)),
        ]);

        $this->assertFalse($signer->verify($this->payload(), 'old', $signature));
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'tenant_public_id' => '01K1TENANTPUBLICID000000000',
            'nonce' => '01K1HEARTBEATNONCE000000000',
            'observed_at' => '2026-08-02T12:00:00Z',
            'health_status' => 'healthy',
            'application_version' => '1.0.0',
            'schema_version' => '2026-08-02',
            'component_statuses' => ['queue' => 'healthy', 'database' => 'healthy'],
            'error_fingerprints' => [],
            'aggregate_counters' => ['queue_depth' => 0],
        ];
    }
}
