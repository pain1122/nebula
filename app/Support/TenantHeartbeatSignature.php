<?php

namespace App\Support;

use JsonException;
use LogicException;

final class TenantHeartbeatSignature
{
    public const ALGORITHM = 'hmac-sha256';

    /**
     * @param  array<string, mixed>  $payload
     */
    public function sign(array $payload, string $secretReference): string
    {
        return base64_encode(hash_hmac(
            'sha256',
            $this->canonicalPayload($payload),
            $this->secret($secretReference),
            true,
        ));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function verify(array $payload, string $secretReference, string $signature): bool
    {
        try {
            $decodedSignature = base64_decode($signature, true);

            if ($decodedSignature === false || strlen($decodedSignature) !== 32) {
                return false;
            }

            $expected = hash_hmac(
                'sha256',
                $this->canonicalPayload($payload),
                $this->secret($secretReference),
                true,
            );
        } catch (JsonException|LogicException) {
            return false;
        }

        return hash_equals($expected, $decodedSignature);
    }

    /**
     * @param  array<string, mixed>  $payload
     *
     * @throws JsonException
     */
    public function canonicalPayload(array $payload): string
    {
        return json_encode([
            'schema' => 'checkupino-tenant-heartbeat-v1',
            'tenant_public_id' => $payload['tenant_public_id'] ?? null,
            'nonce' => $payload['nonce'] ?? null,
            'observed_at' => $payload['observed_at'] ?? null,
            'health_status' => $payload['health_status'] ?? null,
            'application_version' => $payload['application_version'] ?? null,
            'schema_version' => $payload['schema_version'] ?? null,
            'component_statuses' => $this->sortMap($payload['component_statuses'] ?? []),
            'error_fingerprints' => $payload['error_fingerprints'] ?? [],
            'aggregate_counters' => $this->sortMap($payload['aggregate_counters'] ?? []),
            'signature_algorithm' => self::ALGORITHM,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    private function secret(string $secretReference): string
    {
        if ($secretReference === '') {
            throw new LogicException('Tenant machine secret reference is required.');
        }

        $secrets = config('tenant_monitoring.machine_secrets', []);
        $encoded = is_array($secrets) ? ($secrets[$secretReference] ?? null) : null;

        if (! is_string($encoded) || $encoded === '') {
            throw new LogicException("Tenant machine secret reference [{$secretReference}] is not configured.");
        }

        $secret = base64_decode($encoded, true);

        if ($secret === false || strlen($secret) < 32) {
            throw new LogicException('Tenant machine secrets must be valid base64 with at least 32 decoded bytes.');
        }

        return $secret;
    }

    private function sortMap(mixed $value): mixed
    {
        if (! is_array($value) || array_is_list($value)) {
            return $value;
        }

        ksort($value, SORT_STRING);

        return $value;
    }
}
