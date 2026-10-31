<?php

namespace App\Services\Content;

use App\Services\Health\HealthCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use UnexpectedValueException;

/** Bounded explicit resources. Identity/contact/health records are never serialized. */
final class ArticleSnapshots
{
    public function __construct(private readonly ArticleContent $content) {}

    public function actor(int $id): array
    {
        $user = DB::table('users')->where('id', $id)->first(['public_id', 'name']);
        $this->require($user !== null);

        return ['id' => $this->publicId($user->public_id), 'name' => $user->name];
    }

    public function publicId(mixed $id): string
    {
        $this->require(is_string($id) && preg_match('/\A[0-7][0-9a-hjkmnp-tv-z]{25}\z/i', $id) === 1);

        return strtolower($id);
    }

    public function term(object $term, object $version): array
    {
        $this->require((int) $version->term_id === (int) $term->id && (int) $version->schema_version === 1
            && (int) $version->version > 0 && in_array($term->kind, ['category', 'topic', 'tag'], true)
            && preg_match('/\A[a-z0-9][a-z0-9-]{1,158}[a-z0-9]\z/', $term->slug) === 1);
        $parent = null;
        if ($version->parent_id !== null) {
            $row = DB::table('article_terms')->where('id', $version->parent_id)->first();
            $this->require($term->kind === 'category' && $row !== null && $row->kind === 'category' && (int) $row->id !== (int) $term->id);
            $parent = $this->publicId($row->public_id);
        }
        if ((int) $term->current_version === (int) $version->version) {
            $this->require((bool) $term->is_active === (bool) $version->is_active && $term->parent_id === $version->parent_id);
        }

        return ['id' => $this->publicId($term->public_id), 'version_id' => $this->publicId($version->public_id),
            'kind' => $term->kind, 'slug' => $term->slug, 'version' => (int) $version->version,
            'labels' => $this->localized($version->labels, 200, true),
            'descriptions' => $this->localized($version->descriptions ?? '{}', 1000, false),
            'is_active' => (bool) $version->is_active, 'parent_id' => $parent];
    }

    public function version(object $row): array
    {
        $this->require(in_array((int) $row->schema_version, [1, 2, 3], true) && (int) $row->version > 0 && $row->health_catalog_version === HealthCatalog::VERSION);
        $raw = ['schema_version' => (int) $row->schema_version, 'translations' => $this->decode($row->translations),
            'health_catalog_version' => $row->health_catalog_version, 'health_references' => $this->decode($row->health_references),
            'source_links' => $this->decode($row->source_links)];
        if ((int) $row->schema_version === 3) {
            $this->require(is_string($row->presentation ?? null));
            $raw['presentation'] = $this->decode($row->presentation);
        } else {
            $this->require(($row->presentation ?? null) === null);
        }
        $this->require(array_is_list($raw['health_references']) && count($raw['health_references']) <= 30);
        $ids = [];
        foreach ($raw['health_references'] as $reference) {
            $this->require(is_array($reference) && is_string($reference['id'] ?? null));
            $ids[] = $reference['id'];
        }
        try {
            $input = ['translations' => $raw['translations'], 'health_references' => $ids, 'source_links' => $raw['source_links']];
            if ((int) $row->schema_version === 3) {
                $input['presentation'] = $raw['presentation'];
            }
            $prepared = $this->content->prepare($input, (int) $row->schema_version, true);
        } catch (ValidationException) {
            throw new UnexpectedValueException('Stored article content is unavailable.');
        }
        $snapshots = [];
        $current = [];
        $links = DB::table('article_version_terms')->where('article_version_id', $row->id)->orderBy('term_id')->limit(31)->get();
        $this->require($links->count() <= 30);
        foreach ($links as $link) {
            $term = DB::table('article_terms')->where('id', $link->term_id)->first();
            $version = DB::table('article_term_versions')->where('id', $link->term_version_id)->where('term_id', $link->term_id)->first();
            $this->require($term !== null && $version !== null);
            $snapshot = $this->term($term, $version);
            $snapshots[] = $snapshot;
            $current[$snapshot['id']] = (bool) $term->is_active;
        }
        usort($snapshots, fn ($a, $b) => strcmp($a['id'], $b['id']));
        $this->require(is_string($row->content_hash) && preg_match('/\A[a-f0-9]{64}\z/', $row->content_hash) === 1
            && hash_equals($row->content_hash, $this->content->hash($raw, $snapshots))
            && hash_equals($row->content_hash, $this->content->hash($prepared, $snapshots)));
        if ((int) $row->schema_version === 3) {
            app(ArticleMediaReferences::class)->assertStored($row, $prepared['presentation']);
        }

        return ['id' => $this->publicId($row->public_id), 'version' => (int) $row->version, 'schema_version' => (int) $row->schema_version,
            'translations' => (object) $prepared['translations'], 'health_catalog_version' => $prepared['health_catalog_version'],
            'health_references' => $prepared['health_references'], 'source_links' => $prepared['source_links'],
            'taxonomy' => array_map(fn ($term) => $this->termResource($term) + ['currently_active' => $current[$term['id']]], $snapshots),
            'content_hash' => $row->content_hash, 'publishable_languages' => $this->content->publishableLanguages($prepared),
            'actor' => $this->actor((int) $row->actor_user_id), 'recorded_at' => $row->recorded_at]
            + ((int) $row->schema_version === 3 ? ['presentation' => $prepared['presentation']] : []);
    }

    public function decode(string $value): array
    {
        $this->require(strlen($value) <= 500000);
        $data = json_decode($value, true, 24, JSON_THROW_ON_ERROR);
        $this->require(is_array($data));

        return $data;
    }

    public function termResource(array $snapshot): array
    {
        $snapshot['labels'] = (object) $snapshot['labels'];
        $snapshot['descriptions'] = (object) $snapshot['descriptions'];

        return $snapshot;
    }

    private function localized(string $json, int $limit, bool $required): array
    {
        $values = $this->decode($json);
        $this->require(array_diff(array_keys($values), ['en', 'fa']) === []);
        foreach ($values as $value) {
            $this->require(is_string($value) && mb_check_encoding($value, 'UTF-8') && mb_strlen($value) <= $limit
                && ! preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value));
        }
        $this->require(! $required || collect($values)->contains(fn ($v) => preg_match('/[^\s\p{Z}\p{Cf}]/u', $v) === 1));
        ksort($values);

        return $values;
    }

    public function require(bool $valid): void
    {
        if (! $valid) {
            throw new UnexpectedValueException('Stored article context is unavailable.');
        }
    }
}
