<?php

namespace App\Services;

use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class GeneralMarketplaceSettingWriter
{
    public function __construct(
        private readonly GeneralMarketplaceSettings $settings,
        private readonly SettingsRegistry $registry,
        private readonly AuditLogger $audit,
    ) {}

    public function set(Request $request, User $actor, string $key, string $scope, string $scopeKey, mixed $value,
        string $reason, ?string $revision, bool $confirmed, bool $reset): SettingValue
    {
        $actor = $this->settings->actor($actor);
        validator(compact('key', 'scope', 'scopeKey', 'reason', 'revision', 'confirmed'), [
            'key' => ['required', \Illuminate\Validation\Rule::in(GeneralMarketplaceSettings::KEYS)],
            'scope' => ['required', \Illuminate\Validation\Rule::in(['platform', 'site'])],
            'scopeKey' => ['required', 'string', 'max:191'], 'reason' => ['required', 'string', 'max:1000'],
            'revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'], 'confirmed' => ['accepted'],
        ])->validate();
        if (trim($reason) === '' || ! hash_equals((string) config('settings.scope_keys.marketplace_'.$scope), $scopeKey)
            || ($reset && $value !== null)) {
            throw ValidationException::withMessages(['setting' => 'Review the requested scope, reason and operation.']);
        }
        $validated = $reset ? null : $this->settings->valid($key, $value);

        return DB::transaction(function () use ($request, $actor, $key, $scope, $scopeKey, $validated, $reason, $revision, $reset): SettingValue {
            $fresh = $this->settings->actor($actor, true);
            $snapshot = $this->settings->capture($scope, true);
            abort_unless(hash_equals($this->settings->revision($fresh, $snapshot), $revision), 409, 'Settings changed; refresh before continuing.');
            $definition = SettingDefinition::where('key', $key)->first();
            if ($definition === null && ! $reset) {
                $rule = $this->registry->definition('marketplace', $key);
                $definition = SettingDefinition::create(['key' => $key, 'group' => $rule['group'], 'value_type' => $rule['value_type'],
                    'default_value' => $rule['default'], 'validation_rules' => $rule['validation_rules'], 'sensitivity' => $rule['sensitivity'],
                    'allowed_scopes' => $rule['allowed_scopes'], 'description' => $rule['description']]);
            }
            $row = $definition === null ? null : SettingValue::where('setting_definition_id', $definition->id)
                ->where('scope_type', $scope)->where('scope_key', $scopeKey)->lockForUpdate()->first();
            if (($reset && $row === null) || (! $reset && $row !== null && $row->value === $validated)) {
                throw ValidationException::withMessages(['value' => 'No setting change to apply.']);
            }
            $before = $row === null ? null : $this->snapshot($key, $row);
            if ($reset) {
                $row->delete();
                $row->value = null;
            } else {
                $row ??= new SettingValue;
                $row->forceFill(['setting_definition_id' => $definition->id, 'scope_type' => $scope, 'scope_key' => $scopeKey,
                    'value' => $validated, 'secret_reference' => null, 'updated_by' => $fresh->id])->save();
            }
            $this->audit->log(request: $request, actor: $fresh, action: 'settings.marketplace.updated', subject: $row,
                riskLevel: 'high', before: $before, after: $this->snapshot($key, $row), reason: trim($reason));
            $verify = $this->settings->actor($fresh, true);
            abort_unless($fresh->roles->pluck('name')->sort()->values()->all() === $verify->roles->pluck('name')->sort()->values()->all(), 403);

            return $row;
        }, 3);
    }

    private function snapshot(string $key, SettingValue $row): array
    {
        return ['setting_key' => $key, 'scope_type' => $row->scope_type, 'scope_key' => $row->scope_key,
            'value' => $row->value, 'stored' => $row->exists];
    }
}
