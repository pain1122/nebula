<?php

namespace App\Support;

use DomainException;

final class MedicalContentPolicy
{
    private function __construct(public readonly array $rules, public readonly string $revision) {}

    public static function current(): self
    {
        return self::fromRules(config('medical_content'));
    }

    public static function fromRules(mixed $rules): self
    {
        if (! is_array($rules) || ! self::keys($rules, ['version', 'image', 'pdf', 'resources'])
            || ($rules['version'] ?? null) !== 1
            || ! self::keys($rules['image'] ?? null, ['max_width', 'max_height', 'max_pixels'])
            || ! self::keys($rules['pdf'] ?? null, ['max_pages', 'max_objects', 'forbidden_names'])
            || ! self::keys($rules['resources'] ?? null, ['timeout_seconds', 'cpu_seconds', 'address_space_bytes', 'max_output_bytes'])) {
            throw new DomainException('Medical content policy is unavailable.');
        }

        foreach ([
            [$rules['image']['max_width'], 1, 16384],
            [$rules['image']['max_height'], 1, 16384],
            [$rules['image']['max_pixels'], 1, 16000000],
            [$rules['pdf']['max_pages'], 1, 1000],
            [$rules['pdf']['max_objects'], 1, 50000],
            [$rules['resources']['timeout_seconds'], 1, 20],
            [$rules['resources']['cpu_seconds'], 1, 15],
            [$rules['resources']['address_space_bytes'], 67108864, 268435456],
            [$rules['resources']['max_output_bytes'], 1024, 4194304],
        ] as [$value, $minimum, $maximum]) {
            if (! is_int($value) || $value < $minimum || $value > $maximum) {
                throw new DomainException('Medical content policy is unavailable.');
            }
        }

        $names = $rules['pdf']['forbidden_names'];
        if (! is_array($names) || ! array_is_list($names) || count($names) < 1 || count($names) > 100) {
            throw new DomainException('Medical content policy is unavailable.');
        }
        foreach ($names as $name) {
            if (! is_string($name) || ! preg_match('~^/[A-Za-z0-9]{1,40}$~D', $name)) {
                throw new DomainException('Medical content policy is unavailable.');
            }
        }
        $rules['pdf']['forbidden_names'] = array_values(array_unique($names));
        sort($rules['pdf']['forbidden_names'], SORT_STRING);
        $rules = self::canonical($rules);

        return new self($rules, hash('sha256', json_encode($rules, JSON_THROW_ON_ERROR)));
    }

    private static function keys(mixed $value, array $expected): bool
    {
        if (! is_array($value)) {
            return false;
        }
        $actual = array_keys($value);
        sort($actual);
        sort($expected);

        return $actual === $expected;
    }

    private static function canonical(array $value): array
    {
        if (! array_is_list($value)) {
            ksort($value, SORT_STRING);
        }
        foreach ($value as &$item) {
            if (is_array($item)) {
                $item = self::canonical($item);
            }
        }

        return $value;
    }
}
