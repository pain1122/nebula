<?php

namespace Checkupino\Acceptance\Recommendations;

use App\Models\DoctorProfile;
use App\Models\User;
use App\Services\Recommendations\RecommendationAdministration;
use App\Services\Recommendations\RecommendationAuthority;
use App\Services\Recommendations\RecommendationContent;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class CrossIntegrityAssertion extends RuntimeException {}

/** Synthetic integrity/clock protocols shared by offline smoke and admitted MySQL, never bootstraps an app. */
final class CrossModuleIntegrity
{
    public const TABLES = ['recommendation_catalog_state', 'recommendation_rules', 'recommendation_rule_versions',
        'recommendation_rule_version_targets', 'recommendation_rule_reviews', 'recommendation_reviewer_grants',
        'articles', 'article_versions', 'article_version_terms', 'audit_events', 'patient_health_snapshots', 'patient_biometric_observations'];

    public static function ensure(bool $valid, string $message): void
    {
        if (! $valid) {
            throw new CrossIntegrityAssertion($message);
        }
    }

    public static function rows(string $table): array
    {
        return DB::table($table)->orderBy('id')->get()->map(fn ($row) => hash('sha256', json_encode($row, JSON_THROW_ON_ERROR)))->all();
    }

    public static function snapshot(): array
    {
        return array_combine(self::TABLES, array_map(fn ($table) => self::rows($table), self::TABLES));
    }

    private static function fixture(string $name, string $mode = 'published'): array
    {
        return CrossModuleFixture::build(['name' => $name, 'mode' => $mode, 'leader' => 'match', 'follower' => 'match']);
    }

    private static function rejectsForeignKey(callable $operation): void
    {
        $before = self::snapshot();
        $refused = false;
        try {
            DB::transaction($operation);
        } catch (QueryException $error) {
            $refused = config('database.default') === 'mysql'
                ? ($error->errorInfo[0] ?? null) === '23000' && (int) ($error->errorInfo[1] ?? 0) === 1452
                : (int) ($error->errorInfo[1] ?? 0) === 19 && str_contains($error->getMessage(), 'FOREIGN KEY constraint failed');
        }
        self::ensure($refused && self::snapshot() === $before, 'Invalid link must fail its native foreign key without row changes.');
    }

    public static function foreignKeys(): array
    {
        $a = self::fixture('foreign_key_primary');
        $b = self::fixture('foreign_key_secondary');
        $rule = DB::table('recommendation_rules')->where('public_id', $a['rule'])->first();
        $otherRule = DB::table('recommendation_rules')->where('public_id', $b['rule'])->first();
        $article = DB::table('articles')->where('public_id', $b['article'])->first();
        $version = DB::table('recommendation_rule_versions')->where('rule_id', $rule->id)->where('version', 1)->first();
        $grant = DB::table('recommendation_reviewer_grants')->where('public_id', $a['grant'])->first();
        $target = ['rule_id' => $rule->id, 'rule_version' => 1, 'article_id' => $article->id, 'article_version' => 1, 'content_hash' => $version->content_hash];
        self::rejectsForeignKey(fn () => DB::table('recommendation_rule_version_targets')->insert([...$target, 'rule_version' => 999999]));
        self::rejectsForeignKey(fn () => DB::table('recommendation_rule_version_targets')->insert([...$target, 'article_version' => 999999]));
        $review = ['public_id' => strtolower((string) Str::ulid()), 'rule_id' => $rule->id, 'rule_version' => 1,
            'reviewer_grant_id' => $grant->id, 'reviewer_user_id' => $a['doctor'], 'outcome' => 'rejected',
            'content_hash' => $version->content_hash, 'assessment' => 'Synthetic invalid link; must never commit.',
            'valid_until' => now()->addDay(), 'action_key' => (string) Str::uuid(), 'recorded_at' => now()];
        self::rejectsForeignKey(fn () => DB::table('recommendation_rule_reviews')->insert([...$review, 'rule_version' => 999999]));
        self::rejectsForeignKey(fn () => DB::table('recommendation_rule_reviews')->insert([...$review, 'reviewer_user_id' => $b['doctor']]));
        self::rejectsForeignKey(fn () => DB::table('recommendation_rules')->where('id', $rule->id)->update(['published_review_id' => $otherRule->published_review_id]));
        $old = self::snapshot();
        $otherReview = DB::table('recommendation_rule_reviews')->where('id', $otherRule->published_review_id)->first();
        $view = app(RecommendationAdministration::class)->read(CrossModuleFixture::request(User::findOrFail($a['doctor'])), $a['rule']);
        $refusal = CrossModuleFixture::run(User::findOrFail($a['doctor']), 'review_withdraw', $a,
            ['action' => 'withdraw', 'expected_revision' => $view['contexts']['withdraw'], 'action_key' => (string) Str::uuid(),
                'review_id' => $otherReview->public_id, 'assessment' => 'Synthetic cross-rule attempt must fail.']);
        self::ensure($refusal['outcome'] === 'conflict' && self::snapshot() === $old, 'Cross-rule withdrawal must be refused without writes.');
        $snapshot = app(RecommendationContent::class)->snapshot($version);
        self::ensure(hash_equals($snapshot['content_hash'], $version->content_hash), 'Native JSON must preserve the complete canonical hash.');
        $downRefused = false;
        try {
            (require database_path('migrations/2026_11_05_000001_create_recommendation_rule_tables.php'))->down();
        } catch (RuntimeException $error) {
            $downRefused = str_contains($error->getMessage(), 'retain tables');
        }
        self::ensure($downRefused && self::snapshot() === $old, 'Populated rollback must refuse before any DDL/data change.');
        CrossModuleFixture::retire($a);
        CrossModuleFixture::retire($b);

        return ['foreign_key_refusals' => 5, 'cross_rule_withdrawal_refused' => true, 'canonical_json_verified' => true, 'populated_rollback_refused' => true];
    }

    public static function temporal(): array
    {
        $a = self::fixture('grant_expiry', 'assigned');
        $doctor = User::findOrFail($a['doctor']);
        $view = app(RecommendationAdministration::class)->read(CrossModuleFixture::request($doctor), $a['rule']);
        $body = ['action' => 'approve', 'expected_revision' => $view['contexts']['approve'], 'action_key' => (string) Str::uuid(),
            'assessment' => 'Synthetic pending approval.', 'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(45)->format('Y-m-d\TH:i')];
        $until = DB::table('recommendation_reviewer_grants')->where('public_id', $a['grant'])->value('valid_until');
        $before = self::snapshot();
        try {
            Carbon::setTestNow(Carbon::parse($until, 'UTC'));
            $result = CrossModuleFixture::run($doctor, 'approve', $a, $body);
            self::ensure($result === ['outcome' => 'forbidden', 'health_reads' => 0] && self::snapshot() === $before, 'Expired designation must refuse approval without writes.');
        } finally {
            Carbon::setTestNow();
        }
        CrossModuleFixture::retire($a);
        $b = self::fixture('review_expiry');
        $until = DB::table('recommendation_rule_reviews')->where('rule_id', DB::table('recommendation_rules')->where('public_id', $b['rule'])->value('id'))->value('valid_until');
        $before = self::snapshot();
        try {
            Carbon::setTestNow(Carbon::parse($until, 'UTC'));
            self::ensure(app(RecommendationAuthority::class)->grant($b['doctor']) !== null, 'Designation must still be current for independent review-expiry check.');
            self::ensure(CrossModuleFixture::owner($b) === ['outcome' => 'unavailable', 'health_reads' => 0] && self::snapshot() === $before, 'Expired review must stop before private health read.');
        } finally {
            Carbon::setTestNow();
        }
        CrossModuleFixture::retire($b);
        $c = self::fixture('health_variants');
        $states = [];
        foreach (['unknown', 'no', null, 'yes'] as $answer) {
            CrossModuleFixture::health(User::findOrFail($c['patient']), $answer);
            $result = CrossModuleFixture::owner($c);
            self::ensure($result['health_reads'] === 1, 'Eligible owner projection must use the real health service exactly once.');
            $states[] = $result['outcome'];
        }
        try {
            Carbon::setTestNow(now()->addDays(31));
            $view = app(RecommendationAdministration::class)->read(CrossModuleFixture::request(User::findOrFail($c['admin'])), $c['rule']);
            self::ensure($view['publication_eligible'], 'Review and designation must remain valid during stale-health check.');
            $states[] = CrossModuleFixture::owner($c)['outcome'];
        } finally {
            Carbon::setTestNow();
        }
        self::ensure($states === ['insufficient_information', 'no_matches', 'insufficient_information', 'matched', 'insufficient_information'], 'Unknown, negative, cleared, restored and stale health must remain distinct.');
        CrossModuleFixture::retire($c);

        return ['grant_expiry_refused' => true, 'review_expiry_no_health_read' => true, 'health_variant_states_verified' => true];
    }

    public static function replacement(): array
    {
        $a = self::fixture('independent_review_replacement');
        $ruleId = DB::table('recommendation_rules')->where('public_id', $a['rule'])->value('id');
        $old = DB::table('recommendation_rule_reviews')->where('rule_id', $ruleId)->first();
        $other = User::factory()->doctor()->create()->fresh();
        DoctorProfile::factory()->create(['user_id' => $other->id, 'verified' => true]);
        CrossModuleFixture::grant(User::findOrFail($a['root']), $other);
        CrossModuleFixture::action(User::findOrFail($a['admin']), $a['rule'], 'submit', ['reviewer_id' => $other->public_id]);
        CrossModuleFixture::action($other, $a['rule'], 'approve', ['assessment' => 'Second synthetic independent software assessment.',
            'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(45)->format('Y-m-d\TH:i')]);
        CrossModuleFixture::action(User::findOrFail($a['admin']), $a['rule'], 'publish');
        $current = DB::table('recommendation_rule_reviews')->where('rule_id', $ruleId)->where('reviewer_user_id', $other->id)->first();
        CrossModuleFixture::action(User::findOrFail($a['doctor']), $a['rule'], 'withdraw', ['assessment' => 'Withdraw my earlier synthetic approval only.', 'review_id' => $old->public_id]);
        self::ensure(CrossModuleFixture::owner($a) === ['outcome' => 'matched', 'health_reads' => 1], 'An old review withdrawal cannot cancel a different current approval.');
        CrossModuleFixture::action($other, $a['rule'], 'withdraw', ['assessment' => 'Withdraw current synthetic approval.', 'review_id' => $current->public_id]);
        self::ensure(CrossModuleFixture::owner($a) === ['outcome' => 'unavailable', 'health_reads' => 0], 'Current approval withdrawal must not fall back to old reviews.');
        self::ensure((array) DB::table('recommendation_rule_reviews')->find($old->id) === (array) $old
            && (array) DB::table('recommendation_rule_reviews')->find($current->id) === (array) $current, 'Original review rows must remain immutable.');
        CrossModuleFixture::retire($a);

        return ['old_review_withdrawal_preserves_current' => true, 'current_review_withdrawal_no_fallback' => true, 'original_reviews_immutable' => true];
    }
}
