<?php

namespace Tests\Feature\Api;

use App\Enums\AccountState;
use App\Models\AuditEvent;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\ArticleReadFixtures;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleEditorialTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const BASE = '/api/admin/articles/';

    private function signIn(?User $actor = null): User
    {
        config(['article_content.enabled' => true]);
        $actor ??= User::factory()->admin()->create();
        $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function context(string $id, string $action, ?string $source = null): array
    {
        return $this->getJson(self::BASE.$id.'/action-context?'.http_build_query(['action' => $action]
            + ($source === null ? [] : ['source_version_id' => $source])))->assertOk()->json('data');
    }

    private function body(string $id, string $action, ?string $source = null): array
    {
        $context = $this->context($id, $action, $source);

        return ['action' => $action, 'expected_revision' => $context['revision'], 'expected_version' => $context['current']['working']['version'],
            'expected_hash' => $context['current']['working']['content_hash'], 'reason' => 'Synthetic editorial action', 'confirmed' => true]
            + ($source === null ? [] : ['source_version_id' => $source, 'source_hash' => $context['source']['content_hash']]);
    }

    private function action(string $id, string $action, ?string $source = null)
    {
        return $this->postJson(self::BASE.$id.'/actions', $this->body($id, $action, $source));
    }

    private function fingerprint(): string
    {
        return hash('sha256', json_encode(array_map(fn ($table) => DB::table($table)->orderBy('id')->get()->all(),
            ['article_catalog_state', 'articles', 'article_versions', 'article_version_terms', 'article_terms', 'article_term_versions', 'audit_events']), JSON_THROW_ON_ERROR));
    }

    public static function roles(): array
    {
        return [['guest', 401], ['patient', 403], ['doctor', 403], ['admin', 200], ['root-admin', 200]];
    }

    #[DataProvider('roles')]
    public function test_context_action_and_history_enforce_staff_and_private_responses(string $role, int $status): void
    {
        config(['article_content.enabled' => true]);
        $creator = User::factory()->admin()->create();
        $article = $this->articleFixture($creator);
        if ($role !== 'guest') {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->signIn($actor);
        }
        $before = $this->fingerprint();
        foreach ([self::BASE.$article->public_id.'/action-context?action=submit', self::BASE.$article->public_id.'/events'] as $url) {
            $response = $this->getJson($url)->assertStatus($status);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        }
        if ($status === 200) {
            $this->action($article->public_id, 'submit')->assertOk()->assertJsonPath('data.working_state', 'in_review');
            $this->action($article->public_id, 'review')->assertOk()->assertJsonPath('data.review.kind', 'editorial');
            $this->action($article->public_id, 'publish')->assertOk()->assertJsonPath('data.published.version', 1);
        } else {
            $response = $this->postJson(self::BASE.$article->public_id.'/actions', [])->assertStatus($status);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            $this->assertSame($before, $this->fingerprint());
        }
    }

    public function test_exact_workflow_cannot_skip_states_and_publication_does_not_append_or_modify_content(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $versions = DB::table('article_versions')->get()->toJson();
        foreach (['review', 'publish'] as $action) {
            $this->assertFalse($this->context($article->public_id, $action)['eligible']);
            $this->action($article->public_id, $action)->assertConflict();
        }
        $this->action($article->public_id, 'submit')->assertOk()->assertJsonPath('data.published', null);
        $this->action($article->public_id, 'review')->assertOk()->assertJsonPath('data.review.version', 1)->assertJsonPath('data.review.actor.id', $actor->public_id)
            ->assertJsonPath('data.review.kind', 'editorial')->assertJsonPath('data.published', null);
        $this->action($article->public_id, 'publish')->assertOk()->assertJsonPath('data.working_state', 'published')->assertJsonPath('data.published.version', 1);
        $this->assertSame($versions, DB::table('article_versions')->get()->toJson());
        $this->assertSame(3, AuditEvent::count());
        $this->assertSame(3, (int) DB::table('article_catalog_state')->value('revision'));
        $before = $this->fingerprint();
        foreach (['submit', 'review', 'publish'] as $action) {
            $this->action($article->public_id, $action)->assertConflict();
        }
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_one_complete_translation_is_enough_but_incomplete_content_is_blocked(): void
    {
        $actor = $this->signIn();
        $context = $this->getJson('/api/admin/articles/write-context')->assertOk()->json('data');
        $body = ['slug' => 'farsi-only', 'expected_revision' => $context['revision'], 'reason' => 'Synthetic Farsi draft', 'confirmed' => true,
            'translations' => ['fa' => ['title' => 'عنوان', 'summary' => 'خلاصه', 'body_html' => '<p>متن آموزشی</p>']]];
        $id = $this->postJson('/api/admin/articles', $body)->assertCreated()->json('data.id');
        $this->action($id, 'submit')->assertOk();
        $this->action($id, 'review')->assertOk();
        $this->action($id, 'publish')->assertOk()->assertJsonPath('data.published.publishable_languages', ['fa']);
        $other = $this->articleFixture($actor, 'incomplete-article');
        $edit = $this->getJson(self::BASE.$other->public_id.'/write-context')->assertOk()->json('data');
        $this->putJson(self::BASE.$other->public_id, ['slug' => $other->slug, 'expected_revision' => $edit['revision'], 'reason' => 'Synthetic incomplete draft',
            'confirmed' => true, 'translations' => ['en' => ['title' => 'Title']]])->assertOk();
        $this->assertContains('incomplete_translation', $this->context($other->public_id, 'submit')['blockers']);
        $this->action($other->public_id, 'submit')->assertConflict();
    }

    public function test_draft_edit_invalidates_review_and_publication_token_until_new_exact_review(): void
    {
        $actor = $this->signIn();
        $article = $this->publishFixture($this->articleFixture($actor), $actor);
        $original = DB::table('article_versions')->where('article_id', $article->id)->first();
        $article = $this->appendArticleFixture($article, $actor);
        $this->action($article->public_id, 'submit')->assertOk();
        $this->action($article->public_id, 'review')->assertOk();
        $saved = $this->body($article->public_id, 'publish');
        $edit = $this->getJson(self::BASE.$article->public_id.'/write-context')->assertOk()->json('data');
        $this->putJson(self::BASE.$article->public_id, ['slug' => $article->slug, 'expected_revision' => $edit['revision'], 'reason' => 'Synthetic replacement',
            'confirmed' => true, 'translations' => ['en' => ['title' => 'New title', 'summary' => 'New summary', 'body_html' => '<p>Changed body</p>']]])->assertOk();
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertConflict();
        $this->getJson(self::BASE.$article->public_id)->assertOk()->assertJsonPath('data.published.version', 1)->assertJsonPath('data.review', null);
        $this->action($article->public_id, 'publish')->assertConflict();
        $this->action($article->public_id, 'submit')->assertOk();
        $this->action($article->public_id, 'review')->assertOk();
        $this->action($article->public_id, 'publish')->assertOk()->assertJsonPath('data.published.version', 3);
        $this->assertEquals($original, DB::table('article_versions')->find($original->id));
    }

    public function test_retirement_between_review_and_publish_blocks_fresh_publish_but_allows_archive(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor);
        $article = $this->articleFixture($actor, terms: [$term]);
        $this->action($article->public_id, 'submit')->assertOk();
        $this->action($article->public_id, 'review')->assertOk();
        $saved = $this->body($article->public_id, 'publish');
        $termContext = $this->getJson('/api/admin/article-taxonomies/'.$term->public_id.'/write-context')->assertOk()->json('data');
        $this->postJson('/api/admin/article-taxonomies/'.$term->public_id.'/actions', ['expected_revision' => $termContext['revision'], 'action' => 'retire',
            'reason' => 'Synthetic retirement', 'confirmed' => true])->assertOk();
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertConflict();
        $this->assertContains('inactive_taxonomy_reference', $this->context($article->public_id, 'publish')['blockers']);
        $before = $this->fingerprint();
        $this->action($article->public_id, 'publish')->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $this->action($article->public_id, 'archive')->assertOk()->assertJsonPath('data.status', 'archived')->assertJsonPath('data.published', null);
    }

    public function test_copy_restores_prior_content_as_new_draft_preserving_later_versions_published_pointer_and_retired_snapshots(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor);
        $article = $this->articleFixture($actor, terms: [$term], title: 'Original good content');
        $source = DB::table('article_versions')->where('article_id', $article->id)->first();
        $article = $this->publishFixture($this->appendArticleFixture($article, $actor, title: 'Unwanted later content'), $actor);
        $published = DB::table('article_versions')->where('article_id', $article->id)->where('version', 2)->first();
        $originalLinks = DB::table('article_version_terms')->get()->toJson();
        $this->appendTermFixture($term, $actor, false);
        $context = $this->context($article->public_id, 'copy_version', strtoupper($source->public_id));
        $this->assertTrue($context['eligible']);
        $this->assertSame($context['revision'], $this->context(strtoupper($article->public_id), 'copy_version', $source->public_id)['revision']);
        $this->assertSame('Original good content', $context['source']['translations']['en']['title']);
        $this->action($article->public_id, 'copy_version', $source->public_id)->assertOk()->assertJsonPath('data.working.version', 3)
            ->assertJsonPath('data.working.translations.en.title', 'Original good content')->assertJsonPath('data.working.content_hash', $source->content_hash)
            ->assertJsonPath('data.working_state', 'draft')->assertJsonPath('data.review', null)->assertJsonPath('data.published.version', 2)
            ->assertJsonPath('data.working.taxonomy.0.version', 1)->assertJsonPath('data.working.taxonomy.0.currently_active', false);
        $this->assertEquals($source, DB::table('article_versions')->find($source->id));
        $this->assertEquals($published, DB::table('article_versions')->find($published->id));
        $this->assertSame(3, DB::table('article_versions')->count());
        $this->assertSame($originalLinks, DB::table('article_version_terms')->where('article_version_id', $source->id)->get()->toJson());
        $audit = AuditEvent::first();
        $this->assertSame('admin.article.version_copied', $audit->action);
        $this->assertSame($source->public_id, $audit->after['source_version_id']);
        $this->assertSame(2, $audit->before['version']);
        $this->assertSame(3, $audit->after['version']);
        $this->assertContains('inactive_taxonomy_reference', $this->context($article->public_id, 'submit')['blockers']);
        $this->action($article->public_id, 'submit')->assertConflict();
    }

    public function test_copy_rejects_current_foreign_corrupt_or_unchanged_source_versions(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $source = DB::table('article_versions')->where('article_id', $article->id)->first();
        $this->action($article->public_id, 'copy_version', $source->public_id)->assertConflict();
        $article = $this->appendArticleFixture($article, $actor, title: 'Heart health');
        $this->assertContains('no_content_change', $this->context($article->public_id, 'copy_version', $source->public_id)['blockers']);
        $this->action($article->public_id, 'copy_version', $source->public_id)->assertConflict();
        $other = $this->articleFixture($actor, 'foreign-article');
        $foreign = DB::table('article_versions')->where('article_id', $other->id)->first();
        $payload = $this->body($article->public_id, 'copy_version', $source->public_id);
        $payload['source_version_id'] = $foreign->public_id;
        $this->postJson(self::BASE.$article->public_id.'/actions', $payload)->assertNotFound();
        DB::table('article_versions')->where('id', $source->id)->update(['content_hash' => str_repeat('0', 64)]);
        $this->getJson(self::BASE.$article->public_id.'/action-context?'.http_build_query(['action' => 'copy_version', 'source_version_id' => $source->public_id]))->assertStatus(503);
    }

    public function test_action_revisions_bind_actor_target_action_version_hash_and_source_and_refuse_duplicate_delivery(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $saved = $this->body($article->public_id, 'submit');
        foreach (['expected_version' => 99, 'expected_hash' => str_repeat('0', 64), 'action' => 'archive'] as $field => $value) {
            $this->postJson(self::BASE.$article->public_id.'/actions', array_replace($saved, [$field => $value]))->assertConflict();
        }
        $other = $this->articleFixture($actor, 'other-target');
        $this->postJson(self::BASE.$other->public_id.'/actions', $saved)->assertConflict();
        $this->signIn(User::factory()->admin()->create());
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertConflict();
        $this->signIn($actor);
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertOk();
        $before = $this->fingerprint();
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_archive_is_terminal_and_retains_content_history_and_published_pointer(): void
    {
        $actor = $this->signIn();
        $article = $this->publishFixture($this->articleFixture($actor), $actor);
        $versions = DB::table('article_versions')->get()->toJson();
        $saved = $this->body($article->public_id, 'archive');
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertOk()->assertJsonPath('data.status', 'archived')->assertJsonPath('data.published.version', 1);
        $before = $this->fingerprint();
        $this->postJson(self::BASE.$article->public_id.'/actions', $saved)->assertConflict();
        foreach (['submit', 'review', 'publish', 'archive'] as $action) {
            $this->assertSame(['archived'], $this->context($article->public_id, $action)['blockers']);
            $this->action($article->public_id, $action)->assertConflict();
        }
        $this->assertSame($versions, DB::table('article_versions')->get()->toJson());
        $this->assertSame($before, $this->fingerprint());
        $this->getJson(self::BASE.$article->public_id.'/events')->assertOk()->assertJsonPath('data.0.after.archived', true);
    }

    public static function invalidInputs(): array
    {
        return [['confirmed', false], ['reason', " \u{200b}"], ['reason', "reason\0"], ['action', 'restore'], ['published_version', 1],
            ['reviewed_hash', str_repeat('0', 64)], ['expected_revision', 'bad'], ['expected_version', 0], ['expected_hash', 'bad'],
            ['source_version_id', '01j00000000000000000000001'], ['source_hash', str_repeat('0', 64)],
            ['source_version_id', ''], ['source_hash', '']];
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_action_payloads_cannot_set_state_or_smuggle_copy_fields(string $field, mixed $value): void
    {
        $article = $this->articleFixture($this->signIn());
        $payload = $this->body($article->public_id, 'archive');
        $before = $this->fingerprint();
        $this->postJson(self::BASE.$article->public_id.'/actions', array_replace($payload, [$field => $value]))->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
    }

    public static function actions(): array
    {
        return [['submit'], ['review'], ['publish'], ['archive'], ['copy_version']];
    }

    #[DataProvider('actions')]
    public function test_each_late_audit_failure_rolls_back_state_pointers_versions_links_and_anchor(string $action): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $source = null;
        if ($action === 'review') {
            DB::table('articles')->where('id', $article->id)->update(['working_state' => 'in_review']);
        } elseif ($action === 'publish') {
            $this->publishFixture($article, $actor);
            DB::table('articles')->where('id', $article->id)->update(['working_state' => 'reviewed', 'published_version' => null]);
        } elseif ($action === 'copy_version') {
            $source = DB::table('article_versions')->where('article_id', $article->id)->value('public_id');
            $article = $this->appendArticleFixture($article, $actor);
        }
        $payload = $this->body($article->public_id, $action, $source);
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Private diagnostic'));
        $before = $this->fingerprint();
        $this->postJson(self::BASE.$article->public_id.'/actions', $payload)->assertStatus(503)->assertDontSee('Private diagnostic');
        $this->assertSame($before, $this->fingerprint());
    }

    public static function authorityChanges(): array
    {
        return [['role'], ['state'], ['password']];
    }

    #[DataProvider('authorityChanges')]
    public function test_lock_time_fresh_authority_and_password_refuse_cached_route_permission(string $change): void
    {
        $actor = $this->signIn();
        $actor->load('roles');
        $article = $this->articleFixture($actor);
        $payload = $this->body($article->public_id, 'submit');
        $before = $this->fingerprint();
        $changed = false;
        DB::connection()->beforeExecuting(function ($sql) use ($actor, $change, &$changed): void {
            if (! $changed && str_contains($sql, 'article_catalog_state')) {
                $changed = true;
                if ($change === 'role') {
                    User::findOrFail($actor->id)->syncRoles('patient');
                } elseif ($change === 'state') {
                    User::whereKey($actor->id)->update(['account_state' => AccountState::Suspended->value]);
                } else {
                    request()->session()->put('auth.password_confirmed_at', 1);
                }
            }
        });
        $this->postJson(self::BASE.$article->public_id.'/actions', $payload)->assertStatus($change === 'password' ? 423 : 403);
        $this->assertTrue($changed);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_source_hash_is_bound_and_reader_or_draft_tokens_do_not_authorize_actions(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $source = DB::table('article_versions')->where('article_id', $article->id)->value('public_id');
        $article = $this->appendArticleFixture($article, $actor);
        $payload = $this->body($article->public_id, 'copy_version', $source);
        $this->postJson(self::BASE.$article->public_id.'/actions', array_replace($payload, ['source_hash' => str_repeat('0', 64)]))->assertConflict();
        $draft = $this->getJson(self::BASE.$article->public_id.'/write-context')->assertOk()->json('data.revision');
        $read = $this->getJson(self::BASE.$article->public_id)->assertOk()->json('meta.revision');
        foreach ([$draft, $read] as $revision) {
            $this->postJson(self::BASE.$article->public_id.'/actions', array_replace($payload, ['expected_revision' => $revision]))->assertConflict();
        }
    }

    public function test_context_queries_raw_inputs_feature_schema_and_password_fail_closed(): void
    {
        $article = $this->articleFixture($this->signIn());
        $payload = $this->body($article->public_id, 'submit');
        $this->withSession(['auth.password_confirmed_at' => 1])->postJson(self::BASE.$article->public_id.'/actions', $payload)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        foreach (['', '?action=bad', '?action=copy_version', '?action=submit&extra=1'] as $query) {
            $this->getJson(self::BASE.$article->public_id.'/action-context'.$query)->assertUnprocessable();
        }
        $this->postJson(self::BASE.$article->public_id.'/actions?extra=1', $payload)->assertUnprocessable();
        foreach (['[]', '{"broken":', str_repeat(' ', 16385).'{}'] as $raw) {
            $this->call('POST', self::BASE.$article->public_id.'/actions', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:3000'], $raw)->assertUnprocessable();
        }
        config(['article_content.enabled' => false]);
        $this->postJson(self::BASE.$article->public_id.'/actions', $payload)->assertStatus(503);
        config(['article_content.enabled' => true]);
        Schema::drop('article_version_terms');
        $this->postJson(self::BASE.$article->public_id.'/actions', $payload)->assertStatus(503);
    }

    public function test_timeline_is_paged_scoped_typed_and_excludes_private_raw_audit_fields(): void
    {
        $this->signIn();
        $context = $this->getJson('/api/admin/articles/write-context')->assertOk()->json('data');
        $draft = ['slug' => 'timeline-article', 'expected_revision' => $context['revision'], 'confirmed' => true, 'reason' => 'Private administrative reason',
            'translations' => ['en' => ['title' => 'First', 'summary' => 'Summary', 'body_html' => '<p>Body</p>']]];
        $id = $this->postJson('/api/admin/articles', $draft)->assertCreated()->json('data.id');
        $source = DB::table('article_versions')->value('public_id');
        $context = $this->getJson(self::BASE.$id.'/write-context')->assertOk()->json('data');
        $this->putJson(self::BASE.$id, array_replace($draft, ['expected_revision' => $context['revision'], 'translations' => ['en' => ['title' => 'Second', 'summary' => 'Summary', 'body_html' => '<p>New body</p>']]]))->assertOk();
        $this->action($id, 'submit')->assertOk();
        $this->action($id, 'review')->assertOk();
        $this->action($id, 'publish')->assertOk();
        $this->action($id, 'copy_version', $source)->assertOk();
        $this->action($id, 'archive')->assertOk();
        $audit = AuditEvent::first();
        $audit->after = $audit->after + ['email' => 'private-marker@example.test', 'body_html' => 'private-marker'];
        $audit->save();
        $before = $this->fingerprint();
        $response = $this->getJson(self::BASE.$id.'/events?per_page=2')->assertOk()->assertJsonPath('meta.pagination.total', 7)
            ->assertJsonPath('data.0.action', 'admin.article.archived')->assertJsonPath('data.1.action', 'admin.article.version_copied')
            ->assertJsonPath('data.1.after.source_version_id', $source)->assertJsonPath('meta.read_only', true);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->getJson(self::BASE.$id.'/events?per_page=2&page=4')->assertOk()->assertJsonPath('data.0.action', 'admin.article.created')
            ->assertDontSee('private-marker')->assertDontSee('Private administrative reason')->assertJsonMissingPath('data.0.reason')
            ->assertJsonMissingPath('data.0.ip')->assertJsonMissingPath('data.0.after.email');
        foreach (['?per_page=51', '?page=10001', '?q=secret'] as $query) {
            $this->getJson(self::BASE.$id.'/events'.$query)->assertUnprocessable();
        }
        $this->getJson(self::BASE.strtolower((string) Str::ulid()).'/events')->assertNotFound();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_timeline_refuses_cross_article_version_substitution_and_ignores_unrelated_subjects(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $this->action($article->public_id, 'submit')->assertOk();
        $other = $this->articleFixture($actor, 'other-history');
        $this->getJson(self::BASE.$other->public_id.'/events')->assertOk()->assertJsonPath('data', []);
        $audit = AuditEvent::first();
        $foreign = DB::table('article_versions')->where('article_id', $other->id)->first();
        $after = $audit->after;
        $after['version_id'] = $foreign->public_id;
        $audit->after = $after;
        $audit->save();
        $this->getJson(self::BASE.$article->public_id.'/events')->assertStatus(503)->assertDontSee('SQLSTATE');
    }

    public function test_successful_editorial_actions_and_history_do_not_read_private_health_or_consume_jobs(): void
    {
        $article = $this->articleFixture($this->signIn());
        DB::table('jobs')->insert(['queue' => 'unrelated-sentinel', 'payload' => '{"synthetic":true}', 'attempts' => 0,
            'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
        $jobs = DB::table('jobs')->get()->toJson();
        $health = [];
        $broad = [];
        DB::listen(function ($event) use (&$health, &$broad): void {
            if (preg_match('/patient_health|patient_biometric|reservation_medical|reservation_files|reservation_reports/i', $event->sql)) {
                $health[] = $event->sql;
            }
            if (preg_match('/select\s+\*\s+from\s+["`]?users["`]?/i', $event->sql)) {
                $broad[] = $event->sql;
            }
        });
        foreach (['submit', 'review', 'publish', 'archive'] as $action) {
            $this->action($article->public_id, $action)->assertOk();
        }
        $this->getJson(self::BASE.$article->public_id.'/events')->assertOk();
        $this->assertSame([], $health);
        $this->assertSame([], $broad);
        $this->assertSame($jobs, DB::table('jobs')->get()->toJson());
    }

    public function test_same_published_pointer_is_a_noop_even_if_stored_working_state_is_reviewed(): void
    {
        $actor = $this->signIn();
        $article = $this->publishFixture($this->articleFixture($actor), $actor);
        DB::table('articles')->where('id', $article->id)->update(['working_state' => 'reviewed']);
        $this->assertContains('already_published', $this->context($article->public_id, 'publish')['blockers']);
        $before = $this->fingerprint();
        $this->action($article->public_id, 'publish')->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_copy_token_binds_the_chosen_older_version_and_archive_prevents_later_recovery(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $first = DB::table('article_versions')->where('article_id', $article->id)->first();
        $article = $this->appendArticleFixture($article, $actor, title: 'Second version');
        $second = DB::table('article_versions')->where('article_id', $article->id)->where('version', 2)->first();
        $article = $this->appendArticleFixture($article, $actor, title: 'Third version');
        $payload = $this->body($article->public_id, 'copy_version', $first->public_id);
        $before = $this->fingerprint();
        $this->postJson(self::BASE.$article->public_id.'/actions', array_replace($payload,
            ['source_version_id' => $second->public_id, 'source_hash' => $second->content_hash]))->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $this->action($article->public_id, 'archive')->assertOk();
        $this->assertSame(['archived'], $this->context($article->public_id, 'copy_version', $first->public_id)['blockers']);
        $before = $this->fingerprint();
        $this->action($article->public_id, 'copy_version', $first->public_id)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_timeline_recovery_lineage_cannot_point_to_itself_instead_of_an_older_version(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $first = DB::table('article_versions')->where('article_id', $article->id)->first();
        $article = $this->appendArticleFixture($article, $actor);
        $this->action($article->public_id, 'copy_version', $first->public_id)->assertOk();
        $this->getJson(self::BASE.$article->public_id.'/events')->assertOk()->assertJsonPath('data.0.after.source_version_id', $first->public_id);
        $audit = AuditEvent::first();
        $after = $audit->after;
        $after['source_version_id'] = $after['version_id'];
        $audit->after = $after;
        $audit->save();
        $this->getJson(self::BASE.$article->public_id.'/events')->assertStatus(503);
    }
}
