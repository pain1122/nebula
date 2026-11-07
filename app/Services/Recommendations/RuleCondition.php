<?php

namespace App\Services\Recommendations;

use App\Services\Health\HealthCatalog;
use InvalidArgumentException;
use SensitiveParameter;

/** Pure, bounded protocol. This is not a persisted/reviewed or activatable rule. */
final readonly class RuleCondition
{
    // A semantic change requires a new version and renewed integration/review acceptance.
    public const EVALUATOR_VERSION = 'predicate-2026-11-05.1';

    public const LIMITS = ['weight_kg' => 100000, 'height_cm' => 30000, 'bmi' => 100000];

    private function __construct(private array $value) {}

    public static function fromArray(#[SensitiveParameter] array $input): self
    {
        self::keys($input, ['schema_version', 'health_catalog_version', 'include'], ['exclude']);
        if (($input['schema_version'] ?? null) !== 1 || ($input['health_catalog_version'] ?? null) !== HealthCatalog::VERSION) {
            self::fail();
        }
        $count = 0;
        $include = self::node($input['include'], 1, $count);
        $exclude = ($input['exclude'] ?? null) === null ? null : self::node($input['exclude'], 1, $count);

        return new self(['schema_version' => 1, 'health_catalog_version' => HealthCatalog::VERSION,
            'include' => $include, 'exclude' => $exclude]);
    }

    public function definition(): array
    {
        return $this->value;
    }

    public function hash(): string
    {
        return hash('sha256', json_encode(['evaluator_version' => self::EVALUATOR_VERSION, ...$this->value], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /** Exact quantities; caps are representation bounds, not clinical cutoffs. */
    public static function hundredths(#[SensitiveParameter] mixed $value, int $maximum): ?int
    {
        if (! is_string($value) || ! preg_match('/\A([0-9]{1,4})(?:\.([0-9]{1,2}))?\z/', $value, $parts)) {
            return null;
        }
        $number = (int) $parts[1] * 100 + (int) str_pad($parts[2] ?? '', 2, '0');

        return $number > 0 && $number <= $maximum ? $number : null;
    }

    public static function codes(string $field): array
    {
        $kind = $field === 'conditions' ? 'condition' : 'allergy';

        return array_column(array_filter(HealthCatalog::terms(), fn ($term) => $term['kind'] === $kind && $term['active']), 'id');
    }

    private static function node(#[SensitiveParameter] mixed $input, int $depth, int &$count): array
    {
        if (! is_array($input) || array_is_list($input) || $depth > 4 || ++$count > 64) {
            self::fail();
        }
        if (array_key_exists('all', $input) || array_key_exists('any', $input)) {
            $group = array_key_exists('all', $input) ? 'all' : 'any';
            self::keys($input, [$group]);
            $children = $input[$group];
            if (! is_array($children) || ! array_is_list($children) || count($children) < 1 || count($children) > 8) {
                self::fail();
            }
            $result = [];
            foreach ($children as $child) {
                $result[] = self::node($child, $depth + 1, $count);
            }

            return [$group => $result];
        }
        $field = $input['field'] ?? null;
        $operator = $input['operator'] ?? null;
        if (! is_string($field) || ! in_array($field, ['age_years', 'gender', 'conditions', 'allergies', ...array_keys(self::LIMITS), ...HealthCatalog::LIFESTYLE], true)
            || ! is_string($operator)) {
            self::fail();
        }
        $numeric = $field === 'age_years' || isset(self::LIMITS[$field]);
        $coded = in_array($field, ['conditions', 'allergies'], true);
        $allowed = $numeric ? ['eq', 'lt', 'lte', 'gt', 'gte', 'between'] : ($coded ? ['contains', 'reported_none'] : ['eq']);
        if (! in_array($operator, $allowed, true)) {
            self::fail();
        }
        $required = ['field', 'operator', 'max_age_days'];
        if ($operator !== 'reported_none') {
            $required[] = 'value';
        }
        if (isset(self::LIMITS[$field])) {
            $required[] = 'unit';
        }
        if ($field === 'bmi') {
            $required[] = 'max_measurement_gap_days';
        }
        self::keys($input, $required);
        $maximumAge = $input['max_age_days'];
        if (! ($maximumAge === null && in_array($field, ['age_years', 'gender'], true)) && ! self::days($maximumAge)) {
            self::fail();
        }
        $result = ['field' => $field, 'operator' => $operator];
        if ($operator !== 'reported_none') {
            $value = $input['value'];
            if ($numeric) {
                $values = $operator === 'between' ? $value : [$value];
                if (! is_array($values) || ! array_is_list($values) || count($values) !== ($operator === 'between' ? 2 : 1)) {
                    self::fail();
                }
                $scaled = [];
                $canonical = [];
                foreach ($values as $item) {
                    $quantity = $field === 'age_years'
                        ? (is_int($item) && $item >= 0 && $item <= 150 ? $item : null)
                        : self::hundredths($item, self::LIMITS[$field]);
                    if ($quantity === null) {
                        self::fail();
                    }
                    $scaled[] = $quantity;
                    $canonical[] = $field === 'age_years' ? $quantity : intdiv($quantity, 100).'.'.str_pad((string) ($quantity % 100), 2, '0', STR_PAD_LEFT);
                }
                if ($operator === 'between' && $scaled[0] > $scaled[1]) {
                    self::fail();
                }
                $value = $operator === 'between' ? $canonical : $canonical[0];
            } elseif (! is_string($value) || ! in_array($value, $coded ? self::codes($field) : ($field === 'gender' ? ['male', 'female'] : ['yes', 'no']), true)) {
                self::fail();
            }
            $result['value'] = $value;
        }
        if (isset(self::LIMITS[$field])) {
            $unit = ['weight_kg' => 'kg', 'height_cm' => 'cm', 'bmi' => 'kg/m2'][$field];
            if ($input['unit'] !== $unit) {
                self::fail();
            }
            $result['unit'] = $unit;
        }
        $result['max_age_days'] = $maximumAge;
        if ($field === 'bmi') {
            if (! self::days($input['max_measurement_gap_days'])) {
                self::fail();
            }
            $result['max_measurement_gap_days'] = $input['max_measurement_gap_days'];
        }

        return $result;
    }

    private static function days(mixed $value): bool
    {
        return is_int($value) && $value >= 0 && $value <= 3650;
    }

    private static function keys(#[SensitiveParameter] array $input, array $required, array $optional = []): void
    {
        if (array_diff($required, array_keys($input)) || array_diff(array_keys($input), [...$required, ...$optional])) {
            self::fail();
        }
    }

    private static function fail(): never
    {
        throw new InvalidArgumentException('Invalid recommendation condition definition.');
    }
}
