<?php

namespace Tests\Feature\Api;

use App\Enums\AccountState;
use App\Models\User;
use App\Services\Content\ArticleContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ArticleReadFixtures;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleAdministrationReadTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private function enable(?User $actor = null): User
    {
        config(['article_content.enabled' => true]);
        $actor ??= User::factory()->admin()->create();
        $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000');

        return $actor;
    }

    private function endpoints(object $article, object $term): array
    {
        $versionId = DB::table('article_versions')->where('article_id', $article->id)->value('public_id');

        return ['/api/admin/articles', '/api/admin/articles/'.$article->public_id, '/api/admin/articles/'.$article->public_id.'/versions',
            '/api/admin/articles/'.$article->public_id.'/versions/'.$versionId, '/api/admin/article-taxonomies',
            '/api/admin/article-taxonomies/'.$term->public_id, '/api/admin/article-taxonomies/'.$term->public_id.'/versions'];
    }

    public static function roles(): array
    {
        return [['guest', 401], ['patient', 403], ['doctor', 403], ['admin', 200], ['root-admin', 200]];
    }

    #[DataProvider('roles')]
    public function test_all_read_surfaces_enforce_role_authority_and_no_store(string $role, int $status): void
    {
        $admin = User::factory()->admin()->create();
        $term = $this->termFixture($admin);
        $article = $this->articleFixture($admin, terms: [$term]);
        config(['article_content.enabled' => true]);
        if ($role !== 'guest') {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->actingAs($actor);
        }
        foreach ($this->endpoints($article, $term) as $path) {
            $response = $this->getJson($path)->assertStatus($status);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            if ($status !== 200) {
                $response->assertDontSee('Synthetic summary')->assertDontSee('Heart health');
            } else {
                $response->assertJsonPath('meta.read_only', true);
                $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $response->json('meta.revision'));
            }
        }
    }

    public function test_disabled_feature_and_missing_schema_refuse_without_fallback(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin);
        $this->assertFalse(config('article_content.enabled'));
        $this->getJson('/api/admin/articles')->assertStatus(503)->assertJsonPath('data', null);
        config(['article_content.enabled' => true]);
        Schema::drop('article_version_terms');
        $this->getJson('/api/admin/articles')->assertStatus(503)->assertJsonPath('data', null);
    }

    public function test_cached_admin_identity_cannot_survive_role_revocation_or_suspension(): void
    {
        $admin = $this->enable();
        $admin->load('roles');
        User::findOrFail($admin->id)->syncRoles('patient');
        $this->getJson('/api/admin/articles')->assertForbidden();
        User::findOrFail($admin->id)->syncRoles('admin');
        User::whereKey($admin->id)->update(['account_state' => AccountState::Suspended->value]);
        $this->getJson('/api/admin/articles')->assertForbidden();
    }

    public function test_lists_use_public_filters_literal_search_stable_paging_and_compact_resources(): void
    {
        $admin = $this->enable();
        $category = $this->termFixture($admin, 'category', 'preventive-care');
        $tag = $this->termFixture($admin, 'tag', 'test-tag');
        $topic = $this->termFixture($admin);
        $first = $this->articleFixture($admin, 'article-one', [$category, $topic, $tag], '100% heart_test');
        $other = User::factory()->admin()->create();
        $second = $this->articleFixture($other, 'article-two', title: '100 percent heart test');
        $this->getJson('/api/admin/articles?q='.urlencode('% heart_'))->assertOk()->assertJsonPath('meta.pagination.total', 1)
            ->assertJsonPath('data.0.id', $first->public_id)->assertJsonMissingPath('data.0.working.translations.en.body_html');
        $this->getJson('/api/admin/articles?q='.urlencode('مقاله'))->assertOk()->assertJsonPath('meta.pagination.total', 2);
        $query = http_build_query(['category_id' => $category->public_id, 'topic_id' => $topic->public_id, 'tag_id' => $tag->public_id, 'author_id' => $admin->public_id]);
        $this->getJson('/api/admin/articles?'.$query)->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('meta.taxonomy_filter_basis', 'working_version');
        $this->getJson('/api/admin/articles?category_id='.$tag->public_id)->assertUnprocessable();
        $this->getJson('/api/admin/articles?sort=slug&direction=asc&per_page=1&page=2')->assertOk()->assertJsonPath('data.0.id', $second->public_id)
            ->assertJsonPath('meta.pagination.total', 2)->assertJsonPath('meta.pagination.per_page', 1);
        $this->getJson('/api/admin/articles?author_id='.strtolower((string) Str::ulid()))->assertOk()->assertJsonPath('data', []);
    }

    public function test_publication_view_and_history_keep_original_version_when_a_draft_is_appended(): void
    {
        $admin = $this->enable();
        $article = $this->publishFixture($this->articleFixture($admin, title: 'Original published title'), $admin);
        $original = DB::table('article_versions')->where('article_id', $article->id)->first();
        $article = $this->appendArticleFixture($article, $admin, title: 'Unpublished replacement');
        $base = '/api/admin/articles/'.$article->public_id;
        $this->getJson($base)->assertOk()->assertJsonPath('data.status', 'published_with_draft')->assertJsonPath('data.working.version', 2)
            ->assertJsonPath('data.published.version', 1)->assertJsonPath('data.published.translations.en.title', 'Original published title')
            ->assertJsonPath('data.working.translations.en.title', 'Unpublished replacement');
        $this->getJson('/api/admin/articles?status=published_with_draft')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/articles?status=draft')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson($base.'/versions?per_page=1')->assertOk()->assertJsonPath('data.0.version', 2)->assertJsonPath('meta.pagination.total', 2)
            ->assertJsonMissingPath('data.0.translations.en.body_html');
        $this->getJson($base.'/versions/'.$original->public_id)->assertOk()->assertJsonPath('data.version', 1)->assertJsonPath('data.translations.en.title', 'Original published title');
        $foreign = $this->articleFixture($admin, 'another-article');
        $foreignVersion = DB::table('article_versions')->where('article_id', $foreign->id)->value('public_id');
        $this->getJson($base.'/versions/'.$foreignVersion)->assertNotFound();
        $this->getJson('/api/admin/articles/'.$article->id)->assertNotFound();
        DB::table('articles')->where('id', $article->id)->update(['archived_at' => now()]);
        $this->getJson('/api/admin/articles?status=archived')->assertOk()->assertJsonPath('data.0.status', 'archived');
    }

    public function test_retired_renamed_taxonomy_keeps_its_original_article_snapshot_and_history(): void
    {
        $admin = $this->enable();
        $term = $this->termFixture($admin);
        $article = $this->articleFixture($admin, terms: [$term]);
        $term = $this->appendTermFixture($term, $admin, false);
        $this->getJson('/api/admin/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.working.taxonomy.0.labels.en', 'Heart health')
            ->assertJsonPath('data.working.taxonomy.0.is_active', true)->assertJsonPath('data.working.taxonomy.0.currently_active', false);
        $this->getJson('/api/admin/article-taxonomies?active=0&kind=topic&q=Renamed')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/article-taxonomies?active=1')->assertOk()->assertJsonPath('data', []);
        $this->getJson('/api/admin/article-taxonomies/'.$term->public_id)->assertOk()->assertJsonPath('data.version', 2)->assertSee('"descriptions":{}', false);
        $this->getJson('/api/admin/article-taxonomies/'.$term->public_id.'/versions?per_page=1&page=2')->assertOk()
            ->assertJsonPath('data.0.labels.en', 'Heart health')->assertJsonPath('data.0.is_current', false)->assertJsonPath('meta.pagination.total', 2);
    }

    public function test_category_parent_filter_and_unsupported_current_term_schema_are_safe(): void
    {
        $admin = $this->enable();
        $parent = $this->termFixture($admin, 'category', 'parent-category');
        $child = $this->termFixture($admin, 'category', 'child-category');
        DB::table('article_terms')->where('id', $child->id)->update(['parent_id' => $parent->id]);
        DB::table('article_term_versions')->where('term_id', $child->id)->update(['parent_id' => $parent->id]);
        $this->getJson('/api/admin/article-taxonomies?parent_id='.$parent->public_id)->assertOk()->assertJsonPath('data.0.parent_id', $parent->public_id);
        $this->getJson('/api/admin/article-taxonomies?parent_id='.$child->public_id)->assertOk()->assertJsonPath('data', []);
        DB::table('article_term_versions')->where('term_id', $child->id)->update(['schema_version' => 2]);
        $this->getJson('/api/admin/article-taxonomies/'.$child->public_id)->assertStatus(503)->assertJsonPath('data', null);
    }

    public static function invalidQueries(): array
    {
        return [['articles?per_page=51'], ['articles?page=0'], ['articles?sort=payload'], ['articles?direction=sideways'],
            ['articles?status=clean'], ['articles?author_id=1'], ['articles?patient_id=private'], ['articles?q[]=bad'],
            ['articles?language=de'], ['article-taxonomies?kind=condition'], ['article-taxonomies?active=true'],
            ['article-taxonomies?parent_id=1'], ['article-taxonomies?per_page=1000']];
    }

    #[DataProvider('invalidQueries')]
    public function test_invalid_or_unbounded_queries_refuse_without_reflecting_values(string $query): void
    {
        $this->enable();
        $response = $this->getJson('/api/admin/'.$query)->assertUnprocessable();
        $response->assertDontSee('private')->assertJsonPath('data', null);
    }

    public static function corruptionKinds(): array
    {
        return [['hash'], ['schema'], ['catalog'], ['missing_working'], ['missing_published'], ['stale_review'], ['unsafe_body'], ['forged_unsafe_hash']];
    }

    #[DataProvider('corruptionKinds')]
    public function test_corrupt_or_inconsistent_storage_refuses_without_partial_content(string $kind): void
    {
        $admin = $this->enable();
        $article = $this->articleFixture($admin);
        $version = DB::table('article_versions')->where('article_id', $article->id)->first();
        if ($kind === 'hash') {
            DB::table('article_versions')->where('id', $version->id)->update(['content_hash' => str_repeat('0', 64)]);
        } elseif ($kind === 'schema' || $kind === 'catalog') {
            DB::table('article_versions')->where('id', $version->id)->update($kind === 'schema' ? ['schema_version' => 2] : ['health_catalog_version' => 'unsupported']);
        } elseif (in_array($kind, ['missing_working', 'missing_published'], true)) {
            DB::table('articles')->where('id', $article->id)->update([$kind === 'missing_working' ? 'working_version' : 'published_version' => 99]);
        } elseif ($kind === 'stale_review') {
            DB::table('articles')->where('id', $article->id)->update(['working_state' => 'reviewed', 'reviewed_version' => 1,
                'reviewed_hash' => str_repeat('0', 64), 'reviewed_by_user_id' => $admin->id, 'reviewed_at' => now()]);
        } else {
            $translations = json_decode($version->translations, true, 24, JSON_THROW_ON_ERROR);
            $translations['en']['body_html'] .= '<script>private-content-marker</script>';
            $changes = ['translations' => json_encode($translations, JSON_THROW_ON_ERROR)];
            if ($kind === 'forged_unsafe_hash') {
                $changes['content_hash'] = app(ArticleContent::class)->hash(['schema_version' => 1, 'translations' => $translations,
                    'health_catalog_version' => $version->health_catalog_version, 'health_references' => json_decode($version->health_references, true), 'source_links' => []]);
            }
            DB::table('article_versions')->where('id', $version->id)->update($changes);
        }
        foreach (['/api/admin/articles', '/api/admin/articles/'.$article->public_id] as $path) {
            $this->getJson($path)->assertStatus(503)->assertJsonPath('data', null)->assertDontSee('Synthetic summary')
                ->assertDontSee('private-content-marker')->assertDontSee('SQLSTATE');
        }
    }

    public function test_empty_lists_unknown_entities_and_detail_query_allowlists_are_bounded(): void
    {
        $admin = $this->enable();
        $this->getJson('/api/admin/articles')->assertOk()->assertJsonPath('data', [])->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/admin/article-taxonomies')->assertOk()->assertJsonPath('data', []);
        $this->getJson('/api/admin/articles/'.strtolower((string) Str::ulid()))->assertNotFound();
        $article = $this->articleFixture($admin);
        $this->getJson('/api/admin/articles/'.$article->public_id.'?include=password')->assertUnprocessable();
        $this->getJson('/api/admin/articles/'.$article->public_id.'/versions?per_page=51')->assertUnprocessable();
        // Reading does not authorize an unbound draft; the writer still validates its payload.
        $this->postJson('/api/admin/articles', [])->assertUnprocessable();
    }

    public function test_revisions_bind_catalog_and_current_actor_and_ignore_stored_json_object_order(): void
    {
        $admin = $this->enable();
        $term = $this->termFixture($admin);
        $article = $this->articleFixture($admin, terms: [$term]);
        $path = '/api/admin/articles/'.$article->public_id;
        $first = $this->getJson($path)->assertOk()->json('meta.revision');
        $this->getJson('/api/admin/articles/'.strtoupper($article->public_id))->assertOk()->assertJsonPath('meta.revision', $first);
        $row = DB::table('article_versions')->where('article_id', $article->id)->first();
        $translations = json_decode($row->translations, true, 24, JSON_THROW_ON_ERROR);
        foreach ($translations as &$translation) {
            $translation = array_reverse($translation, true);
        }
        unset($translation);
        DB::table('article_versions')->where('id', $row->id)->update(['translations' => json_encode(array_reverse($translations, true), JSON_THROW_ON_ERROR)]);
        $labels = DB::table('article_term_versions')->where('term_id', $term->id)->value('labels');
        DB::table('article_term_versions')->where('term_id', $term->id)->update(['labels' => json_encode(array_reverse(json_decode($labels, true), true), JSON_THROW_ON_ERROR)]);
        $this->getJson($path)->assertOk()->assertJsonPath('meta.revision', $first);
        DB::table('article_catalog_state')->where('id', 1)->update(['revision' => 1]);
        $changedCatalog = $this->getJson($path)->assertOk()->json('meta.revision');
        $this->assertNotSame($first, $changedCatalog);
        $this->enable(User::factory()->rootAdmin()->create());
        $this->assertNotSame($changedCatalog, $this->getJson($path)->assertOk()->json('meta.revision'));
    }

    public function test_successful_reads_are_stable_read_only_and_exclude_private_fields_and_health_queries(): void
    {
        $admin = $this->enable();
        $term = $this->termFixture($admin);
        $article = $this->articleFixture($admin, terms: [$term]);
        DB::table('jobs')->insert(['queue' => 'unrelated-sentinel', 'payload' => '{"synthetic":true}', 'attempts' => 0,
            'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
        $tables = ['users', 'jobs', 'audit_events', 'reservations', 'setting_values', 'patient_health_snapshots',
            'patient_biometric_observations', 'article_catalog_state', 'articles', 'article_versions', 'article_terms', 'article_term_versions', 'article_version_terms'];
        $state = fn () => collect($tables)->mapWithKeys(fn ($t) => [$t => hash('sha256', DB::table($t)->get()->toJson())])->all();
        $before = $state();
        $writes = [];
        $healthQueries = [];
        $broadUserReads = [];
        DB::listen(function ($event) use (&$writes, &$healthQueries, &$broadUserReads) {
            if (preg_match('/^\s*(insert|update|delete|replace|create|alter|drop|truncate)\b/i', $event->sql)) {
                $writes[] = $event->sql;
            }
            if (preg_match('/patient_health|patient_biometric|reservation_medical|reservation_files|reservation_reports/i', $event->sql)) {
                $healthQueries[] = $event->sql;
            }
            if (preg_match('/\bselect\s+\*\s+from\s+["`]?users\b/i', $event->sql)) {
                $broadUserReads[] = $event->sql;
            }
        });
        $first = $this->getJson('/api/admin/articles/'.$article->public_id)->assertOk();
        $this->getJson('/api/admin/articles/'.$article->public_id)->assertOk()->assertJsonPath('meta.revision', $first->json('meta.revision'));
        foreach ($this->endpoints($article, $term) as $path) {
            $response = $this->getJson($path)->assertOk();
            foreach ([$admin->email, $admin->password, 'identity_number', 'national_id', 'remember_token', 'email_verified_at', 'password'] as $private) {
                $response->assertDontSee($private);
            }
        }
        // Snapshot comparisons themselves query health counts; stop counting reader queries first.
        $this->assertSame([], $writes);
        $this->assertSame([], $healthQueries);
        $this->assertSame([], $broadUserReads);
        $this->assertSame($before, $state());
    }
}
