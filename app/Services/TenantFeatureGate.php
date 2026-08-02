<?php

namespace App\Services;

use App\Support\TenantEntitlementSignature;
use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Throwable;

final class TenantFeatureGate
{
    public function __construct(
        private readonly TenantEntitlementSignature $signature,
    ) {}

    public function allows(string $featureKey): bool
    {
        if ($featureKey === '') {
            return false;
        }

        try {
            $connection = DB::connection('tenant');
            $installationKey = $this->installationKey($connection);
            $entitlement = $connection->table('feature_entitlements')
                ->where('feature_key', $featureKey)
                ->first();

            if ($installationKey === null || $entitlement === null || ! (bool) $entitlement->enabled) {
                return false;
            }

            if ($entitlement->signature_algorithm !== TenantEntitlementSignature::ALGORITHM) {
                return false;
            }

            $now = CarbonImmutable::now('UTC');
            $issuedAt = CarbonImmutable::parse($entitlement->issued_at, 'UTC');
            $expiresAt = CarbonImmutable::parse($entitlement->expires_at, 'UTC');
            $clockSkew = config('tenant.entitlements.clock_skew_seconds');

            if (! is_int($clockSkew) || $clockSkew < 0) {
                return false;
            }

            if ($issuedAt->isAfter($now->addSeconds($clockSkew)) || ! $expiresAt->isAfter($now)) {
                return false;
            }

            return $this->signature->verify(
                installationKey: $installationKey,
                featureKey: $entitlement->feature_key,
                enabled: (bool) $entitlement->enabled,
                entitlementVersion: $entitlement->entitlement_version,
                issuedAt: $issuedAt,
                expiresAt: $expiresAt,
                keyId: $entitlement->signing_key_id,
                signature: $entitlement->signature,
            );
        } catch (Throwable) {
            return false;
        }
    }

    private function installationKey(ConnectionInterface $connection): ?string
    {
        $installations = $connection->table('tenant_installation')
            ->limit(2)
            ->pluck('installation_key');

        if ($installations->count() !== 1) {
            return null;
        }

        $installationKey = $installations->first();

        return is_string($installationKey) && $installationKey !== '' ? $installationKey : null;
    }
}
