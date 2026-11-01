<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Content\ArticleContent;
use App\Services\Content\ArticleDraftWrite;
use App\Services\Content\ArticleMediaLibrary;
use Database\Seeders\Support\DemoArticleShowcase;
use Database\Seeders\Support\DemoFixtureContext;
use Database\Seeders\Support\SyntheticDemoFiles;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use LogicException;

/** Additive, repeat-safe showcase. Never resets the profile or consumes medical jobs. */
class ArticleShowcaseSeeder extends Seeder
{
    public function run(): void
    {
        DemoFixtureContext::guardOwnedDatabase();
        $enabled = config('article_content.enabled');
        config(['article_content.enabled' => true]);
        try {
            $actor = User::where('email', 'rootadmin@checkupino.test')->firstOrFail();
            $writer = app(ArticleDraftWrite::class);
            $row = DB::table('articles')->where('slug', DemoArticleShowcase::SLUG)->first();
            $taxonomy = [];
            foreach (['demo-using-checkupino', 'demo-getting-started'] as $slug) {
                $term = DB::table('article_terms')->where('slug', $slug)->firstOrFail();
                $taxonomy[] = ['id' => $term->public_id, 'kind' => $term->kind];
            }
            if ($row === null) {
                $context = $writer->context(DemoFixtureContext::request($actor, '/api/admin/articles/write-context'), null);
                $article = $writer->save(DemoFixtureContext::request($actor, '/api/admin/articles', 'POST', [
                    'expected_revision' => $context['revision'], 'slug' => DemoArticleShowcase::SLUG,
                    'translations' => DemoArticleShowcase::translations(), 'taxonomy' => $taxonomy, 'health_references' => [],
                    'source_links' => $this->sources(), 'intent' => 'publish', 'editorial_confirmed' => true,
                    'reason' => 'Create the full-length synthetic article showcase.',
                ]), null);
                $row = DB::table('articles')->where('public_id', $article['id'])->firstOrFail();
            }
            if (! config('demo.verified_media_seed_enabled')) {
                return;
            }
            // Fresh metadata runs before the separate verified-media stage creates these objects.
            if (DB::table('article_media_assets')->whereIn('display_name', [
                'Synthetic demo image 1.png', 'Synthetic demo image 2.png', 'Synthetic demo image 3.png',
            ])->count() !== 3) {
                return;
            }
            $context = $writer->context(DemoFixtureContext::request($actor, '/api/admin/articles/write-context'), $row->public_id);
            $working = $context['current']['working'];
            if (($working['presentation']['thumbnail'] ?? null) !== null) {
                return; // Includes later user edits: a repeat must never replace them.
            }
            $metadata = app(ArticleContent::class)->prepare(['translations' => DemoArticleShowcase::translations(),
                'health_references' => [], 'source_links' => $this->sources()]);
            if ((int) $row->author_user_id !== $actor->id || (int) $row->working_version !== 1 || (int) $row->published_version !== 1
                || $row->archived_at !== null || (array) $working['translations'] !== $metadata['translations']) {
                throw new LogicException('Showcase was edited; the seeder will not replace its content.');
            }
            $images = [];
            $library = app(ArticleMediaLibrary::class);
            foreach ([0, 1, 2] as $index) {
                $asset = DB::table('article_media_assets')->where('display_name', 'Synthetic demo image '.($index + 1).'.png')->sole();
                if ((int) $asset->actor_user_id !== $actor->id || $asset->checksum_sha256 !== hash('sha256', SyntheticDemoFiles::png($index))) {
                    throw new LogicException('Verified demo image identity differs; no object will be overwritten.');
                }
                $resource = $library->read(DemoFixtureContext::request($actor, '/api/admin/article-media'), $asset->public_id);
                if (! $resource['selectable']) {
                    throw new LogicException('Showcase needs current genuinely released demo images; prepare them through the real scanner/parser.');
                }
                $images[] = $resource;
            }
            $inline = [];
            foreach ($images as $image) {
                foreach (['en', 'fa'] as $language) {
                    $inline[] = ['id' => $image['asset']['id'], 'language' => $language];
                }
            }
            $writer->save(DemoFixtureContext::request($actor, '/api/admin/articles', 'POST', [
                'expected_revision' => $context['revision'], 'slug' => DemoArticleShowcase::SLUG,
                'translations' => DemoArticleShowcase::translations($images), 'taxonomy' => $taxonomy,
                'health_references' => [], 'source_links' => $this->sources(), 'intent' => 'publish', 'editorial_confirmed' => true,
                'presentation' => ['publication' => null, 'thumbnail' => ['id' => $images[0]['asset']['id'],
                    'alt' => ['en' => 'Illustrated Checkupino visit guide', 'fa' => 'راهنمای تصویری مراجعه در چکاپینو']], 'inline' => $inline],
                'reason' => 'Publish verified images and supported formatting in the synthetic showcase.',
            ]), $row->public_id);
        } finally {
            config(['article_content.enabled' => $enabled]);
        }
    }

    private function sources(): array
    {
        return [['url' => 'https://www.w3.org/WAI/', 'label' => 'W3C Web Accessibility Initiative']];
    }
}
