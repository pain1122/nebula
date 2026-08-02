<?php

namespace App\Services;

use App\Enums\OutboxEventType;
use App\Models\Feature;
use App\Models\TenantFeatureOverride;
use App\Models\TenantInstance;
use App\Models\User;
use Carbon\CarbonInterface;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class TenantFeatureOverrideService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
        private readonly OutboxPublisher $outboxPublisher,
    ) {}

    public function set(
        Request $request,
        User $actor,
        TenantInstance $tenantInstance,
        Feature $feature,
        bool $enabled,
        string $reason,
        ?CarbonInterface $expiresAt = null,
    ): TenantFeatureOverride {
        Gate::forUser($actor)->authorize('manageFeatures', $tenantInstance);

        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A tenant feature override reason is required.');
        }

        if (! $feature->is_active) {
            throw new DomainException('Inactive feature keys cannot be assigned to tenants.');
        }

        if ($expiresAt !== null && ! $expiresAt->isFuture()) {
            throw new InvalidArgumentException('Tenant feature override expiry must be in the future.');
        }

        return DB::transaction(function () use (
            $request,
            $actor,
            $tenantInstance,
            $feature,
            $enabled,
            $reason,
            $expiresAt,
        ): TenantFeatureOverride {
            $lockedTenant = TenantInstance::query()->lockForUpdate()->findOrFail($tenantInstance->getKey());
            $lockedFeature = Feature::query()->lockForUpdate()->findOrFail($feature->getKey());
            $override = TenantFeatureOverride::query()
                ->where('tenant_instance_id', $lockedTenant->getKey())
                ->where('feature_id', $lockedFeature->getKey())
                ->lockForUpdate()
                ->first();
            $before = $override === null ? null : $this->snapshot($override, $lockedFeature);

            $override ??= new TenantFeatureOverride;
            $override->forceFill([
                'tenant_instance_id' => $lockedTenant->getKey(),
                'feature_id' => $lockedFeature->getKey(),
                'enabled' => $enabled,
                'reason' => $reason,
                'actor_id' => $actor->getKey(),
                'expires_at' => $expiresAt,
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'tenant.feature_override.set',
                subject: $override,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($override, $lockedFeature),
                reason: $reason,
            );

            $this->outboxPublisher->marketplace(
                $override,
                OutboxEventType::TenantEntitlementChanged,
                [
                    'tenant_public_id' => (string) $lockedTenant->public_id,
                    'feature_key' => $lockedFeature->key,
                    'enabled' => (bool) $override->enabled,
                    'expires_at' => $override->expires_at?->toISOString(),
                ],
            );

            return $override->fresh();
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(TenantFeatureOverride $override, Feature $feature): array
    {
        return [
            'tenant_instance_public_id' => $override->tenantInstance?->public_id
                ?? TenantInstance::query()->whereKey($override->tenant_instance_id)->value('public_id'),
            'feature_key' => $feature->key,
            'enabled' => (bool) $override->enabled,
            'expires_at' => $override->expires_at?->toISOString(),
        ];
    }
}
