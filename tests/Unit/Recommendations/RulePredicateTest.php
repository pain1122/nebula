<?php

namespace Tests\Unit\Recommendations;

use App\Services\Health\HealthCatalog;
use App\Services\Recommendations\PredicateOutcome;
use App\Services\Recommendations\RuleCondition;
use App\Services\Recommendations\RulePredicateEvaluator;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Invented software fixtures; no clinical criteria, application bootstrap or patient data. */
class RulePredicateTest extends TestCase
{
    private static function leaf(string $field = 'smoking', string $operator = 'eq', mixed $value = 'yes'): array
    {
        $node = ['field' => $field, 'operator' => $operator, 'max_age_days' => in_array($field, ['age_years', 'gender'], true) ? null : 30];
        if ($operator !== 'reported_none') {
            $node['value'] = $value;
        }
        if (isset(RuleCondition::LIMITS[$field])) {
            $node['unit'] = ['weight_kg' => 'kg', 'height_cm' => 'cm', 'bmi' => 'kg/m2'][$field];
        }
        if ($field === 'bmi') {
            $node['max_measurement_gap_days'] = 0;
        }

        return $node;
    }

    private static function definition(?array $node = null, ?array $exclude = null): array
    {
        return ['schema_version' => 1, 'health_catalog_version' => HealthCatalog::VERSION,
            'include' => $node ?? self::leaf(), 'exclude' => $exclude];
    }

    private static function health(): array
    {
        $fact = fn ($value): array => ['value' => $value, 'source' => 'self_report', 'asserted_at' => '2026-11-04T09:00:00+03:30'];
        $measurement = fn ($metric, $value, $unit): array => ['metric' => $metric, 'value' => $value, 'unit' => $unit,
            'source' => 'self_report', 'measured_on' => '2026-11-04', 'recorded_at' => '2026-11-04T09:00:00+03:30'];

        return ['health_catalog_version' => HealthCatalog::VERSION,
            'provenance' => ['birth_date' => $fact('2000-11-05'), 'gender' => $fact('female'), 'smoking' => $fact('yes'),
                'alcohol' => $fact('no'), 'conditions' => $fact(['status' => 'yes', 'codes' => ['condition.hypertension']]),
                'allergies' => $fact(['status' => 'no', 'codes' => []])],
            'measurements' => ['weight' => $measurement('weight', '70.00', 'kg'), 'height' => $measurement('height', '175.00', 'cm')]];
    }

    private function outcome(array $definition, ?array $health = null, string $instant = '2026-11-05T12:00:00+03:30'): PredicateOutcome
    {
        return (new RulePredicateEvaluator)->evaluate(RuleCondition::fromArray($definition), $health ?? self::health(), new DateTimeImmutable($instant));
    }

    public static function truthTable(): array
    {
        return [
            ['yes', 'yes', PredicateOutcome::Match, PredicateOutcome::Match],
            ['yes', 'no', PredicateOutcome::NoMatch, PredicateOutcome::Match],
            ['yes', 'unknown', PredicateOutcome::InsufficientData, PredicateOutcome::Match],
            ['no', 'yes', PredicateOutcome::NoMatch, PredicateOutcome::Match],
            ['no', 'no', PredicateOutcome::NoMatch, PredicateOutcome::NoMatch],
            ['no', 'unknown', PredicateOutcome::NoMatch, PredicateOutcome::InsufficientData],
            ['unknown', 'yes', PredicateOutcome::InsufficientData, PredicateOutcome::Match],
            ['unknown', 'no', PredicateOutcome::NoMatch, PredicateOutcome::InsufficientData],
            ['unknown', 'unknown', PredicateOutcome::InsufficientData, PredicateOutcome::InsufficientData],
        ];
    }

    #[DataProvider('truthTable')]
    public function test_all_and_any_preserve_unknowns_without_requesting_irrelevant_data(string $a, string $b, PredicateOutcome $all, PredicateOutcome $any): void
    {
        $health = self::health();
        $health['provenance']['smoking']['value'] = $a;
        $health['provenance']['alcohol']['value'] = $b;
        $children = [self::leaf(), self::leaf('alcohol')];
        $this->assertSame($all, $this->outcome(self::definition(['all' => $children]), $health));
        $this->assertSame($any, $this->outcome(self::definition(['any' => $children]), $health));
    }

    public function test_unknown_exclusions_block_matches_and_explicit_exclusions_win(): void
    {
        $exclude = self::leaf('allergies', 'contains', 'allergy.latex');
        $health = self::health();
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition(exclude: $exclude), $health));
        foreach ([['status' => 'unknown', 'codes' => []], ['status' => 'declined', 'codes' => []],
            ['status' => 'yes', 'codes' => ['allergy.penicillin']], ['status' => 'yes', 'codes' => []]] as $value) {
            $health['provenance']['allergies']['value'] = $value;
            $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(exclude: $exclude), $health));
        }
        $health['provenance']['allergies']['value'] = ['status' => 'yes', 'codes' => ['allergy.latex']];
        $this->assertSame(PredicateOutcome::Excluded, $this->outcome(self::definition(exclude: $exclude), $health));
        unset($health['provenance']['smoking']);
        $this->assertSame(PredicateOutcome::Excluded, $this->outcome(self::definition(exclude: $exclude), $health));
    }

    public function test_reported_none_does_not_mean_missing_or_an_unselected_code(): void
    {
        $none = self::definition(self::leaf('conditions', 'reported_none'));
        $contains = self::definition(self::leaf('conditions', 'contains', 'condition.diabetes'));
        $health = self::health();
        $this->assertSame(PredicateOutcome::NoMatch, $this->outcome($none, $health));
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome($contains, $health));
        $health['provenance']['conditions']['value'] = ['status' => 'no', 'codes' => []];
        $this->assertSame(PredicateOutcome::Match, $this->outcome($none, $health));
        $this->assertSame(PredicateOutcome::NoMatch, $this->outcome($contains, $health));
        $health['provenance']['conditions']['value'] = null;
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome($none, $health));
    }

    public static function unusableFacts(): array
    {
        return [['unknown'], ['declined'], [null], [false], ['no '], [0], [['value' => 'no']], [new \stdClass]];
    }

    #[DataProvider('unusableFacts')]
    public function test_unknown_cleared_and_malformed_values_never_satisfy_negative_rules(mixed $value): void
    {
        $health = self::health();
        $health['provenance']['smoking']['value'] = $value;
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(self::leaf(value: 'no')), $health));
    }

    public function test_birthdays_use_health_birth_date_and_tehran_calendar(): void
    {
        $rule = self::definition(self::leaf('age_years', 'gte', 26));
        $this->assertSame(PredicateOutcome::NoMatch, $this->outcome($rule, instant: '2026-11-04T20:29:59Z'));
        $this->assertSame(PredicateOutcome::Match, $this->outcome($rule, instant: '2026-11-04T20:30:00Z'));
        $health = self::health();
        unset($health['provenance']['birth_date']);
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome($rule, $health));
    }

    public function test_leap_birthdays_and_invalid_calendar_dates(): void
    {
        $health = self::health();
        $health['provenance']['birth_date']['value'] = '2004-02-29';
        $health['provenance']['birth_date']['asserted_at'] = '2025-02-01T00:00:00Z';
        $rule = self::definition(self::leaf('age_years', 'gte', 21));
        $this->assertSame(PredicateOutcome::NoMatch, $this->outcome($rule, $health, '2025-02-28T12:00:00+03:30'));
        $this->assertSame(PredicateOutcome::Match, $this->outcome($rule, $health, '2025-03-01T12:00:00+03:30'));
        foreach (['2026-02-30', '2028-01-01', 'next Monday'] as $invalid) {
            $health['provenance']['birth_date']['value'] = $invalid;
            $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome($rule, $health));
        }
    }

    public function test_an_impossible_birth_date_does_not_become_valid_as_the_clock_advances(): void
    {
        $health = self::health();
        $health['provenance']['birth_date']['value'] = '2027-01-01';
        $this->assertSame(PredicateOutcome::InsufficientData,
            $this->outcome(self::definition(self::leaf('age_years', 'gte', 0)), $health, '2029-01-01T12:00:00+03:30'));
    }

    public function test_measurement_age_is_inclusive_in_tehran_and_uses_measurement_date(): void
    {
        $node = self::leaf('weight_kg', 'eq', '70');
        $node['max_age_days'] = 1;
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition($node), instant: '2026-11-05T20:29:59Z'));
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition($node), instant: '2026-11-05T20:30:00Z'));
        $health = self::health();
        $health['measurements']['weight']['recorded_at'] = '2026-11-05T09:00:00+03:30';
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition($node), $health, '2026-11-06T12:00:00+03:30'));
    }

    public static function unusableMeasurements(): array
    {
        return [['unit', 'lb'], ['metric', 'height'], ['source', 'clinician_verified'], ['value', 70.0], ['value', '-1'],
            ['value', '1000.01'], ['measured_on', '2026-11-06'], ['measured_on', '2026-02-30'],
            ['recorded_at', '2026-11-05T13:00:00+03:30'], ['recorded_at', '2026-11-03T09:00:00+03:30'],
            ['recorded_at', 'yesterday']];
    }

    #[DataProvider('unusableMeasurements')]
    public function test_invalid_units_dates_quantities_and_provenance_are_not_usable(string $field, mixed $value): void
    {
        $health = self::health();
        $health['measurements']['weight'][$field] = $value;
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(self::leaf('weight_kg', 'gte', '1')), $health));
    }

    public function test_bmi_uses_unrounded_rational_comparisons_and_both_measurement_dates(): void
    {
        $this->assertSame(PredicateOutcome::NoMatch, $this->outcome(self::definition(self::leaf('bmi', 'gte', '22.86'))));
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition(self::leaf('bmi', 'gte', '22.85'))));
        $this->assertSame(PredicateOutcome::NoMatch, $this->outcome(self::definition(self::leaf('bmi', 'eq', '22.86'))));
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition(self::leaf('bmi', 'between', ['22.85', '22.86']))));
        $health = self::health();
        $health['measurements']['height']['measured_on'] = '2026-11-01';
        $node = self::leaf('bmi', 'gte', '1');
        $node['max_measurement_gap_days'] = 2;
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition($node), $health));
        $node['max_measurement_gap_days'] = 3;
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition($node), $health));
        unset($health['measurements']['weight']);
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition($node), $health));
    }

    public function test_representation_extremes_do_not_overflow_or_round(): void
    {
        $health = self::health();
        $health['measurements']['weight']['value'] = '1000.00';
        $health['measurements']['height']['value'] = '0.01';
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition(self::leaf('bmi', 'gt', '999.99')), $health));
    }

    public function test_numeric_ranges_are_inclusive_and_exact(): void
    {
        foreach (['eq' => '70', 'lte' => '70.00', 'gte' => '70.00', 'between' => ['69.99', '70.00']] as $operator => $value) {
            $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition(self::leaf('weight_kg', $operator, $value))));
        }
        foreach (['lt', 'gt'] as $operator) {
            $this->assertSame(PredicateOutcome::NoMatch, $this->outcome(self::definition(self::leaf('weight_kg', $operator, '70.00'))));
        }
    }

    public function test_future_or_invalid_assertions_and_catalog_drift_fail_closed(): void
    {
        foreach (['2026-11-05T13:00:00+03:30', '2026-02-30T00:00:00Z', 'now',
            '2026-11-04T00:00:00+25:00', '2026-11-04T00:00:00+03:99', '2026-11-04T25:00:00Z'] as $invalid) {
            $health = self::health();
            $health['provenance']['gender']['asserted_at'] = $invalid;
            $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(self::leaf('gender', 'eq', 'female')), $health));
        }
        $health = self::health();
        $health['health_catalog_version'] = 'future-private-catalog';
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(), $health));
        $health = self::health();
        $health['owner_id'] = 'untrusted-owner-selector';
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(), $health));
    }

    public function test_fact_freshness_is_explicit_and_zero_days_means_today_only(): void
    {
        $node = self::leaf();
        $node['max_age_days'] = 0;
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition($node), instant: '2026-11-04T12:00:00+03:30'));
        $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition($node)));
        $node['max_age_days'] = 1;
        $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition($node)));
    }

    public function test_explicit_positive_codes_and_selected_reported_values_match(): void
    {
        foreach ([self::leaf('conditions', 'contains', 'condition.hypertension'), self::leaf('allergies', 'reported_none'),
            self::leaf('gender', 'eq', 'female'), self::leaf('height_cm', 'eq', '175'), self::leaf('age_years', 'eq', 26)] as $node) {
            $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition($node)));
        }
        foreach (['low_activity', 'stress', 'family_history'] as $field) {
            $health = self::health();
            $health['provenance'][$field] = $health['provenance']['alcohol'];
            $this->assertSame(PredicateOutcome::Match, $this->outcome(self::definition(self::leaf($field, 'eq', 'no')), $health));
        }
    }

    public function test_contradictory_or_wrong_kind_code_sets_are_unknown(): void
    {
        foreach ([['status' => 'no', 'codes' => ['condition.hypertension']],
            ['status' => 'yes', 'codes' => ['allergy.latex']],
            ['status' => 'yes', 'codes' => ['condition.hypertension', 'condition.hypertension']]] as $value) {
            $health = self::health();
            $health['provenance']['conditions']['value'] = $value;
            $this->assertSame(PredicateOutcome::InsufficientData, $this->outcome(self::definition(self::leaf('conditions', 'contains', 'condition.hypertension')), $health));
        }
    }

    public function test_canonical_definition_hash_ignores_object_key_order_and_decimal_spelling(): void
    {
        $first = RuleCondition::fromArray(self::definition(self::leaf('weight_kg', 'eq', '70')));
        $second = RuleCondition::fromArray(array_reverse(self::definition(array_reverse(self::leaf('weight_kg', 'eq', '70.00'), true)), true));
        $this->assertSame($first->hash(), $second->hash());
        $this->assertSame(hash('sha256', json_encode(['evaluator_version' => RuleCondition::EVALUATOR_VERSION, ...$first->definition()], JSON_THROW_ON_ERROR)), $first->hash());
        $copy = $first->definition();
        $copy['include']['value'] = '71.00';
        $this->assertNotSame(RuleCondition::fromArray($copy)->hash(), $first->hash());
        $this->assertSame('70.00', $first->definition()['include']['value']);
    }

    public static function invalidDefinitions(): array
    {
        $base = self::definition();
        $cases = [array_replace($base, ['schema_version' => 2]), array_replace($base, ['health_catalog_version' => 'future']),
            $base + ['patient_id' => 'private'], self::definition(['all' => []]), self::definition(['all' => array_fill(0, 9, self::leaf())]),
            self::definition(['all' => [self::leaf()], 'any' => [self::leaf()]]), self::definition(self::leaf('password')),
            self::definition(self::leaf(operator: 'eval', value: 'private-patient-value')),
            self::definition(self::leaf('conditions', 'not_contains', 'condition.diabetes')),
            self::definition(self::leaf('conditions', 'contains', 'allergy.latex')), self::definition(self::leaf('smoking', 'eq', 'unknown')),
            self::definition(self::leaf('age_years', 'gte', '26')), self::definition(self::leaf('weight_kg', 'eq', 70)),
            self::definition(self::leaf('weight_kg', 'eq', '70e0')), self::definition(self::leaf('weight_kg', 'between', ['71', '70'])),
            self::definition(self::leaf('weight_kg', 'between', ['70', '71', '72'])),
            self::definition(self::leaf() + ['script' => 'private-patient-value'])];
        foreach ([['max_age_days', null], ['max_age_days', -1], ['max_age_days', 3651], ['max_age_days', '30']] as [$key, $value]) {
            $cases[] = self::definition(array_replace(self::leaf(), [$key => $value]));
        }
        $cases[] = self::definition(array_replace(self::leaf('weight_kg', 'eq', '70'), ['unit' => 'lb']));
        $bmi = self::leaf('bmi', 'gte', '1');
        unset($bmi['max_measurement_gap_days']);
        $cases[] = self::definition($bmi);
        $cases[] = self::definition(['all' => [['all' => [['all' => [['all' => [self::leaf()]]]]]]]]);

        return array_map(fn ($case): array => [$case], $cases);
    }

    #[DataProvider('invalidDefinitions')]
    public function test_unsupported_or_unbounded_definitions_have_one_value_free_error(array $definition): void
    {
        try {
            RuleCondition::fromArray($definition);
            $this->fail('Invalid definition was accepted.');
        } catch (InvalidArgumentException $error) {
            $this->assertSame('Invalid recommendation condition definition.', $error->getMessage());
        }
    }

    public function test_total_node_budget_covers_include_and_exclusion_together(): void
    {
        $children = array_fill(0, 8, ['all' => array_fill(0, 7, self::leaf())]);
        array_pop($children[0]['all']);
        $this->assertSame(64, strlen(RuleCondition::fromArray(self::definition(['all' => $children]))->hash()));
        $this->expectException(InvalidArgumentException::class);
        RuleCondition::fromArray(self::definition(['all' => $children], self::leaf('alcohol')));
    }

    public function test_output_contains_only_predicate_state_and_does_not_mutate_inputs(): void
    {
        $health = self::health();
        $before = $health;
        $this->assertSame('"match"', json_encode($this->outcome(self::definition(), $health), JSON_THROW_ON_ERROR));
        $this->assertSame($before, $health);
        $this->assertCount(4, PredicateOutcome::cases());
    }

    public function test_component_exception_frames_redact_inputs_even_when_argument_tracing_is_enabled(): void
    {
        $previous = ini_get('zend.exception_ignore_args');
        ini_set('zend.exception_ignore_args', '0');
        try {
            foreach ([self::definition() + ['private-sentinel-key' => 'private-sentinel-value'],
                self::definition(self::leaf(operator: 'eval', value: 'private-sentinel-value'))] as $definition) {
                try {
                    RuleCondition::fromArray($definition);
                    $this->fail('Invalid input accepted.');
                } catch (InvalidArgumentException $error) {
                    $frames = array_filter($error->getTrace(), fn ($frame): bool => str_starts_with($frame['class'] ?? '', 'App\\Services\\Recommendations\\'));
                    $this->assertNotEmpty($frames);
                    $trace = print_r($frames, true);
                    $this->assertStringNotContainsString('private-sentinel-key', $trace);
                    $this->assertStringNotContainsString('private-sentinel-value', $trace);
                }
            }
        } finally {
            ini_set('zend.exception_ignore_args', $previous);
        }
    }
}
