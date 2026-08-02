<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class SettingsRegistry
{
    /**
     * @return array<string, mixed>
     */
    public function definition(string $context, string $key): array
    {
        $definitions = config("settings.{$context}");

        if (! is_array($definitions) || ! isset($definitions[$key]) || ! is_array($definitions[$key])) {
            throw new InvalidArgumentException("Unknown {$context} setting key [{$key}].");
        }

        return $definitions[$key];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function definitions(string $context): array
    {
        $definitions = config("settings.{$context}");

        if (! is_array($definitions)) {
            throw new InvalidArgumentException("Unknown settings context [{$context}].");
        }

        return $definitions;
    }

    public function validateValue(string $context, string $key, mixed $value): mixed
    {
        $definition = $this->definition($context, $key);
        $type = $definition['value_type'] ?? null;
        $validType = match ($type) {
            'boolean' => is_bool($value),
            'integer' => is_int($value),
            'string' => is_string($value),
            'array' => is_array($value),
            default => false,
        };

        if (! $validType) {
            throw ValidationException::withMessages([
                'value' => "Setting [{$key}] requires a {$type} value.",
            ]);
        }

        $rules = $definition['validation_rules'] ?? [];

        if (! is_array($rules)) {
            throw new InvalidArgumentException("Setting [{$key}] has invalid registry validation rules.");
        }

        return Validator::make(['value' => $value], ['value' => $rules])->validate()['value'];
    }

    public function assertScopeAllowed(string $context, string $key, string $scope): void
    {
        $allowedScopes = $this->definition($context, $key)['allowed_scopes'] ?? [];

        if (! is_array($allowedScopes) || ! in_array($scope, $allowedScopes, true)) {
            throw ValidationException::withMessages([
                'scope_type' => "Scope [{$scope}] is not allowed for setting [{$key}].",
            ]);
        }
    }
}
