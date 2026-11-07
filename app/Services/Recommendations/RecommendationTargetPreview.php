<?php

namespace App\Services\Recommendations;

use App\Services\Content\ArticleMediaEligibility;
use App\Services\Content\ArticleMediaStorage;
use App\Services\Content\ArticleSnapshots;
use Illuminate\Support\Facades\DB;

/** Caller must authorize the exact assigned/owned rule version before invoking this helper. */
final class RecommendationTargetPreview
{
    public function __construct(private readonly ArticleSnapshots $articles, private readonly ArticleMediaEligibility $eligibility,
        private readonly ArticleMediaStorage $storage) {}

    public function previews(array $snapshot): array
    {
        return array_map(function ($target) {
            [$article, $version] = $this->bound($target);
            $images = [];
            foreach (['en', 'fa'] as $language) {
                foreach ($this->references($version, $language) as $reference) {
                    $images[] = ['id' => $reference['id'], 'language' => $language];
                }
            }

            $thumbnail = $version['presentation']['thumbnail'] ?? null;

            return ['id' => $article->public_id, 'version_id' => $version['id'], 'version' => $version['version'],
                'thumbnail' => $thumbnail === null ? null : ['id' => $thumbnail['asset']['id'], 'alt' => $thumbnail['alt']],
                'translations' => $version['translations'], 'languages' => $version['publishable_languages'], 'sources' => $version['source_links'], 'images' => $images];
        }, $snapshot['targets']);
    }

    public function media(array $snapshot, string $articleId, string $assetId, string $language): array
    {
        abort_unless(config('article_content.media_enabled') === true, 404);
        $target = collect($snapshot['targets'])->firstWhere('id', $articleId);
        abort_unless($target !== null, 404);
        [, $version] = $this->bound($target);
        abort_unless(in_array($language, $version['publishable_languages'], true), 404);
        $reference = collect($this->references($version, $language))->firstWhere('id', $assetId);
        abort_unless($reference !== null, 404);
        $asset = $this->asset($reference);

        return ['stream' => $this->storage->copy($asset), 'mime' => $asset->mime_type, 'bytes' => (int) $asset->size_bytes];
    }

    public function readable(array $snapshot): bool
    {
        foreach ($snapshot['targets'] as $target) {
            [, $version] = $this->bound($target);
            $seen = [];
            foreach ($version['publishable_languages'] as $language) {
                foreach ($this->references($version, $language) as $reference) {
                    if (isset($seen[$reference['id']])) {
                        continue;
                    }
                    $seen[$reference['id']] = true;
                    $asset = $this->asset($reference);
                    $stream = $this->storage->copy($asset);
                    fclose($stream);
                }
            }
        }

        return true;
    }

    private function bound(array $target): array
    {
        abort_unless(($target['kind'] ?? null) === 'article', 404);
        $article = DB::table('articles')->where('public_id', $target['id'])->sharedLock()->first();
        abort_unless($article !== null, 404);
        $row = DB::table('article_versions')->where('article_id', $article->id)->where('version', $target['version'])->sharedLock()->first();
        abort_unless($row !== null && $row->public_id === $target['version_id'] && hash_equals($row->content_hash, $target['content_hash']), 404);

        return [$article, $this->articles->version($row)];
    }

    private function references(array $version, string $language): array
    {
        $references = [];
        if (isset($version['presentation']['thumbnail']['asset'])) {
            $references[] = $version['presentation']['thumbnail']['asset'];
        }
        foreach ($version['presentation']['inline'] ?? [] as $item) {
            if ($item['language'] === $language) {
                $references[] = $item['asset'];
            }
        }

        return $references;
    }

    private function asset(array $reference): object
    {
        abort_unless(config('article_content.media_enabled') === true, 409);
        $asset = DB::table('article_media_assets')->where('public_id', $reference['id'])->sharedLock()->first();
        abort_unless($asset !== null && $this->eligibility->snapshot($asset) === $reference && $this->eligibility->blocker($asset) === null, 409);

        return $asset;
    }
}
