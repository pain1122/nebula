<?php

namespace App\Services\Content;

use App\Services\Health\HealthCatalog;
use App\Services\QuestionnaireRichTextSanitizer;
use Illuminate\Validation\ValidationException;

/** Pure content preparation. No patient reads, persistence, URL fetches or publication authority. */
final class ArticleContent
{
    public function __construct(private readonly QuestionnaireRichTextSanitizer $sanitizer,
        private readonly ArticlePresentation $presentation = new ArticlePresentation) {}

    public function prepare(array $input, ?int $schemaVersion = null, bool $stored = false): array
    {
        $this->keys($input, ['translations', 'health_references', 'source_links', 'presentation']);
        $translations = array_key_exists('translations', $input) ? $input['translations'] : [];
        if (! is_array($translations)) {
            $this->fail();
        }
        $this->keys($translations, ['en', 'fa']);
        $schemaVersion ??= array_key_exists('presentation', $input) ? 3
            : (collect($translations)->contains(fn ($value) => is_array($value) && array_key_exists('seo', $value)) ? 2 : 1);
        if (! in_array($schemaVersion, [1, 2, 3], true) || (($schemaVersion === 3) !== array_key_exists('presentation', $input))) {
            $this->fail();
        }
        $presentation = null;
        if ($schemaVersion === 3) {
            try {
                $presentation = $this->presentation->prepare($input['presentation'], $stored);
            } catch (\InvalidArgumentException) {
                $this->fail();
            }
        }
        $clean = [];
        foreach (['en', 'fa'] as $language) {
            if (! array_key_exists($language, $translations)) {
                continue;
            }
            $translation = $translations[$language];
            if (! is_array($translation)) {
                $this->fail();
            }
            $this->keys($translation, $schemaVersion >= 2 ? ['title', 'summary', 'body_html', 'seo'] : ['title', 'summary', 'body_html']);
            $title = $this->text(array_key_exists('title', $translation) ? $translation['title'] : '', 200);
            $summary = $this->text(array_key_exists('summary', $translation) ? $translation['summary'] : '', 1000);
            $body = $this->text(array_key_exists('body_html', $translation) ? $translation['body_html'] : '', 20000, true);
            try {
                $ids = $presentation === null ? [] : array_column(array_column(array_values(array_filter($presentation['inline'], fn ($reference) => $reference['language'] === $language)), 'asset'), 'id');
                $body = $schemaVersion === 3 ? (new ArticleRichText)->sanitize($body, $ids) : ($this->sanitizer->sanitize($body) ?? '');
            } catch (\InvalidArgumentException) {
                $this->fail();
            }
            // Entity escaping can expand HTML; the stored output has the same explicit bound.
            $this->text($body, 20000, true);
            $clean[$language] = ['title' => $title, 'summary' => $summary, 'body_html' => $body];
            if ($schemaVersion >= 2) {
                $clean[$language]['seo'] = $this->seo(array_key_exists('seo', $translation) ? $translation['seo'] : []);
            }
        }

        $references = array_key_exists('health_references', $input) ? $input['health_references'] : [];
        if (! is_array($references) || ! array_is_list($references) || count($references) > 30) {
            $this->fail();
        }
        $catalog = array_column(HealthCatalog::terms(), null, 'id');
        $resolved = [];
        foreach ($references as $id) {
            if (! is_string($id) || ! isset($catalog[$id]) || ! $catalog[$id]['active'] || isset($resolved[$id])) {
                $this->fail();
            }
            $term = $catalog[$id];
            $resolved[$id] = ['id' => $id, 'kind' => $term['kind'], 'labels' => $term['labels']];
        }
        ksort($resolved);

        $sources = array_key_exists('source_links', $input) ? $input['source_links'] : [];
        if (! is_array($sources) || ! array_is_list($sources) || count($sources) > 20) {
            $this->fail();
        }
        $links = [];
        $seen = [];
        foreach ($sources as $source) {
            if (! is_array($source)) {
                $this->fail();
            }
            $this->keys($source, ['url', 'label']);
            $url = $this->text($source['url'] ?? '', 2048);
            $label = $this->text($source['label'] ?? '', 200);
            $parts = parse_url($url);
            if ($label === '' || ! filter_var($url, FILTER_VALIDATE_URL) || ! is_array($parts)
                || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host'])
                || isset($parts['user']) || isset($parts['pass']) || preg_match('/[\x00-\x20\x7f\\\\]/', $url) || isset($seen[$url])) {
                $this->fail();
            }
            $seen[$url] = true;
            $links[] = ['url' => $url, 'label' => $label];
        }

        $prepared = ['schema_version' => $schemaVersion, 'translations' => $clean, 'health_catalog_version' => HealthCatalog::VERSION,
            'health_references' => array_values($resolved), 'source_links' => $links];
        if ($schemaVersion === 3) {
            $prepared['presentation'] = $presentation;
        }

        return $prepared;
    }

    public function publishableLanguages(array $prepared): array
    {
        $languages = [];
        foreach ($prepared['translations'] as $language => $translation) {
            $text = html_entity_decode(strip_tags($translation['body_html']), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($this->meaningful($translation['title']) && (($prepared['schema_version'] ?? 1) >= 2 || $this->meaningful($translation['summary'])) && $this->meaningful($text)) {
                $languages[] = $language;
            }
        }

        return $languages;
    }

    private function meaningful(string $value): bool
    {
        return preg_match('/[^\s\p{Z}\p{Cf}]/u', $value) === 1;
    }

    private function seo(mixed $input): array
    {
        if (! is_array($input)) {
            $this->fail();
        }
        $limits = ['title' => 200, 'description' => 1000, 'keywords' => 1000, 'schema_json' => 20000, 'canonical_url' => 2048];
        $this->keys($input, array_keys($limits));
        $clean = [];
        foreach ($limits as $key => $limit) {
            $clean[$key] = $this->text(array_key_exists($key, $input) ? $input[$key] : '', $limit);
        }
        if ($clean['canonical_url'] !== '') {
            $parts = parse_url($clean['canonical_url']);
            if (! filter_var($clean['canonical_url'], FILTER_VALIDATE_URL) || ! is_array($parts)
                || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host']) || isset($parts['fragment'])
                || isset($parts['user']) || isset($parts['pass']) || preg_match('/[\x00-\x20\x7f\\\\]/', $clean['canonical_url'])) {
                $this->fail();
            }
        }
        if ($clean['schema_json'] !== '') {
            try {
                $data = json_decode($clean['schema_json'], false, 16, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                $this->fail();
            }
            $roots = is_array($data) ? $data : [$data];
            if ($roots === [] || preg_match('/[<>]/', $clean['schema_json'])) {
                $this->fail();
            }
            foreach ($roots as $root) {
                if (! $root instanceof \stdClass || ! in_array($root->{'@context'} ?? null, ['https://schema.org', 'https://schema.org/'], true)
                    || (! isset($root->{'@type'}) && ! isset($root->{'@graph'}))) {
                    $this->fail();
                }
            }
            $nodes = 0;
            $this->jsonData($data, $nodes);
        }

        return $clean;
    }

    private function jsonData(mixed $value, int &$nodes): void
    {
        if (++$nodes > 1000) {
            $this->fail();
        }
        if (is_object($value) || is_array($value)) {
            foreach ($value as $key => $item) {
                if (in_array((string) $key, ['__proto__', 'constructor', 'prototype'], true)
                    || ($key === '@context' && ! in_array($item, ['https://schema.org', 'https://schema.org/'], true))) {
                    $this->fail();
                }
                $this->jsonData($item, $nodes);
            }
        }
    }

    /** Hash exact sanitized content plus server-resolved article taxonomy snapshots. */
    public function hash(array $prepared, array $taxonomySnapshots = []): string
    {
        return hash('sha256', json_encode($this->canonical(['content' => $prepared, 'taxonomy' => $taxonomySnapshots]),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    private function canonical(array $value): array
    {
        if (! array_is_list($value)) {
            ksort($value);
        }
        foreach ($value as &$item) {
            if (is_array($item)) {
                $item = $this->canonical($item);
            }
        }

        return $value;
    }

    private function keys(array $value, array $allowed): void
    {
        if (array_diff(array_keys($value), $allowed) !== []) {
            $this->fail();
        }
    }

    private function text(mixed $value, int $limit, bool $html = false): string
    {
        if (! is_string($value) || ! mb_check_encoding($value, 'UTF-8') || strlen($value) > 80000
            || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value)
            || ($html ? strlen(mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2 : mb_strlen($value, 'UTF-8')) > $limit) {
            $this->fail();
        }

        return trim($value);
    }

    private function fail(): never
    {
        throw ValidationException::withMessages(['article' => ['Invalid article content.']]);
    }
}
