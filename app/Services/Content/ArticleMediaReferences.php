<?php

namespace App\Services\Content;

use Illuminate\Support\Facades\DB;
use UnexpectedValueException;

final class ArticleMediaReferences
{
    public function __construct(private readonly ArticleMediaEligibility $eligibility, private readonly ArticleMediaStorage $storage,
        private readonly ArticlePresentation $presentation) {}

    /** Only IDs and bilingual alt text cross the write boundary. All immutable metadata is server-resolved. */
    public function resolve(array $input): array
    {
        if (($input['thumbnail'] ?? null) !== null) {
            abort_unless(is_array($input['thumbnail']) && ! array_diff(array_keys($input['thumbnail']), ['id', 'alt']), 422);
        }
        abort_unless(config('article_content.media_enabled') === true, 503);
        app(ArticleScheduleState::class)->requireSchema();
        abort_if(array_diff(array_keys($input), ['publication', 'thumbnail', 'inline']), 422);
        $result = ['publication' => (new ArticlePublicationTime)->normalize($input['publication'] ?? null), 'thumbnail' => null, 'inline' => []];
        $policy = $this->eligibility->policy(true);
        if (($input['thumbnail'] ?? null) !== null) {
            $thumbnail = $input['thumbnail'];
            abort_unless(is_array($thumbnail) && ! array_diff(array_keys($thumbnail), ['id', 'alt']), 422);
            $row = $this->resolveAsset($thumbnail['id'] ?? null, $policy);
            $result['thumbnail'] = ['asset' => $this->eligibility->snapshot($row), 'alt' => $this->presentation->alt($thumbnail['alt'] ?? [])];
        }
        $inline = $input['inline'] ?? [];
        abort_unless(is_array($inline) && array_is_list($inline) && count($inline) <= 30, 422);
        foreach ($inline as $reference) {
            abort_unless(is_array($reference) && ! array_diff(array_keys($reference), ['id', 'language']) && in_array($reference['language'] ?? null, ['en', 'fa'], true), 422);
            $row = $this->resolveAsset($reference['id'] ?? null, $policy);
            $result['inline'][] = ['asset' => $this->eligibility->snapshot($row), 'language' => $reference['language']];
        }

        return $this->presentation->prepare($result, true);
    }

    private function resolveAsset(mixed $id, array $policy): object
    {
        abort_unless(is_string($id) && preg_match('/\A[0-7][0-9a-hjkmnp-tv-z]{25}\z/i', $id), 422);
        $row = DB::table('article_media_assets')->where('public_id', strtolower($id))->lockForUpdate()->first();
        abort_unless($row !== null && $this->eligibility->blocker($row, $policy) === null, 422);
        $this->verifyBytes($row);

        return $row;
    }

    private function verifyBytes(object $row): void
    {
        $stream = $this->storage->copy($row);
        try {
            $dimensions = $this->storage->dimensions($stream, $row->mime_type);
            if ($dimensions !== [(int) $row->width, (int) $row->height]) {
                throw new UnexpectedValueException('Editorial image metadata mismatch.');
            }
        } finally {
            fclose($stream);
        }
    }

    public function links(array $presentation): array
    {
        $links = [];
        if ($presentation['thumbnail'] !== null) {
            foreach (['en', 'fa'] as $language) {
                $links[] = ['asset' => $presentation['thumbnail']['asset'], 'usage' => 'thumbnail', 'language' => $language];
            }
        }
        foreach ($presentation['inline'] as $reference) {
            $links[] = ['asset' => $reference['asset'], 'usage' => 'inline', 'language' => $reference['language']];
        }
        usort($links, fn ($a, $b) => strcmp($a['asset']['id'].$a['usage'].$a['language'], $b['asset']['id'].$b['usage'].$b['language']));

        return $links;
    }

    public function store(int $articleId, int $version, array $presentation): void
    {
        foreach ($this->links($presentation) as $link) {
            $row = DB::table('article_media_assets')->where('public_id', $link['asset']['id'])->first();
            if ($row === null || $this->eligibility->snapshot($row) !== $link['asset']) {
                throw new UnexpectedValueException('Editorial image reference mismatch.');
            }
            DB::table('article_version_media')->insert(['article_id' => $articleId, 'version' => $version, 'asset_id' => $row->id,
                'checksum_sha256' => $link['asset']['checksum_sha256'], 'usage' => $link['usage'], 'language' => $link['language']]);
        }
    }

    public function assertStored(object $version, array $presentation): void
    {
        $expected = $this->links($presentation);
        $actual = [];
        foreach (DB::table('article_version_media')->where('article_id', $version->article_id)->where('version', $version->version)->limit(33)->get() as $link) {
            $row = DB::table('article_media_assets')->find($link->asset_id);
            if ($row === null || $row->purpose !== 'article_editorial' || $row->disk !== 'article-media' || $link->checksum_sha256 !== $row->checksum_sha256) {
                throw new UnexpectedValueException('Stored editorial reference is unavailable.');
            }
            $actual[] = ['asset' => $this->eligibility->snapshot($row), 'usage' => $link->usage, 'language' => $link->language];
        }
        usort($actual, fn ($a, $b) => strcmp($a['asset']['id'].$a['usage'].$a['language'], $b['asset']['id'].$b['usage'].$b['language']));
        if ($actual !== $expected) {
            throw new UnexpectedValueException('Stored editorial references do not match their exact version.');
        }
    }

    public function blockers(array $working): array
    {
        $links = isset($working['presentation']) ? $this->links($working['presentation']) : [];
        if ($links === []) {
            return [];
        }
        if (config('article_content.media_enabled') !== true) {
            return ['media_unavailable'];
        }
        try {
            $policy = $this->eligibility->policy(true);
            foreach ($links as $link) {
                $row = DB::table('article_media_assets')->where('public_id', $link['asset']['id'])->lockForUpdate()->first();
                if ($row === null || $this->eligibility->snapshot($row) !== $link['asset'] || $this->eligibility->blocker($row, $policy) !== null) {
                    return ['media_not_released'];
                }
                $this->verifyBytes($row);
            }

            return [];
        } catch (\Throwable) {
            return ['media_integrity_unavailable'];
        }
    }
}
