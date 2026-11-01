<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Services\Content\ArticleContent;
use App\Services\Content\ArticleMediaEligibility;
use App\Services\Content\ArticleMediaReferences;
use App\Services\Content\ArticleMediaStorage;
use App\Support\MedicalContentPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ArticleReadFixtures;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

/** Synthetic source tests only, guarded memory SQLite and private tmpfs; not scanner acceptance. */
class PatientArticleReadTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private function patient(): User
    {
        config(['article_content.enabled' => true]);
        $patient = User::factory()->create();
        $patient->assignRole('patient');
        $this->actingAs($patient);

        return $patient;
    }

    public static function roles(): array
    {
        return [['guest', 401], ['doctor', 403], ['admin', 403], ['root-admin', 403], ['patient', 200]];
    }

    #[DataProvider('roles')]
    public function test_role_boundaries_and_private_errors(string $role, int $status): void
    {
        config(['article_content.enabled' => true]);
        $author = User::factory()->admin()->create();
        $article = $this->publishFixture($this->articleFixture($author), $author);
        if ($role !== 'guest') {
            $user = User::factory()->create();
            $user->assignRole($role);
            $this->actingAs($user);
        }
        foreach (['/api/my/articles', '/api/my/articles/'.$article->public_id, '/api/my/article-taxonomies?kind=category'] as $url) {
            $response = $this->getJson($url)->assertStatus($status);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            if ($status !== 200) {
                $response->assertDontSee('Heart health');
            }
        }
    }

    public function test_working_edits_do_not_change_patient_search_taxonomies_or_history(): void
    {
        $author = User::factory()->admin()->create();
        $old = $this->termFixture($author, 'category', 'old-category', 'Original category');
        $new = $this->termFixture($author, 'category', 'new-category', 'Draft category');
        $article = $this->publishFixture($this->articleFixture($author, terms: [$old]), $author);
        $this->appendArticleFixture($article, $author, [$new], 'Secret unpublished title');
        $this->patient();
        $result = $this->getJson('/api/my/articles')->assertOk()->assertJsonPath('meta.pagination.total', 1)
            ->assertJsonPath('data.0.title', 'Heart health')->assertJsonPath('data.0.categories.0.label', 'Original category');
        $result->assertDontSee('Secret unpublished')->assertDontSee('condition.diabetes')->assertDontSee('checksum_sha256');
        $this->getJson('/api/my/articles?q=Secret')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/my/articles?category_id='.$new->public_id)->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/my/article-taxonomies?kind=category')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $old->public_id);
        $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.title', 'Heart health')
            ->assertJsonPath('data.author.display_name', $author->name)->assertJsonMissingPath('data.working');
    }

    public function test_retired_and_renamed_terms_keep_published_labels_and_filter_membership(): void
    {
        $author = User::factory()->admin()->create();
        $term = $this->termFixture($author, 'tag');
        $this->publishFixture($this->articleFixture($author, terms: [$term]), $author);
        $this->appendTermFixture($term, $author, false);
        $this->patient();
        $this->getJson('/api/my/articles?tag_id='.$term->public_id)->assertOk()->assertJsonPath('data.0.tags.0.label', 'Heart health');
        $this->getJson('/api/my/article-taxonomies?kind=tag')->assertOk()->assertJsonPath('data.0.label', 'Heart health');
    }

    public function test_fallback_uses_one_complete_translation_without_health_records(): void
    {
        $author = User::factory()->admin()->create();
        $article = $this->articleFixture($author);
        $prepared = app(ArticleContent::class)->prepare(['translations' => [
            'en' => ['title' => 'Partial English', 'body_html' => ''],
            'fa' => ['title' => 'عنوان کامل', 'body_html' => '<p>متن کامل مقاله</p>'],
        ]], 2);
        DB::table('article_versions')->where('article_id', $article->id)->update(['schema_version' => 2,
            'translations' => json_encode($prepared['translations']), 'health_references' => '[]',
            'content_hash' => app(ArticleContent::class)->hash($prepared, [])]);
        $this->publishFixture($article, $author);
        $this->patient();
        $this->getJson('/api/my/articles/'.$article->public_id.'?language=en')->assertOk()
            ->assertJsonPath('data.content_language', 'fa')->assertJsonPath('data.fallback_used', true)
            ->assertJsonPath('data.title', 'عنوان کامل')->assertDontSee('Partial English');
    }

    public function test_queries_are_bounded_and_wildcards_are_literal(): void
    {
        $author = User::factory()->admin()->create();
        $this->publishFixture($this->articleFixture($author), $author);
        $this->patient();
        foreach (['per_page=25', 'page=0', 'language=xx', 'status=draft', 'tag_id=123', 'q[]=x'] as $query) {
            $this->getJson('/api/my/articles?'.$query)->assertStatus(422);
        }
        $this->getJson('/api/my/articles?q=%25')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/my/articles?tag_id='.strtolower((string) Str::ulid()))->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/my/article-taxonomies?kind=topic')->assertStatus(422);
    }

    public function test_pagination_and_order_use_published_versions_before_working_edits(): void
    {
        $author = User::factory()->admin()->create();
        $first = $this->publishFixture($this->articleFixture($author, 'older-publication'), $author);
        $second = $this->publishFixture($this->articleFixture($author, 'newer-publication'), $author);
        DB::table('article_versions')->where('article_id', $first->id)->update(['recorded_at' => '2026-10-20 12:00:00']);
        DB::table('article_versions')->where('article_id', $second->id)->update(['recorded_at' => '2026-10-21 12:00:00']);
        $this->appendArticleFixture($first, $author, title: 'Newest but unpublished');
        $this->patient();
        $this->getJson('/api/my/articles?per_page=1')->assertOk()->assertJsonPath('data.0.id', $second->public_id)
            ->assertJsonPath('meta.pagination.total', 2)->assertJsonPath('meta.pagination.last_page', 2);
        $this->getJson('/api/my/articles?per_page=1&page=2')->assertOk()->assertJsonPath('data.0.id', $first->public_id);
    }

    public function test_disabled_feature_and_missing_schema_never_expose_content(): void
    {
        $this->patient();
        config(['article_content.enabled' => false]);
        $this->getJson('/api/my/articles')->assertStatus(503);
        config(['article_content.enabled' => true]);
        \Illuminate\Support\Facades\Schema::drop('article_version_terms');
        $this->getJson('/api/my/articles')->assertStatus(503);
    }

    public function test_archive_revocation_and_corruption_fail_closed(): void
    {
        $author = User::factory()->admin()->create();
        $article = $this->publishFixture($this->articleFixture($author), $author);
        $patient = $this->patient();
        DB::table('article_versions')->where('article_id', $article->id)->update(['content_hash' => str_repeat('0', 64)]);
        $this->getJson('/api/my/articles/'.$article->public_id)->assertStatus(503)->assertDontSee('Heart health');
        DB::table('articles')->where('id', $article->id)->update(['archived_at' => now()]);
        $this->getJson('/api/my/articles/'.$article->public_id)->assertNotFound();
        $this->getJson('/api/my/articles')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $patient->load('roles');
        User::findOrFail($patient->id)->syncRoles('doctor');
        $this->getJson('/api/my/articles')->assertForbidden();
    }

    private function imageFixture(User $author, object $article): array
    {
        config(['article_content.media_enabled' => true]);
        $id = strtolower((string) Str::ulid());
        $bytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
        $checksum = hash('sha256', $bytes);
        $storage = app(ArticleMediaStorage::class);
        $key = $storage->key($id, 'image/png');
        $storage->disk()->put($key, $bytes, ['visibility' => 'private']);
        $asset = DB::table('article_media_assets')->insertGetId(['public_id' => $id, 'actor_user_id' => $author->id,
            'purpose' => 'article_editorial', 'disk' => 'article-media', 'object_key' => $key, 'display_name' => 'fixture.png',
            'mime_type' => 'image/png', 'size_bytes' => strlen($bytes), 'checksum_sha256' => $checksum, 'width' => 1, 'height' => 1,
            'status' => 'released', 'revision' => 2, 'upload_policy_revision' => app(ArticleMediaEligibility::class)->policy()['revision'],
            'validation_evidence' => json_encode(['scanner_engine' => 'clamav', 'scanner_version' => '1.5.4', 'scanner_database_version' => '28199',
                'scanner_database_updated_at' => date(DATE_ATOM), 'scan_checksum_sha256' => $checksum,
                'content_policy_revision' => MedicalContentPolicy::current()->revision, 'content_validator' => 'gd-2.3.3/medical-v1']),
            'validated_at' => now(), 'released_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        $snapshot = app(ArticleMediaEligibility::class)->snapshot(DB::table('article_media_assets')->find($asset));
        $presentation = ['publication' => null, 'thumbnail' => ['asset' => $snapshot, 'alt' => ['en' => 'Fixture', 'fa' => '']],
            'inline' => [['asset' => $snapshot, 'language' => 'en']]];
        $prepared = app(ArticleContent::class)->prepare(['translations' => ['en' => ['title' => 'Published image',
            'body_html' => '<p>Readable text.</p><figure class="image"><img src="/api/admin/article-media/'.$id.'/content" alt="Fixture"></figure>']],
            'presentation' => $presentation], 3, true);
        DB::table('article_versions')->where('article_id', $article->id)->update(['schema_version' => 3,
            'translations' => json_encode($prepared['translations']), 'health_references' => '[]', 'presentation' => json_encode($presentation),
            'content_hash' => app(ArticleContent::class)->hash($prepared, [])]);
        app(ArticleMediaReferences::class)->store($article->id, 1, $presentation);

        return [$id, $bytes, $key];
    }

    public function test_images_are_bound_to_current_publication_and_exact_bytes(): void
    {
        $author = User::factory()->admin()->create();
        $article = $this->articleFixture($author);
        [$id, $bytes, $key] = $this->imageFixture($author, $article);
        $this->publishFixture($article, $author);
        $this->patient();
        $detail = $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->json('data');
        $path = $detail['thumbnail']['content_path'];
        $this->assertStringNotContainsString('/api/admin/', $detail['body_html']);
        $this->assertSame($bytes, $this->get($path)->assertOk()->streamedContent());
        $this->get(str_replace($id, strtolower((string) Str::ulid()), $path))->assertNotFound();
        $this->get('/api/admin/article-media/'.$id.'/content')->assertForbidden();
        app(ArticleMediaStorage::class)->disk()->put($key, 'changed');
        $this->get($path)->assertStatus(503);
        $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.title', 'Published image');
        DB::table('article_media_assets')->where('public_id', $id)->update(['status' => 'retired', 'archived_at' => now()]);
        $this->get($path)->assertNotFound();
        $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.thumbnail', null)
            ->assertDontSee('<img', false)->assertSee('Readable text.');
    }

    public function test_media_disabled_and_old_publication_do_not_expose_images(): void
    {
        $author = User::factory()->admin()->create();
        $article = $this->articleFixture($author);
        $this->imageFixture($author, $article);
        $article = $this->publishFixture($article, $author);
        $this->patient();
        $path = $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->json('data.thumbnail.content_path');
        $asset = DB::table('article_media_assets')->first();
        $evidence = json_decode($asset->validation_evidence, true);
        $evidence['scanner_database_updated_at'] = date(DATE_ATOM, time() - 172801);
        DB::table('article_media_assets')->where('id', $asset->id)->update(['validation_evidence' => json_encode($evidence)]);
        $this->get($path)->assertNotFound();
        $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.thumbnail', null);
        DB::table('article_media_assets')->where('id', $asset->id)->update(['validation_evidence' => $asset->validation_evidence]);
        config(['article_content.media_enabled' => false]);
        $this->getJson('/api/my/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.thumbnail', null);
        $this->get($path)->assertNotFound();
        config(['article_content.media_enabled' => true]);
        $updated = $this->appendArticleFixture($article, $author);
        $this->publishFixture($updated, $author);
        $this->get($path)->assertNotFound();
    }
}
