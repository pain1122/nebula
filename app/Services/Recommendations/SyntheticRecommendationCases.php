<?php

namespace App\Services\Recommendations;

use App\Services\Health\HealthCatalog;
use DateTimeImmutable;
use InvalidArgumentException;

/** Fixed software demonstrations only: no patient lookup, medical thresholds or clinical approval. */
final class SyntheticRecommendationCases
{
    public static function projection(string $case, DateTimeImmutable $instant): array
    {
        if (! in_array($case, ['missing', 'unknown', 'recent', 'stale'], true)) {
            throw new InvalidArgumentException('Invalid synthetic case.');
        }
        $projection = ['health_catalog_version' => HealthCatalog::VERSION, 'provenance' => [], 'measurements' => []];
        if ($case === 'missing') {
            return $projection;
        }
        $date = $case === 'stale' ? $instant->modify('-3651 days') : $instant;
        $fact = fn ($value) => ['value' => $value, 'source' => 'self_report', 'asserted_at' => $date->format(DATE_ATOM)];
        $values = ['birth_date' => '2000-01-01', 'gender' => 'female', 'smoking' => 'no', 'alcohol' => 'no',
            'low_activity' => 'yes', 'stress' => 'no', 'family_history' => 'no',
            'conditions' => ['status' => 'no', 'codes' => []], 'allergies' => ['status' => 'no', 'codes' => []]];
        foreach ($values as $field => $value) {
            $projection['provenance'][$field] = $fact($case === 'unknown'
                ? (in_array($field, ['conditions', 'allergies'], true) ? ['status' => 'unknown', 'codes' => []] : 'unknown') : $value);
        }
        if ($case !== 'unknown') {
            foreach (['weight' => ['70.00', 'kg'], 'height' => ['175.00', 'cm']] as $metric => [$value, $unit]) {
                $projection['measurements'][$metric] = ['metric' => $metric, 'value' => $value, 'unit' => $unit, 'source' => 'self_report',
                    'measured_on' => $date->format('Y-m-d'), 'recorded_at' => $date->format(DATE_ATOM)];
            }
        }

        return $projection;
    }
}
