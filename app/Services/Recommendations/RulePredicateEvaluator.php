<?php

namespace App\Services\Recommendations;

use App\Services\Health\HealthCatalog;
use DateTimeImmutable;
use DateTimeZone;
use SensitiveParameter;
use Throwable;

/** Pure predicates on a server projection. No ownership/review/publication/target eligibility is granted. */
final class RulePredicateEvaluator
{
    public function evaluate(RuleCondition $condition, #[SensitiveParameter] array $health, DateTimeImmutable $instant): PredicateOutcome
    {
        if (PHP_INT_SIZE !== 8 || ($health['health_catalog_version'] ?? null) !== HealthCatalog::VERSION
            || array_diff(array_keys($health), ['health_catalog_version', 'provenance', 'measurements'])
            || ! is_array($health['provenance'] ?? null) || ! is_array($health['measurements'] ?? null)) {
            return PredicateOutcome::InsufficientData;
        }
        $instant = $instant->setTimezone(new DateTimeZone('Asia/Tehran'));
        $definition = $condition->definition();
        $include = $this->node($definition['include'], $health, $instant);
        $exclude = $definition['exclude'] === null ? false : $this->node($definition['exclude'], $health, $instant);

        return match (true) {
            $exclude === true => PredicateOutcome::Excluded,
            $include === false => PredicateOutcome::NoMatch,
            $include === true && $exclude === false => PredicateOutcome::Match,
            default => PredicateOutcome::InsufficientData,
        };
    }

    private function node(array $node, #[SensitiveParameter] array $health, DateTimeImmutable $instant): ?bool
    {
        if (isset($node['all']) || isset($node['any'])) {
            $all = isset($node['all']);
            $unknown = false;
            foreach ($node[$all ? 'all' : 'any'] as $child) {
                $value = $this->node($child, $health, $instant);
                if ($value === ! $all) {
                    return ! $all;
                }
                $unknown = $unknown || $value === null;
            }

            return $unknown ? null : $all;
        }
        $field = $node['field'];
        if (isset(RuleCondition::LIMITS[$field])) {
            $weight = $field === 'height_cm' ? null : $this->measurement($health, 'weight', $node['max_age_days'], $instant);
            $height = $field === 'weight_kg' ? null : $this->measurement($health, 'height', $node['max_age_days'], $instant);
            if ($field === 'bmi') {
                if ($weight === null || $height === null || $weight[1]->diff($height[1])->days > $node['max_measurement_gap_days']) {
                    return null;
                }

                // Compare unrounded BMI hundredths as an exact ratio, within signed64 bounds.
                return $this->numeric($node, $weight[0] * 100000000, $height[0] * $height[0]);
            }
            $value = $field === 'weight_kg' ? $weight : $height;

            return $value === null ? null : $this->numeric($node, $value[0], 1);
        }
        $fact = $this->fact($health, $field === 'age_years' ? 'birth_date' : $field, $node['max_age_days'], $instant);
        if ($fact === null) {
            return null;
        }
        $value = $fact['value'];
        if ($field === 'age_years') {
            $birth = $this->date($value);
            $today = $instant->setTime(0, 0);
            if ($birth === null || $birth > $today || $birth > $fact['asserted_at']->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0, 0)
                || $birth->diff($today)->y > 150) {
                return null;
            }

            return $this->numeric($node, $birth->diff($today)->y, 1);
        }
        if (in_array($field, ['conditions', 'allergies'], true)) {
            if (! is_array($value) || array_diff(array_keys($value), ['status', 'codes'])
                || ! in_array($value['status'] ?? null, HealthCatalog::STATUSES, true)
                || ! is_array($value['codes'] ?? null) || ! array_is_list($value['codes']) || count($value['codes']) > 30) {
                return null;
            }
            $codes = $value['codes'];
            foreach ($codes as $code) {
                if (! is_string($code) || ! in_array($code, RuleCondition::codes($field), true)) {
                    return null;
                }
            }
            if (count(array_unique($codes)) !== count($codes) || ($value['status'] !== 'yes' && $codes !== [])
                || in_array($value['status'], ['unknown', 'declined'], true)) {
                return null;
            }
            if ($node['operator'] === 'reported_none') {
                return $value['status'] === 'no';
            }
            if ($value['status'] === 'no') {
                return false;
            }

            return in_array($node['value'], $codes, true) ? true : null;
        }
        $allowed = $field === 'gender' ? ['male', 'female'] : ['yes', 'no'];

        return in_array($value, $allowed, true) ? $value === $node['value'] : null;
    }

    private function numeric(array $node, #[SensitiveParameter] int $numerator, #[SensitiveParameter] int $denominator): bool
    {
        $threshold = fn ($value): int => ($node['field'] === 'age_years' ? $value : RuleCondition::hundredths($value, RuleCondition::LIMITS[$node['field']])) * $denominator;
        if ($node['operator'] === 'between') {
            return $numerator >= $threshold($node['value'][0]) && $numerator <= $threshold($node['value'][1]);
        }
        $value = $threshold($node['value']);

        return match ($node['operator']) {
            'eq' => $numerator === $value,
            'lt' => $numerator < $value,
            'lte' => $numerator <= $value,
            'gt' => $numerator > $value,
            'gte' => $numerator >= $value,
        };
    }

    private function fact(#[SensitiveParameter] array $health, string $field, ?int $maxAge, DateTimeImmutable $instant): ?array
    {
        $fact = $health['provenance'][$field] ?? null;
        if (! is_array($fact) || ($fact['source'] ?? null) !== 'self_report' || ! array_key_exists('value', $fact) || $fact['value'] === null) {
            return null;
        }
        $asserted = $this->timestamp($fact['asserted_at'] ?? null);
        if ($asserted === null || $asserted > $instant || ($maxAge !== null && ! $this->fresh($asserted, $instant, $maxAge))) {
            return null;
        }

        return ['value' => $fact['value'], 'asserted_at' => $asserted];
    }

    private function measurement(#[SensitiveParameter] array $health, string $metric, int $maxAge, DateTimeImmutable $instant): ?array
    {
        $row = $health['measurements'][$metric] ?? null;
        if (! is_array($row) || ($row['source'] ?? null) !== 'self_report' || ($row['metric'] ?? null) !== $metric
            || ($row['unit'] ?? null) !== ($metric === 'weight' ? 'kg' : 'cm')) {
            return null;
        }
        $value = RuleCondition::hundredths($row['value'] ?? null, RuleCondition::LIMITS[$metric === 'weight' ? 'weight_kg' : 'height_cm']);
        $measured = $this->date($row['measured_on'] ?? null);
        $recorded = $this->timestamp($row['recorded_at'] ?? null);
        if ($value === null || $measured === null || $recorded === null || $recorded > $instant
            || $measured > $recorded->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0, 0) || ! $this->fresh($measured, $instant, $maxAge)) {
            return null;
        }

        return [$value, $measured];
    }

    private function fresh(#[SensitiveParameter] DateTimeImmutable $date, DateTimeImmutable $instant, int $days): bool
    {
        $date = $date->setTimezone(new DateTimeZone('Asia/Tehran'))->setTime(0, 0);
        $today = $instant->setTime(0, 0);

        return $date <= $today && $date->diff($today)->days <= $days;
    }

    private function date(#[SensitiveParameter] mixed $value): ?DateTimeImmutable
    {
        if (! is_string($value) || ! preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}\z/', $value) || $value < '1900-01-01') {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('Asia/Tehran'));
        $errors = DateTimeImmutable::getLastErrors();

        return $date && $date->format('Y-m-d') === $value && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0)) ? $date : null;
    }

    private function timestamp(#[SensitiveParameter] mixed $value): ?DateTimeImmutable
    {
        if (! is_string($value) || ! preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})\z/', $value)) {
            return null;
        }
        try {
            $date = new DateTimeImmutable($value);
            $errors = DateTimeImmutable::getLastErrors();

            return $errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0) ? $date : null;
        } catch (Throwable) {
            return null;
        }
    }
}
