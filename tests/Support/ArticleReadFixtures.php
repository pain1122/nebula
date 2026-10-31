<?php

namespace Tests\Support;

use App\Models\User;
use App\Services\Content\ArticleContent;
use App\Services\Content\ArticleSnapshots;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Direct fixtures only inside the guarded memory database; not writer/publication acceptance. */
trait ArticleReadFixtures
{
    private function termFixture(User $actor, string $kind = 'topic', string $slug = 'heart-health', string $label = 'Heart health'): object
    {
        $id = DB::table('article_terms')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'kind' => $kind, 'slug' => $slug,
            'current_version' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('article_term_versions')->insert(['public_id' => strtolower((string) Str::ulid()), 'term_id' => $id,
            'version' => 1, 'schema_version' => 1, 'labels' => json_encode(['en' => $label, 'fa' => 'سلامت قلب'], JSON_THROW_ON_ERROR),
            'descriptions' => '{}', 'is_active' => true, 'actor_user_id' => $actor->id, 'recorded_at' => now()]);

        return DB::table('article_terms')->find($id);
    }

    private function appendTermFixture(object $term, User $actor, bool $active): object
    {
        $version = (int) DB::table('article_term_versions')->where('term_id', $term->id)->max('version') + 1;
        DB::table('article_term_versions')->insert(['public_id' => strtolower((string) Str::ulid()), 'term_id' => $term->id,
            'version' => $version, 'schema_version' => 1, 'labels' => '{"en":"Renamed term","fa":"نام تازه"}',
            'descriptions' => '{}', 'is_active' => $active, 'actor_user_id' => $actor->id, 'recorded_at' => now()]);
        DB::table('article_terms')->where('id', $term->id)->update(['current_version' => $version, 'is_active' => $active]);

        return DB::table('article_terms')->find($term->id);
    }

    private function articleFixture(User $actor, string $slug = 'synthetic-heart-health', array $terms = [], string $title = 'Heart health'): object
    {
        $id = DB::table('articles')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'slug' => $slug,
            'author_user_id' => $actor->id, 'working_version' => 0, 'working_state' => 'draft', 'created_at' => now(), 'updated_at' => now()]);

        return $this->appendArticleFixture(DB::table('articles')->find($id), $actor, $terms, $title);
    }

    private function appendArticleFixture(object $article, User $actor, array $terms = [], string $title = 'Replacement draft', string $body = '<p>Synthetic educational content.</p>'): object
    {
        $content = app(ArticleContent::class);
        $snapshots = app(ArticleSnapshots::class);
        $prepared = $content->prepare(['translations' => ['en' => ['title' => $title, 'summary' => 'Synthetic summary', 'body_html' => $body],
            'fa' => ['title' => 'مقاله قلب', 'summary' => 'خلاصه آموزشی', 'body_html' => '<p>متن آموزشی</p>']], 'health_references' => ['condition.diabetes']]);
        $references = [];
        $versions = [];
        foreach ($terms as $term) {
            $version = DB::table('article_term_versions')->where('term_id', $term->id)->where('version', $term->current_version)->first();
            $references[] = $snapshots->term($term, $version);
            $versions[$term->id] = $version->id;
        }
        usort($references, fn ($a, $b) => strcmp($a['id'], $b['id']));
        $number = (int) DB::table('article_versions')->where('article_id', $article->id)->max('version') + 1;
        $versionId = DB::table('article_versions')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'article_id' => $article->id,
            'version' => $number, 'schema_version' => 1, 'translations' => json_encode((object) $prepared['translations'], JSON_THROW_ON_ERROR),
            'health_catalog_version' => $prepared['health_catalog_version'], 'health_references' => json_encode($prepared['health_references'], JSON_THROW_ON_ERROR),
            'source_links' => '[]', 'content_hash' => $content->hash($prepared, $references), 'actor_user_id' => $actor->id, 'recorded_at' => now()]);
        foreach ($versions as $termId => $termVersion) {
            DB::table('article_version_terms')->insert(['article_version_id' => $versionId, 'term_id' => $termId, 'term_version_id' => $termVersion]);
        }
        DB::table('articles')->where('id', $article->id)->update(['working_version' => $number, 'working_state' => 'draft',
            'reviewed_version' => null, 'reviewed_hash' => null, 'reviewed_by_user_id' => null, 'reviewed_at' => null]);

        return DB::table('articles')->find($article->id);
    }

    private function publishFixture(object $article, User $actor): object
    {
        $version = DB::table('article_versions')->where('article_id', $article->id)->where('version', $article->working_version)->first();
        DB::table('articles')->where('id', $article->id)->update(['published_version' => $version->version, 'working_state' => 'published',
            'reviewed_version' => $version->version, 'reviewed_hash' => $version->content_hash, 'reviewed_by_user_id' => $actor->id, 'reviewed_at' => now()]);

        return DB::table('articles')->find($article->id);
    }
}
