<?php

namespace App\Services;

use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class MarketplaceSettingService
{
    public function __construct(
        private readonly SettingsRegistry $registry,
        private readonly AuditLogger $auditLogger,
    ) {}

    public function set(
        Request $request,
        User $actor,
        string $key,
        string $scopeType,
        string $scopeKey,
        mixed $value,
        string $reason,
        ?string $expectedRevision = null,
        bool $confirmed = false,
        bool $reset = false,
    ): SettingValue {
        if (in_array($key, GeneralMarketplaceSettings::KEYS, true)) {
            return app(GeneralMarketplaceSettingWriter::class)->set($request, $actor, $key, $scopeType, $scopeKey,
                $value, $reason, $expectedRevision, $confirmed, $reset);
        }
        if ($reset) {
            throw ValidationException::withMessages(['operation' => 'Reset is unavailable for this setting.']);
        }
        $definition = SettingDefinition::query()->where('key', $key)->first();
        if ($definition === null && UploadPolicySettings::isSetting($key)) {
            // Only these registered upload keys can be provisioned by an ordinary,
            // authorized setting write; validation precedes all persistence.
            $definition = new SettingDefinition(['key' => $key]);
        }
        $definition ??= SettingDefinition::query()->where('key', $key)->firstOrFail();
        Gate::forUser($actor)->authorize('update', $definition);
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A marketplace setting change reason is required.');
        }

        $this->registry->assertScopeAllowed('marketplace', $key, $scopeType);
        $this->assertScopeKey($scopeType, $scopeKey);
        if (UploadPolicySettings::isSetting($key)
            && (! is_string($expectedRevision) || ! preg_match('/^[a-f0-9]{64}$/D', $expectedRevision))) {
            throw ValidationException::withMessages(['expected_revision' => 'Read the current upload policy before saving.']);
        }
        if (UploadPolicySettings::isSetting($key)
            && ! hash_equals(app(UploadPolicySettings::class)->revision($key), $expectedRevision)) {
            throw ValidationException::withMessages([
                'expected_revision' => 'Upload policy changed. Reload and review before saving.',
            ]);
        }
        $validatedValue = $this->registry->validateValue('marketplace', $key, $value);

        return DB::transaction(function () use (
            $request,
            $actor,
            $definition,
            $key,
            $scopeType,
            $scopeKey,
            $validatedValue,
            $reason,
            $expectedRevision,
        ): SettingValue {
            if (! $definition->exists) {
                $registered = $this->registry->definition('marketplace', $key);
                $definition = SettingDefinition::query()->firstOrCreate(['key' => $key], [
                    'group' => $registered['group'],
                    'value_type' => $registered['value_type'],
                    'default_value' => $registered['default'],
                    'validation_rules' => $registered['validation_rules'],
                    'sensitivity' => $registered['sensitivity'],
                    'allowed_scopes' => $registered['allowed_scopes'],
                    'description' => $registered['description'],
                ]);
            }
            $lockedDefinition = SettingDefinition::query()->lockForUpdate()->findOrFail($definition->getKey());
            $settingValue = SettingValue::query()
                ->where('setting_definition_id', $lockedDefinition->getKey())
                ->where('scope_type', $scopeType)
                ->where('scope_key', $scopeKey)
                ->lockForUpdate()
                ->first();
            if (UploadPolicySettings::isSetting($key)
                && ! hash_equals(UploadPolicySettings::revisionFor($key, $settingValue?->value, $settingValue !== null), $expectedRevision)) {
                throw ValidationException::withMessages([
                    'expected_revision' => 'Upload policy changed. Reload and review before saving.',
                ]);
            }
            $before = $settingValue === null ? null : $this->snapshot($key, $settingValue);

            $settingValue ??= new SettingValue;
            $settingValue->forceFill([
                'setting_definition_id' => $lockedDefinition->getKey(),
                'scope_type' => $scopeType,
                'scope_key' => $scopeKey,
                'value' => $validatedValue,
                'secret_reference' => null,
                'updated_by' => $actor->getKey(),
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'settings.marketplace.updated',
                subject: $settingValue,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($key, $settingValue),
                reason: $reason,
            );

            return $settingValue->fresh();
        });
    }

    private function assertScopeKey(string $scopeType, string $scopeKey): void
    {
        $valid = match ($scopeType) {
            'platform' => hash_equals((string) config('settings.scope_keys.marketplace_platform'), $scopeKey),
            'site' => hash_equals((string) config('settings.scope_keys.marketplace_site'), $scopeKey),
            'user' => User::query()->where('public_id', $scopeKey)->exists(),
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'scope_key' => "Scope key [{$scopeKey}] is invalid for marketplace scope [{$scopeType}].",
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(string $key, SettingValue $settingValue): array
    {
        return [
            'setting_key' => $key,
            'scope_type' => $settingValue->scope_type,
            'scope_key' => $settingValue->scope_key,
            'value' => $settingValue->value,
        ];
    }
}
