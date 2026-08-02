<?php

namespace App\Services;

use App\Models\TenantHealthSnapshot;
use App\Models\TenantInstance;
use App\Support\TenantHeartbeatSignature;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TenantHeartbeatIngestor
{
    private const TOP_LEVEL_FIELDS = [
        'tenant_public_id',
        'nonce',
        'observed_at',
        'health_status',
        'application_version',
        'schema_version',
        'component_statuses',
        'error_fingerprints',
        'aggregate_counters',
    ];

    private const COMPONENTS = [
        'database',
        'cache',
        'queue',
        'scheduler',
        'storage',
        'email',
        'sms',
        'push',
        'payment_provider',
        'backup',
    ];

    private const AGGREGATE_COUNTERS = [
        'queue_depth',
        'failed_jobs_24h',
        'storage_usage_bytes',
        'http_5xx_15m',
        'uptime_seconds',
        'backup_age_seconds',
        'scheduler_lag_seconds',
    ];

    public function __construct(
        private readonly TenantHeartbeatSignature $signature,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function ingest(
        TenantInstance $tenantInstance,
        array $payload,
        string $signature,
    ): TenantHealthSnapshot {
        $unknownFields = array_diff(array_keys($payload), self::TOP_LEVEL_FIELDS);

        if ($unknownFields !== []) {
            throw ValidationException::withMessages([
                'payload' => 'Unsupported heartbeat fields: '.implode(', ', $unknownFields).'.',
            ]);
        }

        $validated = Validator::make($payload, [
            'tenant_public_id' => ['required', 'string', 'size:26'],
            'nonce' => ['required', 'ulid'],
            'observed_at' => ['required', 'date_format:Y-m-d\TH:i:s\Z'],
            'health_status' => ['required', Rule::in(['healthy', 'degraded', 'unavailable'])],
            'application_version' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9][A-Za-z0-9._+\/-]*$/'],
            'schema_version' => ['required', 'string', 'max:100', 'regex:/^[A-Za-z0-9][A-Za-z0-9._+\/-]*$/'],
            'component_statuses' => ['sometimes', 'array:'.implode(',', self::COMPONENTS)],
            'component_statuses.*' => [Rule::in(['healthy', 'degraded', 'unavailable', 'unknown'])],
            'error_fingerprints' => ['sometimes', 'array', 'max:20'],
            'error_fingerprints.*' => ['string', 'max:128', 'distinct', 'regex:/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/'],
            'aggregate_counters' => ['sometimes', 'array:'.implode(',', self::AGGREGATE_COUNTERS)],
            'aggregate_counters.*' => ['integer', 'min:0'],
        ])->validate();

        $validated['component_statuses'] ??= [];
        $validated['error_fingerprints'] ??= [];
        $validated['aggregate_counters'] ??= [];

        if (! hash_equals((string) $tenantInstance->public_id, $validated['tenant_public_id'])) {
            throw new DomainException('Heartbeat tenant identity does not match the target tenant.');
        }

        $observedAt = CarbonImmutable::createFromFormat('Y-m-d\TH:i:s\Z', $validated['observed_at'], 'UTC');
        $maxAge = config('tenant_monitoring.max_age_seconds');

        if (! is_int($maxAge) || $maxAge < 1) {
            throw new DomainException('Tenant monitoring freshness configuration is invalid.');
        }

        $now = CarbonImmutable::now('UTC');

        if ($observedAt->isBefore($now->subSeconds($maxAge)) || $observedAt->isAfter($now->addSeconds($maxAge))) {
            throw new DomainException('Heartbeat timestamp is outside the accepted freshness window.');
        }

        return DB::transaction(function () use ($tenantInstance, $validated, $signature, $observedAt): TenantHealthSnapshot {
            $lockedTenant = TenantInstance::query()->lockForUpdate()->findOrFail($tenantInstance->getKey());

            if (! is_string($lockedTenant->machine_secret_reference)
                || ! $this->signature->verify($validated, $lockedTenant->machine_secret_reference, $signature)) {
                throw new DomainException('Heartbeat signature verification failed.');
            }

            if (TenantHealthSnapshot::query()->where('heartbeat_nonce', $validated['nonce'])->exists()) {
                throw new DomainException('Heartbeat nonce has already been used.');
            }

            $snapshot = TenantHealthSnapshot::query()->create([
                'tenant_instance_id' => $lockedTenant->getKey(),
                'heartbeat_nonce' => $validated['nonce'],
                'health_status' => $validated['health_status'],
                'component_statuses' => $validated['component_statuses'],
                'error_fingerprints' => $validated['error_fingerprints'],
                'aggregate_counters' => $validated['aggregate_counters'],
                'observed_at' => $observedAt,
            ]);

            $lockedTenant->forceFill([
                'application_version' => $validated['application_version'],
                'schema_version' => $validated['schema_version'],
                'last_heartbeat_at' => $observedAt,
            ])->save();

            return $snapshot;
        });
    }
}
