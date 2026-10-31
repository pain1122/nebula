<?php

namespace Tests\Feature\Api;

use App\Enums\AccountState;
use App\Models\Article;
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

class ArticleDraftWriteTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const BASE = '/api/admin/articles';

    private function signIn(?User $actor = null): User
    {
        config(['article_content.enabled' => true]);
        $actor ??= User::factory()->admin()->create();
        $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function context(?string $id = null): array
    {
        return $this->getJson(self::BASE.($id === null ? '' : '/'.$id).'/write-context')->assertOk()->json('data');
    }

    private function body(?string $id = null, array $replace = []): array
    {
        $context = $this->context($id);

        return array_replace(['expected_revision' => $context['revision'], 'reason' => 'Synthetic educational draft', 'confirmed' => true,
            'slug' => $context['current']['slug'] ?? 'synthetic-article', 'translations' => ['en' => ['title' => 'Heart health', 'summary' => 'Educational summary', 'body_html' => '<p>Synthetic <strong>education</strong>.</p>'],
                'fa' => ['title' => 'سلامت قلب', 'summary' => 'خلاصه آموزشی', 'body_html' => '<p>متن آموزشی</p>']],
            'health_references' => ['condition.diabetes'], 'taxonomy' => [], 'source_links' => [['url' => 'https://example.test/synthetic', 'label' => 'Synthetic source']]], $replace);
    }

    private function fingerprint(): string
    {
        $tables = ['article_catalog_state', 'articles', 'article_versions', 'article_version_terms', 'article_terms', 'article_term_versions', 'audit_events'];

        return hash('sha256', json_encode(array_map(fn ($table) => DB::table($table)->orderBy('id')->get()->all(), $tables), JSON_THROW_ON_ERROR));
    }

    public function test_seo_versions_publish_without_summary_and_recover_without_mutating_old_publication(): void
    {
        $this->signIn();
        $translations = ['en' => ['title' => 'Education', 'body_html' => '<p>Educational article.</p>',
            'seo' => ['title' => 'Search title', 'description' => 'Search description', 'keywords' => 'education, checkup',
                'schema_json' => '{"@context":"https://schema.org","@type":"BlogPosting","headline":"Education"}',
                'canonical_url' => 'https://example.com/en/education']]];
        $created = $this->postJson(self::BASE, $this->body(replace: ['translations' => $translations]))->assertCreated()->json('data');
        $id = $created['id'];
        $this->assertSame(2, $created['working']['schema_version']);
        $this->assertSame(['en'], $created['working']['publishable_languages']);
        $original = $created['working'];
        foreach (['submit', 'review', 'publish'] as $action) {
            $context = $this->getJson(self::BASE.'/'.$id.'/action-context?action='.$action)->assertOk()->json('data');
            $this->postJson(self::BASE.'/'.$id.'/actions', ['action' => $action, 'expected_revision' => $context['revision'],
                'expected_version' => $context['current']['working']['version'], 'expected_hash' => $context['current']['working']['content_hash'],
                'reason' => 'Synthetic SEO editorial check', 'confirmed' => true])->assertOk();
        }
        $stored = DB::table('article_versions')->orderBy('id')->get()->toJson();
        $translations['en']['seo']['description'] = 'Updated search description';
        $edited = $this->putJson(self::BASE.'/'.$id, $this->body($id, ['translations' => $translations]))->assertOk()->json('data');
        $this->assertSame(2, $edited['working']['version']);
        $this->assertSame($original['content_hash'], $edited['published']['content_hash']);
        $this->assertNotSame($original['content_hash'], $edited['working']['content_hash']);
        $query = http_build_query(['action' => 'copy_version', 'source_version_id' => $original['id']]);
        $context = $this->getJson(self::BASE.'/'.$id.'/action-context?'.$query)->assertOk()->json('data');
        $recovered = $this->postJson(self::BASE.'/'.$id.'/actions', ['action' => 'copy_version', 'source_version_id' => $original['id'],
            'source_hash' => $original['content_hash'], 'expected_revision' => $context['revision'],
            'expected_version' => $context['current']['working']['version'], 'expected_hash' => $context['current']['working']['content_hash'],
            'reason' => 'Synthetic SEO version recovery', 'confirmed' => true])->assertOk()->json('data');
        $this->assertSame(3, $recovered['working']['version']);
        $this->assertSame($original['translations'], $recovered['working']['translations']);
        $this->assertSame($original['content_hash'], $recovered['working']['content_hash']);
        $this->assertSame(1, $recovered['published']['version']);
        $this->assertSame($stored, DB::table('article_versions')->orderBy('id')->limit(1)->get()->toJson());
        $this->getJson(self::BASE)->assertOk()->assertJsonPath('data.0.working.schema_version', 2);
        $before = $this->fingerprint();
        $translations['en']['seo']['canonical_url'] = 'javascript:alert(1)';
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['translations' => $translations]))->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
        foreach (AuditEvent::all() as $audit) {
            foreach (['translations', 'seo', 'schema_json', 'keywords', 'canonical_url'] as $key) {
                $this->assertArrayNotHasKey($key, $audit->after);
            }
        }
    }

    public static function roles(): array
    {
        return [['guest', 401], ['patient', 403], ['doctor', 403], ['admin', 200], ['root-admin', 200]];
    }

    #[DataProvider('roles')]
    public function test_both_contexts_and_draft_writers_require_active_staff_and_no_store(string $role, int $status): void
    {
        config(['article_content.enabled' => true]);
        $staff = User::factory()->admin()->create();
        $article = $this->articleFixture($staff);
        if ($role !== 'guest') {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->signIn($actor);
        }
        $before = $this->fingerprint();
        foreach ([self::BASE.'/write-context', self::BASE.'/'.$article->public_id.'/write-context'] as $url) {
            $response = $this->getJson($url)->assertStatus($status);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        }
        if ($status !== 200) {
            foreach (['POST' => self::BASE, 'PUT' => self::BASE.'/'.$article->public_id] as $method => $url) {
                $response = $method === 'POST' ? $this->postJson($url, []) : $this->putJson($url, []);
                $response->assertStatus($status);
                $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            }
            $this->assertSame($before, $this->fingerprint());
        } else {
            $id = $this->postJson(self::BASE, $this->body())->assertCreated()->json('data.id');
            $this->putJson(self::BASE.'/'.$id, $this->body($id, ['translations' => ['en' => ['title' => 'Changed']]]))->assertOk();
        }
    }

    public function test_creation_persists_sanitized_bilingual_content_exact_server_snapshots_and_safe_audit(): void
    {
        $actor = $this->signIn();
        $category = $this->termFixture($actor, 'category', 'care-category');
        $topic = $this->termFixture($actor);
        $body = $this->body(replace: ['taxonomy' => [['id' => strtoupper($category->public_id), 'kind' => 'category'], ['id' => $topic->public_id, 'kind' => 'topic']]]);
        $body['translations']['en']['body_html'] .= '<script>private-script-marker</script><img src="https://example.test/tracker" onerror="bad()">';
        $response = $this->postJson(self::BASE, $body)->assertCreated()->assertJsonPath('data.working_state', 'draft')->assertJsonPath('data.published', null)
            ->assertJsonPath('data.review', null)->assertJsonPath('data.working.version', 1)->assertJsonPath('data.working.translations.fa.title', 'سلامت قلب')
            ->assertJsonPath('data.working.health_references.0.id', 'condition.diabetes')->assertJsonPath('data.author.id', $actor->public_id)
            ->assertDontSee('private-script-marker')->assertDontSee('tracker')->assertDontSee('onerror');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $id = $response->json('data.id');
        $this->getJson(self::BASE.'/'.$id)->assertOk()->assertJsonPath('data.working.content_hash', $response->json('data.working.content_hash'));
        $this->assertCount(2, $response->json('data.working.taxonomy'));
        $this->assertSame(2, DB::table('article_version_terms')->count());
        $this->assertSame(1, (int) DB::table('article_catalog_state')->value('revision'));
        $this->assertSame(1, AuditEvent::count());
        $audit = AuditEvent::first();
        $this->assertSame(Article::class, $audit->subject_type);
        $this->assertSame($id, $audit->subject_public_id);
        $this->assertSame('admin.article.created', $audit->action);
        $this->assertSame($actor->name, $audit->actor_name_snapshot);
        $this->assertNull($audit->before);
        $this->assertSame(1, $audit->after['version']);
        $this->assertSame(2, $audit->after['taxonomy_count']);
        $this->assertSame(1, $audit->after['reference_count']);
        $this->assertSame(1, $audit->after['source_count']);
        $this->assertSame(['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'taxonomy_count', 'reference_count', 'source_count'], array_keys($audit->after));
        $this->assertStringNotContainsString('condition.diabetes', json_encode($audit->after));
        $context = $this->context(strtoupper($id));
        $this->assertSame('health-2026-10-22.1', $context['health_catalog']['version']);
        $this->assertCount(14, $context['health_catalog']['terms']);
        $this->assertSame($response->json('data'), $context['current']);
        $this->assertSame($this->context($id)['revision'], $context['revision']);
    }

    public function test_incomplete_empty_drafts_and_explicit_reference_clearing_are_supported(): void
    {
        $this->signIn();
        $guards = ['expected_revision' => $this->context()['revision'], 'reason' => 'Synthetic empty draft', 'confirmed' => true, 'slug' => 'empty-draft'];
        $id = $this->postJson(self::BASE, $guards)->assertCreated()->assertJsonPath('data.working.publishable_languages', [])->json('data.id');
        $this->putJson(self::BASE.'/'.$id, $this->body($id))->assertOk()->assertJsonPath('data.working.version', 2);
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['translations' => ['fa' => ['title' => 'پیش‌نویس']], 'health_references' => [], 'source_links' => []]))
            ->assertOk()->assertJsonPath('data.working.version', 3)->assertJsonPath('data.working.health_references', [])->assertJsonPath('data.working.source_links', [])
            ->assertJsonMissingPath('data.working.translations.en')->assertJsonPath('data.working.publishable_languages', []);
        $this->getJson(self::BASE.'/'.$id.'/versions')->assertOk()->assertJsonPath('meta.pagination.total', 3);
    }

    public function test_editing_published_content_preserves_published_bytes_author_links_and_clears_current_review(): void
    {
        $author = $this->signIn();
        $term = $this->termFixture($author);
        $article = $this->publishFixture($this->articleFixture($author, terms: [$term]), $author);
        $published = $this->getJson(self::BASE.'/'.$article->public_id)->assertOk()->json('data.published');
        $oldVersion = DB::table('article_versions')->where('article_id', $article->id)->first();
        $oldLinks = DB::table('article_version_terms')->get()->toJson();
        $editor = $this->signIn(User::factory()->rootAdmin()->create());
        $this->putJson(self::BASE.'/'.$article->public_id, $this->body($article->public_id))->assertOk()
            ->assertJsonPath('data.status', 'published_with_draft')->assertJsonPath('data.working.version', 2)
            ->assertJsonPath('data.working_state', 'draft')->assertJsonPath('data.review', null)->assertJsonPath('data.author.id', $author->public_id)
            ->assertJsonPath('data.working.actor.id', $editor->public_id)->assertJsonPath('data.published', $published);
        $this->assertEquals($oldVersion, DB::table('article_versions')->find($oldVersion->id));
        $this->assertSame($oldLinks, DB::table('article_version_terms')->get()->toJson());
        $audit = AuditEvent::first();
        $this->assertSame('admin.article.draft_saved', $audit->action);
        $this->assertSame('published', $audit->before['working_state']);
        $this->assertSame('draft', $audit->after['working_state']);
        $this->assertSame(1, $audit->after['published_version']);
        $this->assertFalse($this->context($article->public_id)['can_edit_slug']);
    }

    public function test_unpublished_slug_can_change_but_published_and_archived_slug_reservations_cannot_be_reused(): void
    {
        $actor = $this->signIn();
        $id = $this->postJson(self::BASE, $this->body())->assertCreated()->json('data.id');
        $this->assertTrue($this->context($id)['can_edit_slug']);
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['slug' => 'changed-draft-slug']))->assertOk()->assertJsonPath('data.slug', 'changed-draft-slug');
        $article = DB::table('articles')->where('public_id', $id)->first();
        $this->publishFixture($article, $actor);
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['slug' => 'forbidden-slug']))->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        DB::table('articles')->where('id', $article->id)->update(['archived_at' => now()]);
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $this->body(replace: ['slug' => 'changed-draft-slug']))->assertConflict();
        $this->putJson(self::BASE.'/'.$id, $this->body($id))->assertConflict();
        $this->assertFalse($this->context($id)['can_update']);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_current_taxonomy_versions_are_sorted_and_retirement_requires_explicit_removal(): void
    {
        $actor = $this->signIn();
        $one = $this->termFixture($actor, 'topic', 'first-topic');
        $two = $this->termFixture($actor, 'tag', 'second-tag');
        $selections = [['id' => $two->public_id, 'kind' => 'tag'], ['id' => $one->public_id, 'kind' => 'topic']];
        $id = $this->postJson(self::BASE, $this->body(replace: ['taxonomy' => $selections]))->assertCreated()->json('data.id');
        $original = DB::table('article_versions')->first();
        $one = $this->appendTermFixture($one, $actor, true);
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['taxonomy' => $selections]))->assertOk()->assertJsonPath('data.working.version', 2);
        $current = $this->getJson(self::BASE.'/'.$id)->assertOk()->json('data.working.taxonomy');
        $this->assertSame(2, collect($current)->firstWhere('id', $one->public_id)['version']);
        $this->getJson(self::BASE.'/'.$id.'/versions/'.$original->public_id)->assertOk()->assertJsonPath('data.taxonomy.0.labels.en', 'Heart health');
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['taxonomy' => array_reverse($selections)]))->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $this->appendTermFixture($one, $actor, false);
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['taxonomy' => $selections]))->assertUnprocessable();
        $this->putJson(self::BASE.'/'.$id, $this->body($id))->assertOk()->assertJsonPath('data.working.taxonomy', []);
        $this->assertEquals($original, DB::table('article_versions')->find($original->id));
    }

    public function test_stale_duplicate_noop_and_incompatible_tokens_cannot_append_another_version(): void
    {
        $actor = $this->signIn();
        $body = $this->body();
        $id = $this->postJson(self::BASE, $body)->assertCreated()->json('data.id');
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertConflict();
        $this->putJson(self::BASE.'/'.$id, $this->body($id))->assertConflict();
        $readerToken = $this->getJson(self::BASE.'/'.$id)->assertOk()->json('meta.revision');
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['expected_revision' => $readerToken]))->assertConflict();
        $termToken = $this->getJson('/api/admin/article-taxonomies/write-context')->assertOk()->json('data.revision');
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['expected_revision' => $termToken]))->assertConflict();
        $other = $this->articleFixture($actor, 'other-article');
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['expected_revision' => $this->context($other->public_id)['revision']]))->assertConflict();
        $saved = $this->body($id, ['translations' => ['en' => ['title' => 'Next']]]);
        $this->signIn(User::factory()->admin()->create());
        $this->putJson(self::BASE.'/'.$id, $saved)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $this->signIn($actor);
        $this->postJson(self::BASE, $this->body(replace: ['slug' => 'new-article']))->assertCreated();
        $this->putJson(self::BASE.'/'.$id, $saved)->assertConflict();
        $this->assertSame(1, (int) DB::table('articles')->where('public_id', $id)->value('working_version'));
    }

    public static function invalidInputs(): array
    {
        return [
            'unknown field' => [['author_user_id' => 1]], 'manual publication' => [['published_version' => 1]],
            'manual state' => [['working_state' => 'published']], 'bad slug' => [['slug' => 'Upper-case']],
            'bad title length' => [['translations' => ['en' => ['title' => str_repeat('ع', 201)]]]],
            'bad body length' => [['translations' => ['en' => ['body_html' => str_repeat('a', 20001)]]]],
            'unsupported language' => [['translations' => ['de' => ['title' => 'Title']]]],
            'nested title' => [['translations' => ['en' => ['title' => ['nested']]]]],
            'control byte' => [['translations' => ['en' => ['title' => "Title\0"]]]],
            'fake medical reference' => [['health_references' => ['condition.unknown']]],
            'duplicate medical reference' => [['health_references' => ['condition.diabetes', 'condition.diabetes']]],
            'unsafe source link' => [['source_links' => [['url' => 'javascript:alert(1)', 'label' => 'Unsafe']]]],
            'duplicate source links' => [['source_links' => [['url' => 'https://example.test', 'label' => 'One'], ['url' => 'https://example.test', 'label' => 'Two']]]],
            'invalid taxonomy shape' => [['taxonomy' => ['bad' => ['id' => 'bad', 'kind' => 'tag']]]],
            'excess taxonomy' => [['taxonomy' => array_fill(0, 31, ['id' => '01j00000000000000000000001', 'kind' => 'tag'])]],
            'missing confirmation' => [['confirmed' => false]], 'blank reason' => [['reason' => " \u{200b}"]],
            'reason control' => [['reason' => "Reason\0"]], 'bad revision' => [['expected_revision' => 'bad']],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_input_contracts_refuse_without_partial_content_links_or_audits(array $replace): void
    {
        $this->signIn();
        $body = $this->body(replace: $replace);
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertUnprocessable()->assertDontSee('SQLSTATE');
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_missing_wrong_kind_duplicate_and_retired_taxonomy_references_refuse(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor);
        $retired = $this->appendTermFixture($this->termFixture($actor, 'tag', 'retired-tag'), $actor, false);
        $invalid = [[['id' => strtolower((string) Str::ulid()), 'kind' => 'topic']], [['id' => $term->public_id, 'kind' => 'category']],
            [['id' => $retired->public_id, 'kind' => 'tag']], [['id' => $term->public_id, 'kind' => 'topic'], ['id' => strtoupper($term->public_id), 'kind' => 'topic']],
            [['id' => $term->public_id, 'kind' => 'topic', 'version_id' => strtolower((string) Str::ulid())]]];
        $before = $this->fingerprint();
        foreach ($invalid as $taxonomy) {
            $this->postJson(self::BASE, $this->body(replace: ['taxonomy' => $taxonomy]))->assertUnprocessable();
        }
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_late_audit_failure_rolls_back_new_and_existing_drafts_references_and_catalog_revision(): void
    {
        $actor = $this->signIn();
        $article = $this->publishFixture($this->articleFixture($actor), $actor);
        $term = $this->termFixture($actor);
        $this->mock(AuditLogger::class)->shouldReceive('log')->twice()->andThrow(new RuntimeException('Private synthetic diagnostic'));
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $this->body())->assertStatus(503)->assertDontSee('Private synthetic diagnostic');
        $this->putJson(self::BASE.'/'.$article->public_id, $this->body($article->public_id, ['taxonomy' => [['id' => $term->public_id, 'kind' => 'topic']]]))->assertStatus(503);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_feature_schema_queries_and_missing_entities_fail_closed(): void
    {
        $this->signIn();
        $body = $this->body();
        config(['article_content.enabled' => false]);
        $this->postJson(self::BASE, $body)->assertStatus(503);
        config(['article_content.enabled' => true]);
        $missing = strtolower((string) Str::ulid());
        $this->getJson(self::BASE.'/'.$missing.'/write-context')->assertNotFound();
        $this->putJson(self::BASE.'/'.$missing, $body)->assertNotFound();
        $this->getJson(self::BASE.'/write-context?include=health')->assertUnprocessable();
        $this->postJson(self::BASE.'?unknown=1', $body)->assertUnprocessable();
        Schema::drop('article_version_terms');
        $this->postJson(self::BASE, $body)->assertStatus(503);
        $this->assertSame(0, DB::table('articles')->count());
        $this->assertSame(0, AuditEvent::count());
    }

    public static function authorityChanges(): array
    {
        return [['role'], ['state']];
    }

    #[DataProvider('authorityChanges')]
    public function test_authority_is_rechecked_after_route_checks_at_the_catalog_lock(string $change): void
    {
        $actor = $this->signIn();
        $actor->load('roles');
        $body = $this->body();
        $before = $this->fingerprint();
        $changed = false;
        DB::connection()->beforeExecuting(function ($sql) use ($actor, $change, &$changed): void {
            if (! $changed && str_contains($sql, 'article_catalog_state')) {
                $changed = true;
                if ($change === 'role') {
                    User::findOrFail($actor->id)->syncRoles('patient');
                } elseif ($change === 'state') {
                    User::whereKey($actor->id)->update(['account_state' => AccountState::Suspended->value]);
                }
            }
        });
        $this->postJson(self::BASE, $body)->assertForbidden();
        $this->assertTrue($changed);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_corrupt_stored_content_or_term_version_refuses_without_repair(): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $body = $this->body($article->public_id);
        DB::table('article_versions')->where('article_id', $article->id)->update(['content_hash' => str_repeat('0', 64)]);
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$article->public_id, $body)->assertStatus(503);
        $this->assertSame($before, $this->fingerprint());
        $term = $this->termFixture($actor);
        DB::table('article_terms')->where('id', $term->id)->update(['current_version' => 9]);
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $this->body(replace: ['taxonomy' => [['id' => $term->public_id, 'kind' => 'topic']]]))->assertStatus(503);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_raw_json_is_bounded_and_malformed_or_non_object_payloads_refuse(): void
    {
        $this->signIn();
        $before = $this->fingerprint();
        foreach (['[]', 'null', '{"broken":', str_repeat(' ', 1048577).'{}', "{\"title\":\"\xff\"}"] as $raw) {
            $this->call('POST', self::BASE, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:3000'], $raw)->assertUnprocessable();
        }
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_successful_writes_do_not_query_private_health_read_full_users_or_consume_jobs(): void
    {
        $this->signIn();
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
        $id = $this->postJson(self::BASE, $this->body())->assertCreated()->assertJsonMissingPath('data.password')->json('data.id');
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['source_links' => []]))->assertOk();
        $this->assertSame([], $health);
        $this->assertSame([], $broad);
        $this->assertSame($jobs, DB::table('jobs')->get()->toJson());
    }

    public function test_taxonomy_rename_invalidates_outstanding_draft_tokens_and_new_save_uses_the_current_term_version(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor);
        $body = $this->body(replace: ['taxonomy' => [['id' => $term->public_id, 'kind' => 'topic']]]);
        $termRevision = $this->getJson('/api/admin/article-taxonomies/'.$term->public_id.'/write-context')->assertOk()->json('data.revision');
        $this->putJson('/api/admin/article-taxonomies/'.$term->public_id, ['expected_revision' => $termRevision, 'reason' => 'Synthetic rename', 'confirmed' => true,
            'labels' => ['en' => 'Current label']])->assertOk();
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $body['expected_revision'] = $this->context()['revision'];
        $id = $this->postJson(self::BASE, $body)->assertCreated()->assertJsonPath('data.working.taxonomy.0.version', 2)
            ->assertJsonPath('data.working.taxonomy.0.labels.en', 'Current label')->json('data.id');
        $saved = $this->body($id, ['translations' => ['en' => ['title' => 'Changed']]]);
        $termRevision = $this->getJson('/api/admin/article-taxonomies/'.$term->public_id.'/write-context')->assertOk()->json('data.revision');
        $this->postJson('/api/admin/article-taxonomies/'.$term->public_id.'/actions', ['expected_revision' => $termRevision, 'reason' => 'Synthetic retirement',
            'confirmed' => true, 'action' => 'retire'])->assertOk();
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$id, $saved)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public static function reviewStates(): array
    {
        return [['in_review'], ['reviewed']];
    }

    #[DataProvider('reviewStates')]
    public function test_edits_invalidate_the_exact_working_review_without_publishing(string $state): void
    {
        $actor = $this->signIn();
        $article = $this->articleFixture($actor);
        $version = DB::table('article_versions')->where('article_id', $article->id)->first();
        DB::table('articles')->where('id', $article->id)->update(['working_state' => $state, 'reviewed_version' => $state === 'reviewed' ? 1 : null,
            'reviewed_hash' => $state === 'reviewed' ? $version->content_hash : null,
            'reviewed_by_user_id' => $state === 'reviewed' ? $actor->id : null, 'reviewed_at' => $state === 'reviewed' ? now() : null]);
        $this->putJson(self::BASE.'/'.$article->public_id, $this->body($article->public_id))->assertOk()
            ->assertJsonPath('data.working_state', 'draft')->assertJsonPath('data.review', null)->assertJsonPath('data.published', null);
        $stored = DB::table('articles')->find($article->id);
        $this->assertNull($stored->reviewed_version);
        $this->assertNull($stored->reviewed_hash);
        $this->assertNull($stored->reviewed_by_user_id);
        $this->assertNull($stored->reviewed_at);
    }

    public function test_malformed_category_ancestry_is_fail_closed_for_new_article_links(): void
    {
        $actor = $this->signIn();
        $one = $this->termFixture($actor, 'category', 'cycle-one');
        $two = $this->termFixture($actor, 'category', 'cycle-two');
        foreach ([[$one, $two], [$two, $one]] as [$term, $parent]) {
            DB::table('article_terms')->where('id', $term->id)->update(['parent_id' => $parent->id]);
            DB::table('article_term_versions')->where('term_id', $term->id)->update(['parent_id' => $parent->id]);
        }
        $body = $this->body(replace: ['taxonomy' => [['id' => $one->public_id, 'kind' => 'category']]]);
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertStatus(503)->assertDontSee('SQLSTATE');
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_bounded_multibyte_labels_and_long_source_links_round_trip_within_reader_limits(): void
    {
        $this->signIn();
        $sources = [];
        for ($index = 0; $index < 20; $index++) {
            $sources[] = ['url' => 'https://example.test/'.$index.'/'.str_repeat('a', 2020), 'label' => str_repeat("\u{1f600}", 200)];
        }
        $id = $this->postJson(self::BASE, $this->body(replace: ['source_links' => $sources]))->assertCreated()->json('data.id');
        $this->getJson(self::BASE.'/'.$id)->assertOk()->assertJsonPath('data.working.source_links', $sources);
        $stored = DB::table('article_versions')->first();
        $this->assertLessThan(500000, strlen($stored->source_links));
        $this->assertSame($sources, json_decode($stored->source_links, true, 24, JSON_THROW_ON_ERROR));
    }
}
