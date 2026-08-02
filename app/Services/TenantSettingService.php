<?php

namespace App\Services;

use App\Policies\TenantSettingPolicy;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class TenantSettingService
{
    public function __construct(
        private readonly SettingsRegistry $registry,
        private readonly TenantFeatureGate $featureGate,
        private readonly TenantSettingPolicy $policy,
        private readonly TenantAuditLogger $auditLogger,
    ) {}

    public function set(
        Request $request,
        int $actorId,
        string $key,
        string $scopeType,
        string $scopeKey,
        mixed $value,
        string $reason,
    ): object {
        if (! $this->policy->update($actorId)) {
            throw new AuthorizationException('Only an active tenant admin may change tenant settings.');
        }

        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A tenant setting change reason is required.');
        }

        $definition = $this->registry->definition('tenant', $key);
        $this->registry->assertScopeAllowed('tenant', $key, $scopeType);
        $this->assertScopeKey($scopeType, $scopeKey);
        $validatedValue = $this->registry->validateValue('tenant', $key, $value);
        $requiredFeature = $definition['required_feature'] ?? null;

        if ($validatedValue === true
            && is_string($requiredFeature)
            && ! $this->featureGate->allows($requiredFeature)) {
            throw new DomainException("Tenant feature [{$requiredFeature}] is not entitled.");
        }

        return DB::connection('tenant')->transaction(function () use (
            $request,
            $actorId,
            $key,
            $scopeType,
            $scopeKey,
            $validatedValue,
            $reason,
        ): object {
            $db = DB::connection('tenant');
            $storedDefinition = $db->table('setting_definitions')->where('key', $key)->lockForUpdate()->first();

            if ($storedDefinition === null) {
                throw new DomainException("Tenant setting definition [{$key}] has not been provisioned.");
            }

            $storedValue = $db->table('setting_values')
                ->where('setting_definition_id', $storedDefinition->id)
                ->where('scope_type', $scopeType)
                ->where('scope_key', $scopeKey)
                ->lockForUpdate()
                ->first();
            $before = $storedValue === null ? null : $this->snapshot($key, $storedValue);
            $publicId = $storedValue?->public_id ?? (string) Str::ulid();
            $now = now();

            $db->table('setting_values')->updateOrInsert(
                [
                    'setting_definition_id' => $storedDefinition->id,
                    'scope_type' => $scopeType,
                    'scope_key' => $scopeKey,
                ],
                [
                    'public_id' => $publicId,
                    'value' => json_encode($validatedValue, JSON_THROW_ON_ERROR),
                    'secret_reference' => null,
                    'updated_by' => $actorId,
                    'created_at' => $storedValue?->created_at ?? $now,
                    'updated_at' => $now,
                ],
            );

            $updated = $db->table('setting_values')->where('public_id', $publicId)->first();
            $this->auditLogger->log(
                request: $request,
                actorId: $actorId,
                action: 'settings.tenant.updated',
                subjectType: 'tenant_setting_value',
                subjectId: $updated->id,
                subjectPublicId: $updated->public_id,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($key, $updated),
                reason: $reason,
            );

            return $updated;
        });
    }

    private function assertScopeKey(string $scopeType, string $scopeKey): void
    {
        $valid = match ($scopeType) {
            'hospital' => hash_equals((string) config('settings.scope_keys.tenant_hospital'), $scopeKey),
            'user' => DB::connection('tenant')->table('users')->where('public_id', $scopeKey)->exists(),
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'scope_key' => "Scope key [{$scopeKey}] is invalid for tenant scope [{$scopeType}].",
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(string $key, object $settingValue): array
    {
        return [
            'setting_key' => $key,
            'scope_type' => $settingValue->scope_type,
            'scope_key' => $settingValue->scope_key,
            'value' => is_string($settingValue->value)
                ? json_decode($settingValue->value, true, flags: JSON_THROW_ON_ERROR)
                : $settingValue->value,
        ];
    }
}
