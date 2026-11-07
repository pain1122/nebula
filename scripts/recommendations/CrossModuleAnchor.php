<?php

namespace Checkupino\Acceptance\Recommendations;

/** Match the actual protected table/target and both MySQL locking-read spellings, never ordinary reads. */
final class CrossModuleAnchor
{
    public static function matches(string $sql, array $bindings, array $case): bool
    {
        $sql = strtolower($sql);
        if (! str_contains($sql, 'for update') && ! str_contains($sql, 'lock in share mode') && ! str_contains($sql, 'for share')) {
            return false;
        }
        $table = match ($case['anchor'] ?? null) {
            'article' => 'article_catalog_state', 'rule' => 'recommendation_catalog_state',
            'profile' => 'doctor_profiles', 'patient', 'doctor' => 'users', default => null,
        };
        if ($table === null || ! str_contains($sql, '`'.$table.'`')) {
            return false;
        }
        if (in_array($case['anchor'], ['patient', 'doctor'], true)) {
            return isset($case[$case['anchor']]) && in_array((string) $case[$case['anchor']], array_map(fn ($value) => (string) $value, $bindings), true);
        }

        return true;
    }
}
