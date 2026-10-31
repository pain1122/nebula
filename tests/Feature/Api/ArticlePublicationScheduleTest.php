<?php

namespace Tests\Feature\Api;

use App\Enums\AccountState;
use App\Models\AuditEvent;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Content\ArticleDuePublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\ArticleReadFixtures;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticlePublicationScheduleTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const BASE = '/api/admin/articles';

    private function signIn(?User $actor = null): User
    {
        $this->travelTo(now()->setDateTime(2026, 10, 23, 12, 0, 0)->utc());
        config(['article_content.enabled' => true, 'article_content.presentation_enabled' => true,
            'article_content.scheduling_enabled' => true, 'article_content.publisher_enabled' => true]);
        $actor ??= User::factory()->admin()->create();
        $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function draft(?string $id = null, string $local = '2026-10-24T15:30'): array
    {
        $context = $this->getJson(self::BASE.($id === null ? '' : '/'.$id).'/write-context')->assertOk()->json('data');

        return ['expected_revision' => $context['revision'], 'reason' => 'Synthetic scheduled educational draft', 'confirmed' => true,
            'slug' => $context['current']['slug'] ?? 'synthetic-scheduled-article',
            'translations' => ['en' => ['title' => 'Synthetic education', 'body_html' => '<p>Educational content.</p>', 'seo' => []]],
            'presentation' => ['publication' => ['local_time' => $local, 'timezone' => 'Asia/Tehran']]];
    }

    private function createReviewed(): array
    {
        $created = $this->postJson(self::BASE, $this->draft())->assertCreated()->json('data');
        foreach (['submit', 'review'] as $action) {
            $created = $this->editorial($created['id'], $action);
        }

        return $created;
    }

    private function editorial(string $id, string $action, ?array $source = null): array
    {
        $query = ['action' => $action] + ($source === null ? [] : ['source_version_id' => $source['id']]);
        $context = $this->getJson(self::BASE.'/'.$id.'/action-context?'.http_build_query($query))->assertOk()->json('data');

        return $this->postJson(self::BASE.'/'.$id.'/actions', ['action' => $action, 'expected_revision' => $context['revision'],
            'expected_version' => $context['current']['working']['version'], 'expected_hash' => $context['current']['working']['content_hash'],
            'reason' => 'Synthetic editorial action', 'confirmed' => true]
            + ($source === null ? [] : ['source_version_id' => $source['id'], 'source_hash' => $source['content_hash']]))->assertOk()->json('data');
    }

    private function scheduleBody(string $id, string $action = 'arm'): array
    {
        $context = $this->getJson(self::BASE.'/'.$id.'/schedule-context?action='.$action)->assertOk()->json('data');

        return ['action' => $action, 'expected_revision' => $context['revision'],
            'expected_version' => $context['current']['working']['version'], 'expected_hash' => $context['current']['working']['content_hash'],
            'reason' => 'Synthetic scheduling action', 'confirmed' => true];
    }

    private function arm(string $id): array
    {
        app(ArticleDuePublisher::class)->tick();

        return $this->postJson(self::BASE.'/'.$id.'/schedule-actions', $this->scheduleBody($id))->assertOk()->json('data.schedule');
    }

    private function due(): void
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-24T12:00:00Z'));
    }

    private function fingerprint(): string
    {
        $tables = ['articles', 'article_versions', 'article_catalog_state', 'article_publication_schedules', 'audit_events'];

        return hash('sha256', json_encode(array_map(fn ($table) => DB::table($table)->orderBy('id')->get()->all(), $tables), JSON_THROW_ON_ERROR));
    }

    public function test_direct_editor_publish_requires_no_password_or_confirmation_fields_and_keeps_ordinary_audits(): void
    {
        $this->signIn();
        $body = $this->draft() + ['intent' => 'publish'];
        unset($body['reason'], $body['confirmed']);
        $this->withSession(['auth.password_confirmed_at' => 0]);
        $article = $this->postJson(self::BASE, $body)->assertCreated()->json('data');
        $this->assertSame('published', $article['working_state']);
        $this->assertSame($article['working']['content_hash'], $article['published']['content_hash']);
        $this->assertSame(['admin.article.created', 'admin.article.submitted', 'admin.article.reviewed', 'admin.article.published'], AuditEvent::orderBy('id')->pluck('action')->all());
        $this->assertSame(0, session('auth.password_confirmed_at'));
    }

    public function test_direct_publish_does_not_remove_the_password_guard_from_archive_or_recovery(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $context = $this->getJson(self::BASE.'/'.$article['id'].'/action-context?action=publish')->assertOk()->json('data');
        $this->withSession(['auth.password_confirmed_at' => 0]);
        $this->postJson(self::BASE.'/'.$article['id'].'/actions', ['action' => 'publish', 'expected_revision' => $context['revision'],
            'expected_version' => $article['working']['version'], 'expected_hash' => $article['working']['content_hash']])->assertOk();
        $archive = $this->getJson(self::BASE.'/'.$article['id'].'/action-context?action=archive')->assertOk()->json('data');
        $this->postJson(self::BASE.'/'.$article['id'].'/actions', ['action' => 'archive', 'expected_revision' => $archive['revision'],
            'expected_version' => $article['working']['version'], 'expected_hash' => $article['working']['content_hash'],
            'confirmed' => true, 'reason' => 'Synthetic archive guard'])->assertStatus(423);
    }

    public function test_composer_publishes_in_one_confirmed_transaction_with_all_ordinary_audits(): void
    {
        $this->signIn();
        $body = $this->draft() + ['intent' => 'publish', 'editorial_confirmed' => true];
        $article = $this->postJson(self::BASE, $body)->assertCreated()->json('data');
        $this->assertSame('published', $article['working_state']);
        $this->assertSame($article['working']['content_hash'], $article['published']['content_hash']);
        $this->assertSame($article['working']['content_hash'], $article['review']['content_hash']);
        $this->assertSame(['admin.article.created', 'admin.article.submitted', 'admin.article.reviewed', 'admin.article.published'],
            AuditEvent::orderBy('id')->pluck('action')->all());
        $this->assertSame(1, DB::table('article_versions')->count());
        $this->assertSame(0, DB::table('article_publication_schedules')->count());
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_composer_publishes_unchanged_reviewed_version_without_an_extra_revision(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $body = $this->draft($article['id']) + ['intent' => 'publish', 'editorial_confirmed' => true];
        $published = $this->putJson(self::BASE.'/'.$article['id'], $body)->assertOk()->json('data');
        $this->assertSame($article['working']['id'], $published['published']['id']);
        $this->assertSame(1, DB::table('article_versions')->count());
        $this->assertSame(1, AuditEvent::where('action', 'admin.article.reviewed')->count());
    }

    public function test_composer_draft_intent_never_reviews_or_publishes(): void
    {
        $this->signIn();
        $article = $this->postJson(self::BASE, $this->draft() + ['intent' => 'draft'])->assertCreated()->json('data');
        $this->assertSame('draft', $article['working_state']);
        $this->assertNull($article['published']);
        $this->assertNull($article['review']);
        $this->assertSame(['admin.article.created'], AuditEvent::pluck('action')->all());
    }

    public function test_composer_rejects_negative_legacy_attestations_and_incomplete_content_before_commit(): void
    {
        $this->signIn();
        $body = $this->draft() + ['intent' => 'publish'];
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body + ['editorial_confirmed' => false])->assertUnprocessable();
        $body['editorial_confirmed'] = true;
        $body['translations']['en']['body_html'] = '<p></p>';
        $this->postJson(self::BASE, $body)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_composer_schedule_requires_actual_availability_and_returns_exact_binding(): void
    {
        $this->signIn();
        $body = $this->draft() + ['intent' => 'schedule', 'editorial_confirmed' => true];
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertServiceUnavailable();
        $this->assertSame($before, $this->fingerprint());
        app(ArticleDuePublisher::class)->tick();
        $article = $this->postJson(self::BASE, $body)->assertCreated()->json('data');
        $this->assertSame('reviewed', $article['working_state']);
        $this->assertNull($article['published']);
        $this->assertSame('armed', $article['schedule']['status']);
        $this->assertSame($article['id'], $article['schedule']['article_id']);
        $this->assertSame($article['working']['content_hash'], $article['schedule']['content_hash']);
        $this->assertSame('2026-10-24 12:00:00', $article['schedule']['publish_at']);
    }

    public function test_composer_audit_failure_rolls_back_content_review_and_publication_together(): void
    {
        $this->signIn();
        $body = $this->draft() + ['intent' => 'publish', 'editorial_confirmed' => true];
        $before = $this->fingerprint();
        $original = app(AuditLogger::class);
        $mock = \Mockery::mock(AuditLogger::class);
        $mock->shouldReceive('log')->andReturnUsing(function (...$args) use ($original) {
            if ($args[2] === 'admin.article.published') {
                throw new RuntimeException('Synthetic final publication audit failure');
            }

            return $original->log(...$args);
        });
        $this->app->instance(AuditLogger::class, $mock);
        $this->postJson(self::BASE, $body)->assertServiceUnavailable();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_composer_publish_works_on_unmigrated_legacy_runtime(): void
    {
        $this->signIn();
        config(['article_content.presentation_enabled' => false, 'article_content.scheduling_enabled' => false, 'article_content.publisher_enabled' => false]);
        (require database_path('migrations/2026_10_23_000001_create_article_scheduling_media_tables.php'))->down();
        $body = $this->draft() + ['intent' => 'publish', 'editorial_confirmed' => true];
        unset($body['presentation']);
        $this->postJson(self::BASE, $body)->assertCreated()->assertJsonPath('data.working_state', 'published');
        $this->assertFalse(Schema::hasColumn('article_versions', 'presentation'));
    }

    public function test_preference_is_versioned_recoverable_and_never_arms_on_save(): void
    {
        $this->signIn();
        $first = $this->postJson(self::BASE, $this->draft())->assertCreated()->json('data');
        $this->assertSame(3, $first['working']['schema_version']);
        $this->assertSame('2026-10-24T12:00:00Z', $first['working']['presentation']['publication']['publish_at']);
        $this->assertSame(['en'], $first['working']['publishable_languages']);
        $this->assertSame(0, DB::table('article_publication_schedules')->count());
        $stored = DB::table('article_versions')->first();
        $second = $this->putJson(self::BASE.'/'.$first['id'], $this->draft($first['id'], '2026-10-25T15:30'))->assertOk()->json('data');
        $this->assertNotSame($first['working']['content_hash'], $second['working']['content_hash']);
        $recovered = $this->editorial($first['id'], 'copy_version', $first['working']);
        $this->assertSame($first['working']['presentation'], $recovered['working']['presentation']);
        $this->assertSame($first['working']['content_hash'], $recovered['working']['content_hash']);
        $this->assertEquals($stored, DB::table('article_versions')->find($stored->id));
        $this->assertSame(0, DB::table('article_publication_schedules')->count());
        foreach (AuditEvent::all() as $event) {
            $this->assertArrayNotHasKey('presentation', $event->after);
        }
    }

    public function test_old_client_cannot_discard_presentation_and_unverified_media_is_refused(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $body = $this->draft($article['id']);
        unset($body['presentation']);
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$article['id'], $body)->assertConflict();
        $body = $this->draft($article['id']);
        $body['presentation']['thumbnail'] = ['id' => strtolower((string) Str::ulid()), 'status' => 'released'];
        $this->putJson(self::BASE.'/'.$article['id'], $body)->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_legacy_authoring_still_works_without_extension_or_flags(): void
    {
        $this->signIn();
        config(['article_content.presentation_enabled' => false, 'article_content.scheduling_enabled' => false]);
        (require database_path('migrations/2026_10_23_000001_create_article_scheduling_media_tables.php'))->down();
        $body = $this->draft();
        $this->postJson(self::BASE, $body)->assertServiceUnavailable();
        unset($body['presentation']);
        $article = $this->postJson(self::BASE, $body)->assertCreated()->json('data');
        $this->assertSame(2, $article['working']['schema_version']);
        $this->assertArrayNotHasKey('presentation', $article['working']);
        foreach (['submit', 'review', 'publish'] as $action) {
            $this->editorial($article['id'], $action);
        }
        $this->getJson(self::BASE.'/'.$article['id'].'/schedule-context?action=arm')->assertServiceUnavailable();
        $this->assertFalse(Schema::hasTable('article_publication_schedules'));
    }

    public function test_exact_due_delivery_is_idempotent_and_leaves_unrelated_jobs_untouched(): void
    {
        $this->signIn();
        DB::table('jobs')->insert(['queue' => 'unrelated', 'payload' => 'synthetic sentinel', 'attempts' => 0,
            'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
        $jobs = DB::table('jobs')->get()->toJson();
        $article = $this->createReviewed();
        $schedule = $this->arm($article['id']);
        $this->assertSame($article['working']['content_hash'], $schedule['content_hash']);
        $this->assertSame('armed', $schedule['status']);
        $this->assertSame(['published' => 0, 'blocked' => 0, 'skipped' => 0], app(ArticleDuePublisher::class)->tick());
        $this->due();
        $this->artisan('articles:publish-due', ['--limit' => '1'])->assertSuccessful();
        $this->getJson(self::BASE.'/'.$article['id'])->assertOk()->assertJsonPath('data.published.content_hash', $article['working']['content_hash']);
        $this->assertSame('published', DB::table('article_publication_schedules')->value('status'));
        $this->assertSame(1, AuditEvent::where('action', 'admin.article_schedule.published')->count());
        app(ArticleDuePublisher::class)->tick();
        $this->assertSame(1, AuditEvent::where('action', 'admin.article_schedule.published')->count());
        $this->assertSame($jobs, DB::table('jobs')->get()->toJson());
    }

    public function test_stale_context_wrong_hash_password_and_duplicate_arm_do_not_write(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        app(ArticleDuePublisher::class)->tick();
        $body = $this->scheduleBody($article['id']);
        $before = $this->fingerprint();
        $bad = $body;
        $bad['expected_hash'] = str_repeat('0', 64);
        $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $bad)->assertConflict();
        $this->withSession(['auth.password_confirmed_at' => 1])->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $body)->assertStatus(423);
        $this->assertSame($before, $this->fingerprint());
        $this->withSession(['auth.password_confirmed_at' => time()])->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $body)->assertOk();
        $before = $this->fingerprint();
        $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $body)->assertConflict();
        $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $this->scheduleBody($article['id']))->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_cancel_works_when_runner_stops_and_cannot_be_replayed(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $this->arm($article['id']);
        config(['article_content.publisher_enabled' => false]);
        $body = $this->scheduleBody($article['id'], 'cancel');
        $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $body)->assertOk()->assertJsonPath('data.schedule.status', 'cancelled');
        $before = $this->fingerprint();
        $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $body)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        config(['article_content.publisher_enabled' => true]);
        $this->due();
        $this->assertSame(0, app(ArticleDuePublisher::class)->tick()['published']);
        $this->assertNull(DB::table('articles')->value('published_version'));
    }

    public static function invalidations(): array
    {
        return [['draft_changed'], ['archived'], ['immediate_publication'], ['version_recovered']];
    }

    #[DataProvider('invalidations')]
    public function test_ordinary_content_changes_atomically_invalidate_old_schedules(string $kind): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        if ($kind === 'version_recovered') {
            $source = $article['working'];
            $this->putJson(self::BASE.'/'.$article['id'], $this->draft($article['id'], '2026-10-25T15:30'))->assertOk();
            $this->editorial($article['id'], 'submit');
            $this->editorial($article['id'], 'review');
        }
        $this->arm($article['id']);
        if ($kind === 'draft_changed') {
            $this->putJson(self::BASE.'/'.$article['id'], $this->draft($article['id'], '2026-10-25T15:30'))->assertOk();
        } else {
            $action = ['archived' => 'archive', 'immediate_publication' => 'publish', 'version_recovered' => 'copy_version'][$kind];
            $this->editorial($article['id'], $action, $source ?? null);
        }
        $this->assertSame('cancelled', DB::table('article_publication_schedules')->value('status'));
        $this->assertSame($kind, DB::table('article_publication_schedules')->value('blocker'));
        $this->assertSame(1, AuditEvent::where('action', 'admin.article_schedule.invalidated')->count());
        $this->due();
        $this->assertSame(0, app(ArticleDuePublisher::class)->tick()['published']);
    }

    public function test_reschedule_requires_new_version_and_new_review(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $first = $this->arm($article['id']);
        $edited = $this->putJson(self::BASE.'/'.$article['id'], $this->draft($article['id'], '2026-10-25T15:30'))->assertOk()->json('data');
        $this->getJson(self::BASE.'/'.$article['id'].'/schedule-context?action=arm')->assertOk()->assertJsonPath('data.eligible', false);
        foreach (['submit', 'review'] as $action) {
            $this->editorial($article['id'], $action);
        }
        $second = $this->arm($article['id']);
        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(2, $second['version']);
        $this->assertSame($edited['working']['content_hash'], $second['content_hash']);
        $this->assertSame(1, AuditEvent::where('action', 'admin.article_schedule.rescheduled')->count());
        $this->due();
        $this->assertSame(0, app(ArticleDuePublisher::class)->tick()['published']);
    }

    public static function revocations(): array
    {
        return [['scheduler_role'], ['scheduler_state'], ['reviewer_role'], ['reviewer_state'], ['stored_hash'], ['stored_time']];
    }

    #[DataProvider('revocations')]
    public function test_due_delivery_rechecks_current_authority_and_exact_content(string $kind): void
    {
        $reviewer = $this->signIn();
        $article = $this->createReviewed();
        $scheduler = User::factory()->admin()->create();
        $this->actingAs($scheduler);
        $this->arm($article['id']);
        $target = str_starts_with($kind, 'scheduler') ? $scheduler : $reviewer;
        if (str_ends_with($kind, '_role')) {
            $target->syncRoles(['patient']);
        } elseif (str_ends_with($kind, '_state')) {
            DB::table('users')->where('id', $target->id)->update(['account_state' => AccountState::Suspended->value]);
        } elseif ($kind === 'stored_hash') {
            DB::table('article_publication_schedules')->update(['content_hash' => str_repeat('0', 64)]);
        } else {
            DB::table('article_versions')->update(['presentation' => '{"publication":{"local_time":"2026-10-24T15:30","timezone":"Asia/Tehran","publish_at":"2026-10-24T11:00:00Z"},"thumbnail":null,"inline":[]}']);
        }
        $this->due();
        $this->assertSame(['published' => 0, 'blocked' => 1, 'skipped' => 0], app(ArticleDuePublisher::class)->tick());
        $this->assertNull(DB::table('articles')->value('published_version'));
        $this->assertSame('blocked', DB::table('article_publication_schedules')->value('status'));
        $this->assertSame(1, AuditEvent::where('action', 'admin.article_schedule.blocked')->count());
        $this->assertSame(0, app(ArticleDuePublisher::class)->tick()['blocked']);
    }

    public function test_runner_availability_requires_fresh_success_and_future_preference(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $this->assertFalse(ArticleDuePublisher::available());
        $this->getJson(self::BASE.'/'.$article['id'].'/schedule-context?action=arm')->assertOk()->assertJsonPath('data.eligible', false);
        app(ArticleDuePublisher::class)->tick();
        $this->assertTrue(ArticleDuePublisher::available());
        $this->travel(121)->seconds();
        $this->assertFalse(ArticleDuePublisher::available());
        $this->due();
        app(ArticleDuePublisher::class)->tick();
        $context = $this->getJson(self::BASE.'/'.$article['id'].'/schedule-context?action=arm')->assertOk()->json('data');
        $this->assertContains('invalid_publication_time', $context['blockers']);
    }

    public static function roles(): array
    {
        return [['guest', 401], ['patient', 403], ['doctor', 403], ['admin', 200], ['root-admin', 200]];
    }

    #[DataProvider('roles')]
    public function test_schedule_routes_require_staff_and_private_responses(string $role, int $status): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $this->app['auth']->forgetGuards();
        if ($role !== 'guest') {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->actingAs($actor);
        }
        $response = $this->getJson(self::BASE.'/'.$article['id'].'/schedule-context?action=arm')->assertStatus($status);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        if ($status !== 200) {
            $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', [])->assertStatus($status);
        }
    }

    public function test_audit_failure_rolls_back_schedule_and_publication(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        $this->arm($article['id']);
        $this->due();
        $before = $this->fingerprint();
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit failure'));
        // Resolve after the mock so every collaborator uses the failing atomic audit writer.
        $this->app->forgetInstance(ArticleDuePublisher::class);
        $this->artisan('articles:publish-due')->assertFailed();
        $this->assertSame($before, $this->fingerprint());
        $this->assertNull(DB::table('articles')->value('published_version'));
    }

    public function test_retired_taxonomy_blocks_delivery_without_rewriting_historical_labels(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor, 'tag', 'synthetic-topic');
        $body = $this->draft();
        $body['taxonomy'] = [['id' => $term->public_id, 'kind' => 'tag']];
        $article = $this->postJson(self::BASE, $body)->assertCreated()->json('data');
        $original = DB::table('article_versions')->get()->toJson();
        foreach (['submit', 'review'] as $action) {
            $this->editorial($article['id'], $action);
        }
        $this->arm($article['id']);
        $this->appendTermFixture($term, $actor, false);
        $this->due();
        $this->assertSame(1, app(ArticleDuePublisher::class)->tick()['blocked']);
        $this->assertSame('inactive_taxonomy_reference', DB::table('article_publication_schedules')->value('blocker'));
        $this->assertNull(DB::table('articles')->value('published_version'));
        $this->assertSame($original, DB::table('article_versions')->get()->toJson());
    }

    public function test_due_command_respects_limit_and_rejects_invalid_or_disabled_invocations(): void
    {
        $this->signIn();
        $first = $this->createReviewed();
        $this->arm($first['id']);
        $body = $this->draft();
        $body['slug'] = 'second-synthetic-scheduled-article';
        $second = $this->postJson(self::BASE, $body)->assertCreated()->json('data');
        foreach (['submit', 'review'] as $action) {
            $this->editorial($second['id'], $action);
        }
        $this->arm($second['id']);
        $this->due();
        $this->artisan('articles:publish-due', ['--limit' => '1'])->assertSuccessful();
        $this->assertSame(1, DB::table('article_publication_schedules')->where('status', 'armed')->count());
        $before = $this->fingerprint();
        foreach (['0', '51', '1.5', '-1', '02'] as $limit) {
            $this->artisan('articles:publish-due', ['--limit' => $limit])->assertFailed();
        }
        config(['article_content.publisher_enabled' => false]);
        $this->artisan('articles:publish-due')->assertFailed();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_schedule_and_draft_invalidation_both_roll_back_on_audit_failure(): void
    {
        $this->signIn();
        $article = $this->createReviewed();
        app(ArticleDuePublisher::class)->tick();
        $body = $this->scheduleBody($article['id']);
        $before = $this->fingerprint();
        $this->mock(AuditLogger::class)->shouldReceive('log')->andThrow(new RuntimeException('Synthetic audit failure'));
        $this->postJson(self::BASE.'/'.$article['id'].'/schedule-actions', $body)->assertServiceUnavailable();
        $this->assertSame($before, $this->fingerprint());
        $this->app->forgetInstance(AuditLogger::class);
        $this->arm($article['id']);
        $body = $this->draft($article['id'], '2026-10-25T15:30');
        $before = $this->fingerprint();
        $this->mock(AuditLogger::class)->shouldReceive('log')->andThrow(new RuntimeException('Synthetic audit failure'));
        $this->putJson(self::BASE.'/'.$article['id'], $body)->assertServiceUnavailable();
        $this->assertSame($before, $this->fingerprint());
        $this->assertSame('armed', DB::table('article_publication_schedules')->value('status'));
    }
}
