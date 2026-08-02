<?php

namespace App\Services;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use JsonException;
use LogicException;

class SettingsResolver
{
    public function __construct(
        private readonly SettingsRegistry $registry,
        private readonly TenantFeatureGate $tenantFeatureGate,
    ) {}

    public function marketplace(string $key, ?string $siteKey = null, ?string $userKey = null): mixed
    {
        $scopes = [];

        if ($userKey !== null) {
            $scopes[] = ['user', $userKey];
        }

        if ($siteKey !== null) {
            $scopes[] = ['site', $siteKey];
        }

        $scopes[] = ['platform', 'marketplace'];

        return $this->resolve(DB::connection(), 'marketplace', $key, $scopes);
    }

    public function tenant(string $key, ?string $userKey = null): mixed
    {
        $scopes = [];

        if ($userKey !== null) {
            $scopes[] = ['user', $userKey];
        }

        $scopes[] = ['hospital', 'hospital'];
        $value = $this->resolve(DB::connection('tenant'), 'tenant', $key, $scopes);
        $requiredFeature = $this->registry->definition('tenant', $key)['required_feature'] ?? null;

        if ($value === true && is_string($requiredFeature) && ! $this->tenantFeatureGate->allows($requiredFeature)) {
            return false;
        }

        return $value;
    }

    /**
     * @param  list<array{0: string, 1: string}>  $scopes
     */
    private function resolve(
        ConnectionInterface $connection,
        string $context,
        string $key,
        array $scopes,
    ): mixed {
        $definition = $this->registry->definition($context, $key);
        $allowedScopes = $definition['allowed_scopes'] ?? [];

        foreach ($scopes as [$scopeType, $scopeKey]) {
            if (! is_array($allowedScopes) || ! in_array($scopeType, $allowedScopes, true)) {
                continue;
            }

            $stored = $connection->table('setting_values')
                ->join('setting_definitions', 'setting_definitions.id', '=', 'setting_values.setting_definition_id')
                ->where('setting_definitions.key', $key)
                ->where('setting_values.scope_type', $scopeType)
                ->where('setting_values.scope_key', $scopeKey)
                ->value('setting_values.value');

            if ($stored !== null) {
                return $this->registry->validateValue($context, $key, $this->decode($stored, $key));
            }
        }

        return $this->registry->validateValue($context, $key, $definition['default'] ?? null);
    }

    private function decode(mixed $stored, string $key): mixed
    {
        if (! is_string($stored)) {
            return $stored;
        }

        try {
            return json_decode($stored, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new LogicException("Stored setting [{$key}] is not valid JSON.", previous: $exception);
        }
    }
}
