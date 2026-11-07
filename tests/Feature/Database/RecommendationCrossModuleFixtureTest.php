<?php

namespace Tests\Feature\Database;

use App\Models\User;
use Checkupino\Acceptance\Recommendations\CrossModuleFixture as Fixture;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

/** Offline setup/serial semantic checks only; never real MySQL contention acceptance. */
class RecommendationCrossModuleFixtureTest extends TestCase
{
    use IsolatedArticleApplication;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        require_once base_path('scripts/recommendations/CrossModuleFixture.php');
        require_once base_path('scripts/recommendations/CrossModuleIntegrity.php');
        require_once base_path('scripts/recommendations/CrossModuleAnchor.php');
        config(['recommendations.authoring_enabled' => true, 'recommendations.enabled' => true,
            'article_content.enabled' => true, 'patient_health.enabled' => true, 'session.driver' => 'database', 'session.connection' => null]);
        app('session')->forgetDrivers();
        app('auth')->forgetGuards();
        Fixture::installObserver();
    }

    public static function cases(): array
    {
        $matrix = json_decode(file_get_contents(dirname(__DIR__, 3).'/scripts/recommendations/cross-module-cases.json'), true, flags: JSON_THROW_ON_ERROR);

        return array_combine(array_column($matrix, 'name'), array_map(fn ($case) => [$case], $matrix));
    }

    public function test_negative_links_and_populated_rollback_fixture(): void
    {
        $result = \Checkupino\Acceptance\Recommendations\CrossModuleIntegrity::foreignKeys();
        $this->assertSame(5, $result['foreign_key_refusals']);
        $this->assertTrue($result['cross_rule_withdrawal_refused']);
        $this->assertTrue($result['canonical_json_verified']);
        $this->assertTrue($result['populated_rollback_refused']);
    }

    public function test_lock_observation_matches_the_target_and_rejects_unlocked_or_other_actor_queries(): void
    {
        $anchor = \Checkupino\Acceptance\Recommendations\CrossModuleAnchor::class;
        $this->assertTrue($anchor::matches('select * from `article_catalog_state` where `id` = ? for update', [1], ['anchor' => 'article']));
        $this->assertTrue($anchor::matches('select * from `article_catalog_state` where `id` = ? lock in share mode', [1], ['anchor' => 'article']));
        $this->assertTrue($anchor::matches('select * from `recommendation_catalog_state` for share', [], ['anchor' => 'rule']));
        $this->assertTrue($anchor::matches('select * from `doctor_profiles` where `id` = ? for update', ['synthetic-profile'], ['anchor' => 'profile']));
        $this->assertTrue($anchor::matches('select `id` from `doctor_profiles` where `user_id` = ? lock in share mode', [12], ['anchor' => 'profile']));
        $this->assertTrue($anchor::matches('select * from `users` where `id` = ? for update', ['12'], ['anchor' => 'doctor', 'doctor' => 12]));
        $this->assertFalse($anchor::matches('select * from `users` where `id` = ? for update', [2], ['anchor' => 'doctor', 'doctor' => 12]));
        $this->assertFalse($anchor::matches('select * from `users` where `id` = ?', [12], ['anchor' => 'doctor', 'doctor' => 12]));
        $this->assertFalse($anchor::matches('select * from `roles` for update', [12], ['anchor' => 'doctor', 'doctor' => 12]));
        $this->assertFalse($anchor::matches('select * from `users` for update', [12], ['anchor' => 'unsupported', 'unsupported' => 12]));
    }

    public function test_clock_expiry_and_unknown_cleared_stale_health_fixtures(): void
    {
        $result = \Checkupino\Acceptance\Recommendations\CrossModuleIntegrity::temporal();
        $this->assertSame(['grant_expiry_refused' => true, 'review_expiry_no_health_read' => true, 'health_variant_states_verified' => true], $result);
    }

    public function test_exact_review_replacement_fixture(): void
    {
        $result = \Checkupino\Acceptance\Recommendations\CrossModuleIntegrity::replacement();
        $this->assertSame(['old_review_withdrawal_preserves_current' => true, 'current_review_withdrawal_no_fallback' => true, 'original_reviews_immutable' => true], $result);
    }

    #[DataProvider('cases')]
    public function test_fixture_and_serial_outcomes_are_valid_before_mysql(array $case): void
    {
        $fixture = Fixture::build($case);
        $before = ['audits' => DB::table('audit_events')->count(), 'article' => (int) DB::table('article_catalog_state')->value('revision'),
            'rule' => (int) DB::table('recommendation_catalog_state')->value('revision'), 'health' => DB::table('patient_health_snapshots')->count(),
            'reviews' => DB::table('recommendation_rule_reviews')->count()];
        $outcomes = [];
        foreach (['leader', 'follower'] as $side) {
            $refuseAudit = $side === 'leader' && ($case['audit_failure'] ?? false);
            if ($refuseAudit) {
                \App\Models\AuditEvent::creating(function () use (&$refuseAudit): void {
                    if ($refuseAudit) {
                        throw new \Checkupino\Acceptance\Recommendations\CrossAuditRefusal('Synthetic late audit refusal.');
                    }
                });
            }
            try {
                $result = Fixture::run(User::findOrFail($fixture[$side.'_actor']), $fixture[$side], $fixture, $fixture[$side.'_body']);
            } finally {
                $refuseAudit = false;
            }
            $outcomes[] = $result['outcome'];
            if ($fixture[$side] === 'match') {
                $this->assertSame(in_array($result['outcome'], ['matched', 'no_matches', 'insufficient_information'], true) ? 1 : 0, $result['health_reads']);
            }
        }
        $this->assertSame($case['expected'], $outcomes);
        $this->assertSame($before['audits'] + $case['audits'], DB::table('audit_events')->count());
        $this->assertSame($before['article'] + $case['article_revision'], (int) DB::table('article_catalog_state')->value('revision'));
        $this->assertSame($before['rule'] + $case['rule_revision'], (int) DB::table('recommendation_catalog_state')->value('revision'));
        $this->assertSame($before['health'] + $case['health_versions'], DB::table('patient_health_snapshots')->count());
        $this->assertSame($before['reviews'] + $case['reviews'], DB::table('recommendation_rule_reviews')->count());
        $this->assertSame(['outcome' => $case['post_state'], 'health_reads' => $case['post_health_reads']], Fixture::owner($fixture));
        Fixture::retire($fixture);
        $this->assertDatabaseCount('jobs', 0);
    }
}
