<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use JsonException;

final class GeneralMarketplaceSettings
{
    public const KEYS = ['booking.pending_hold_minutes', 'booking.default_timezone', 'payments.default_currency'];

    public function __construct(private readonly SettingsRegistry $registry) {}

    /** Never provision definitions or values while reading. */
    public function capture(string $scope, bool $lock = false, ?string $onlyKey = null): array
    {
        abort_unless(in_array($scope, ['platform', 'site'], true), 422);
        abort_if($lock && DB::transactionLevel() === 0, 503);
        abort_if($onlyKey !== null && ! in_array($onlyKey, self::KEYS, true), 422);
        $keys = $onlyKey === null ? self::KEYS : [$onlyKey];
        $platform = config('settings.scope_keys.marketplace_platform');
        $site = config('settings.scope_keys.marketplace_site');
        abort_unless(is_string($platform) && $platform !== '' && strlen($platform) <= 191
            && is_string($site) && $site !== '' && strlen($site) <= 191, 503, 'Settings scope configuration is unavailable.');
        $query = DB::table('setting_definitions')->whereIn('key', $keys)->orderBy('key');
        $definitions = ($lock ? $query->lockForUpdate() : $query)
            ->get(['id', 'key', 'value_type', 'sensitivity', 'allowed_scopes', 'updated_at'])->keyBy('key');
        $registered = [];
        try {
            foreach ($keys as $key) {
                $rule = $this->registry->definition('marketplace', $key);
                $this->registry->assertScopeAllowed('marketplace', $key, $scope);
                $default = $this->valid($key, $rule['default']);
                $definition = $definitions->get($key);
                if ($definition !== null) {
                    $scopes = json_decode($definition->allowed_scopes, true, flags: JSON_THROW_ON_ERROR);
                    $expected = $rule['allowed_scopes'];
                    abort_unless(is_array($scopes), 503, 'Settings metadata is unavailable.');
                    sort($scopes);
                    sort($expected);
                    abort_unless($definition->value_type === $rule['value_type'] && $definition->sensitivity === 'public'
                        && $rule['sensitivity'] === 'public' && $scopes === $expected, 503, 'Settings metadata is unavailable.');
                }
                $registered[$key] = ['rule' => $rule, 'default' => $default];
            }
        } catch (JsonException|ValidationException|InvalidArgumentException) {
            abort(503, 'General settings are unavailable.');
        }
        $query = DB::table('setting_values')->whereIn('setting_definition_id', $definitions->pluck('id'))
            ->where(function ($query) use ($scope, $platform, $site) {
                $query->where(fn ($query) => $query->where('scope_type', 'platform')->where('scope_key', $platform));
                if ($scope === 'site') {
                    $query->orWhere(fn ($query) => $query->where('scope_type', 'site')->where('scope_key', $site));
                }
            })->orderBy('id');
        $values = ($lock ? $query->lockForUpdate() : $query)->get(['id', 'setting_definition_id', 'scope_type', 'scope_key', 'value', 'updated_at',
            DB::raw('CASE WHEN secret_reference IS NULL THEN 0 ELSE 1 END AS secret_present')]);
        $settings = [];
        foreach ($keys as $key) {
            $definition = $definitions->get($key);
            $rows = $values->where('setting_definition_id', $definition?->id);
            $decoded = [];
            try {
                foreach ($rows as $row) {
                    abort_if((int) $row->secret_present !== 0 || array_key_exists($row->scope_type, $decoded), 503, 'General settings are unavailable.');
                    $decoded[$row->scope_type] = $this->valid($key, json_decode($row->value, true, flags: JSON_THROW_ON_ERROR));
                }
            } catch (JsonException|ValidationException|InvalidArgumentException) {
                abort(503, 'General settings are unavailable.');
            }
            $source = array_key_exists($scope, $decoded) ? $scope : (array_key_exists('platform', $decoded) ? 'platform' : 'default');
            $settings[] = ['key' => $key, 'value_type' => $registered[$key]['rule']['value_type'],
                'default' => $registered[$key]['default'], 'allowed_scopes' => $registered[$key]['rule']['allowed_scopes'],
                'scope_type' => $scope, 'scope_key' => $scope === 'site' ? $site : $platform,
                'stored' => array_key_exists($scope, $decoded), 'value' => $decoded[$scope] ?? null,
                'effective_value' => $source === 'default' ? $registered[$key]['default'] : $decoded[$source], 'effective_source' => $source,
                'runtime_bound' => true, 'runtime_source' => match ($key) {
                    'booking.pending_hold_minutes' => 'new_reservation_hold',
                    'booking.default_timezone' => 'missing_hospital_timezone_only',
                    'payments.default_currency' => 'missing_new_schedule_currency_only',
                },
                'runtime_default' => $key === 'booking.pending_hold_minutes' ? max(1, (int) config('payments.hold_minutes', 60)) : null,
                'constraints' => match ($key) {
                    'booking.pending_hold_minutes' => ['min' => 5, 'max' => 180],
                    'booking.default_timezone' => ['format' => 'iana_timezone'],
                    'payments.default_currency' => ['format' => 'three_uppercase_letters'],
                }];
        }

        // Audit sequence prevents an old revision becoming valid after set/reset or value restoration.
        $sequence = DB::table('audit_events')->where('action', 'settings.marketplace.updated')->max('id');

        return ['settings' => $settings, 'binding' => [$scope, $platform, $site, $registered, $definitions->values(), $values, $settings, $sequence]];
    }

    public function actor(User $user, bool $lock = false): User
    {
        $query = User::whereKey($user->id);
        $actor = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        if ($lock) {
            DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $actor->id)->orderBy('role_id')->lockForUpdate()->get();
        }
        $roles = $actor->roles();
        $actor->setRelation('roles', $lock ? $roles->lockForUpdate()->get() : $roles->get());
        if (! $actor->permitsAuthentication() || ! $actor->isRootAdmin()) {
            throw new AuthorizationException;
        }

        return $actor;
    }

    public function revision(User $actor, array $snapshot): string
    {
        return hash_hmac('sha256', json_encode([$actor->id, $actor->roles->pluck('name')->sort()->values()->all(), $snapshot['binding']], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    public function valid(string $key, mixed $value): mixed
    {
        $value = $this->registry->validateValue('marketplace', $key, $value);
        $valid = match ($key) {
            'booking.pending_hold_minutes' => is_int($value) && $value >= 5 && $value <= 180,
            'booking.default_timezone' => is_string($value) && in_array($value, timezone_identifiers_list(\DateTimeZone::ALL_WITH_BC), true),
            'payments.default_currency' => is_string($value) && preg_match('/\A[A-Z]{3}\z/', $value) === 1,
        };
        if (! $valid) {
            throw ValidationException::withMessages(['value' => 'Invalid general setting.']);
        }

        return $value;
    }
}
