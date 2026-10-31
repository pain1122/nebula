<?php

namespace App\Services;

use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Support\FileUploadPolicy;
use DomainException;
use Illuminate\Validation\ValidationException;

final class UploadPolicySettings
{
    private const SECTIONS = ['uploads.medical' => 'medical', 'uploads.public_media' => 'public_media'];

    public function __construct(private readonly SettingsRegistry $registry) {}

    public static function isSetting(string $key): bool
    {
        return isset(self::SECTIONS[$key]);
    }

    /** @param array<string, mixed> $overrides */
    public static function validateSetting(string $key, array $overrides): array
    {
        $section = self::SECTIONS[$key] ?? throw new DomainException('Unknown upload policy setting.');
        try {
            if (array_key_exists('max_bytes', $overrides) && ! is_int($overrides['max_bytes'])) {
                throw new DomainException('Upload sizes must be whole numbers of bytes.');
            }
            if (array_key_exists('type_limits', $overrides)) {
                if (! is_array($overrides['type_limits'])) {
                    throw new DomainException('Upload type limits must be an object.');
                }
                foreach ($overrides['type_limits'] as $bytes) {
                    if (! is_int($bytes)) {
                        throw new DomainException('Upload sizes must be whole numbers of bytes.');
                    }
                }
            }
            $policy = FileUploadPolicy::forSection($section, sizeOverrides: $overrides);
            if ($section === 'medical') {
                foreach ($policy->descriptor()['max_bytes_by_mime'] as $bytes) {
                    if ($bytes > FileUploadPolicy::scannerMaxBytes()) {
                        throw new DomainException('Medical upload limits exceed configured scanner capacity.');
                    }
                }
            }
        } catch (DomainException $exception) {
            throw ValidationException::withMessages(['value' => $exception->getMessage()]);
        }

        return $overrides;
    }

    /** Field rules must come from an authorized server-owned attachment definition. */
    public function forSection(string $section, array $fieldRules = []): FileUploadPolicy
    {
        return $this->capture($section, $fieldRules)['policy'];
    }

    /** Read policy and revision from the same value; locked captures require a transaction. */
    public function capture(string $section, array $fieldRules = [], bool $lock = false): array
    {
        $key = array_search($section, self::SECTIONS, true);
        if ($key === false) {
            throw new DomainException('Unknown upload policy section.');
        }

        if ($lock && \Illuminate\Support\Facades\DB::transactionLevel() < 1) {
            throw new DomainException('A locked upload policy read requires a transaction.');
        }
        if ($lock) {
            // Use the writer's definition/value lock order, including the indexed missing key.
            $definition = SettingDefinition::query()->where('key', $key)->lockForUpdate()->first();
            $stored = $definition === null ? null : SettingValue::query()
                ->where('setting_definition_id', $definition->getKey())
                ->where('scope_type', 'platform')
                ->where('scope_key', config('settings.scope_keys.marketplace_platform'))
                ->lockForUpdate()->first();
        } else {
            $stored = $this->storedValue($key);
        }
        $overrides = $this->registry->validateValue('marketplace', $key, $stored === null ? [] : $stored->value);

        return [
            'policy' => FileUploadPolicy::forSection($section, $fieldRules, $overrides),
            'revision' => self::revisionFor($key, $stored?->value, $stored !== null),
        ];
    }

    public function revision(string $key): string
    {
        $stored = $this->storedValue($key);

        return self::revisionFor($key, $stored?->value, $stored !== null);
    }

    /** The write path supplies its locked value, avoiding a stale transaction read. */
    public static function revisionFor(string $key, mixed $stored, bool $exists = false): string
    {
        $section = self::SECTIONS[$key] ?? throw new DomainException('Unknown upload policy setting.');

        return hash('sha256', json_encode([
            'key' => $key,
            'stored' => $stored,
            'exists' => $exists,
            'section' => config("uploads.sections.{$section}"),
            'formats' => config('uploads.formats'),
            'capacity' => config('uploads.capacity_max_bytes'),
            'scanner_capacity' => $section === 'medical' ? config('uploads.scanner_max_bytes') : null,
        ], JSON_THROW_ON_ERROR));
    }

    private function storedValue(string $key): ?SettingValue
    {
        if (! self::isSetting($key)) {
            throw new DomainException('Unknown upload policy setting.');
        }

        return SettingValue::query()->whereHas('definition', fn ($query) => $query->where('key', $key))
            ->where('scope_type', 'platform')
            ->where('scope_key', config('settings.scope_keys.marketplace_platform'))
            ->first();
    }

    /** Safe root-admin read model; no storage paths, credentials or patient data. */
    public function describe(string $key): array
    {
        $section = self::SECTIONS[$key] ?? throw new DomainException('Unknown upload policy setting.');
        $stored = $this->storedValue($key);
        $state = 'active';
        try {
            $overrides = $this->registry->validateValue('marketplace', $key, $stored === null ? [] : $stored->value);
        } catch (ValidationException) {
            // These are explicit repair suggestions for admins, never an upload fallback.
            $state = 'review_required';
            $ceiling = FileUploadPolicy::capacityMaxBytes();
            if ($section === 'medical') {
                $ceiling = min($ceiling, FileUploadPolicy::scannerMaxBytes());
            }
            $overrides = ['max_bytes' => $ceiling, 'type_limits' => []];
        }
        $policy = FileUploadPolicy::forSection($section, sizeOverrides: $overrides);
        $typeLimits = $overrides['type_limits'] ?? config("uploads.sections.{$section}.type_limits") ?? [];

        return [
            'key' => $key,
            'scope_type' => 'platform',
            'scope_key' => config('settings.scope_keys.marketplace_platform'),
            'value' => $overrides,
            'policy_state' => $state,
            'revision' => self::revisionFor($key, $stored?->value, $stored !== null),
            'policy' => $policy->descriptor(),
            'type_limit_overrides' => array_intersect_key($policy->descriptor()['max_bytes_by_mime'], $typeLimits),
            'default_max_bytes' => (int) ($overrides['max_bytes'] ?? config("uploads.sections.{$section}.max_bytes")),
            'configured_default_max_bytes' => (int) config("uploads.sections.{$section}.max_bytes"),
            'capacity_max_bytes' => FileUploadPolicy::capacityMaxBytes(),
            'scanner_max_bytes' => $section === 'medical' ? FileUploadPolicy::scannerMaxBytes() : null,
        ];
    }
}
