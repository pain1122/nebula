<?php

namespace App\Services\Recommendations;

use App\Services\Content\ArticleSnapshots;
use App\Services\Health\HealthCatalog;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use SensitiveParameter;
use UnexpectedValueException;

final class RecommendationContent
{
    public function __construct(private readonly ArticleSnapshots $articles) {}

    public function input(#[SensitiveParameter] array $input): array
    {
        $fields = ['definition', 'translations', 'population', 'limitations', 'sources', 'targets', 'priority'];
        if (array_diff($fields, array_keys($input)) || array_diff(array_keys($input), $fields) || ! is_array($input['definition'] ?? null)) {
            throw new InvalidArgumentException('Invalid recommendation content.');
        }
        $input['definition'] = RuleCondition::fromArray($input['definition'])->definition();
        $input['translations'] = $this->translations($input['translations']);
        foreach (['population', 'limitations'] as $field) {
            $input[$field] = $this->localized($input[$field], 2000);
        }
        if (! is_int($input['priority']) || $input['priority'] < 0 || $input['priority'] > 1000
            || ! is_array($input['sources']) || ! array_is_list($input['sources']) || count($input['sources']) > 20
            || ! is_array($input['targets']) || ! array_is_list($input['targets']) || count($input['targets']) < 1 || count($input['targets']) > 20) {
            throw new InvalidArgumentException('Invalid recommendation content.');
        }
        $sources = [];
        foreach ($input['sources'] as $source) {
            if (! is_array($source) || array_diff(array_keys($source), ['label', 'url'])) {
                throw new InvalidArgumentException('Invalid recommendation source.');
            }
            $url = $this->text($source['url'] ?? null, 2048);
            $parts = parse_url($url);
            if (! filter_var($url, FILTER_VALIDATE_URL) || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host'])
                || isset($parts['user']) || isset($parts['pass'])) {
                throw new InvalidArgumentException('Invalid recommendation source.');
            }
            $sources[] = ['label' => $this->text($source['label'] ?? null, 200), 'url' => $url];
        }
        $targets = [];
        foreach ($input['targets'] as $publicId) {
            if (! is_string($publicId) || ! preg_match('/\A[0-7][0-9a-hjkmnp-tv-z]{25}\z/', $publicId) || isset($targets[$publicId])) {
                throw new InvalidArgumentException('Invalid recommendation target.');
            }
            $article = DB::table('articles')->where('public_id', $publicId)->whereNull('archived_at')->sharedLock()->first();
            abort_unless($article !== null && $article->published_version !== null, 409);
            $row = DB::table('article_versions')->where('article_id', $article->id)->where('version', $article->published_version)->sharedLock()->first();
            abort_unless($row !== null, 409);
            $version = $this->articles->version($row);
            abort_unless($version['publishable_languages'] !== [], 409);
            $targets[$publicId] = ['kind' => 'article', 'id' => $publicId, 'version_id' => $row->public_id,
                'version' => (int) $row->version, 'content_hash' => $row->content_hash];
        }
        ksort($targets, SORT_STRING);

        return ['definition' => $input['definition'], 'translations' => $input['translations'],
            'population' => $input['population'], 'limitations' => $input['limitations'], 'sources' => $sources,
            'targets' => array_values($targets), 'priority' => $input['priority']];
    }

    public function hash(array $value, int $author): string
    {
        return hash('sha256', $this->canonical(['schema_version' => 1, 'health_catalog_version' => HealthCatalog::VERSION,
            'evaluator_version' => RuleCondition::EVALUATOR_VERSION, 'actor_user_id' => $author, ...$value]));
    }

    public function snapshot(object $row): array
    {
        $keys = ['definition', 'translations', 'population', 'limitations', 'sources', 'targets', 'priority'];
        $value = [];
        if ((int) $row->schema_version !== 1 || $row->health_catalog_version !== HealthCatalog::VERSION
            || $row->evaluator_version !== RuleCondition::EVALUATOR_VERSION) {
            throw new UnexpectedValueException('Recommendation version unavailable.');
        }
        foreach ($keys as $key) {
            $value[$key] = $key === 'priority' ? (int) $row->$key : json_decode($row->$key, true, 16, JSON_THROW_ON_ERROR);
        }
        if (! hash_equals($row->content_hash, $this->hash($value, (int) $row->actor_user_id))
            || $this->canonical(RuleCondition::fromArray($value['definition'])->definition()) !== $this->canonical($value['definition'])) {
            throw new UnexpectedValueException('Recommendation version unavailable.');
        }

        return ['id' => $row->public_id, 'version' => (int) $row->version, 'content_hash' => $row->content_hash,
            'author_id' => (int) $row->actor_user_id, 'recorded_at' => $row->recorded_at, ...$value];
    }

    public function targetsCurrent(object $row, array $snapshot): bool
    {
        $bindings = DB::table('recommendation_rule_version_targets')->where('rule_id', $row->rule_id)->where('rule_version', $row->version)
            ->orderBy('article_id')->sharedLock()->get();
        if ($bindings->count() !== count($snapshot['targets']) || $snapshot['targets'] === []) {
            return false;
        }
        foreach ($snapshot['targets'] as $target) {
            if (($target['kind'] ?? null) !== 'article') {
                return false;
            }
            $article = DB::table('articles')->where('public_id', $target['id'])->sharedLock()->first();
            if ($article === null || $article->archived_at !== null || (int) $article->published_version !== $target['version']) {
                return false;
            }
            $version = DB::table('article_versions')->where('article_id', $article->id)->where('version', $target['version'])->sharedLock()->first();
            $binding = $bindings->first(fn ($binding) => (int) $binding->article_id === (int) $article->id);
            if ($version === null || $version->public_id !== $target['version_id'] || ! hash_equals($version->content_hash, $target['content_hash'])
                || $binding === null || (int) $binding->article_version !== $target['version'] || ! hash_equals($binding->content_hash, $target['content_hash'])
                || $this->articles->version($version)['publishable_languages'] === []) {
                return false;
            }
        }

        return true;
    }

    public function languages(array $value): array
    {
        return array_values(array_filter(['en', 'fa'], fn ($language) => $value['translations'][$language]['title'] !== ''
            && $value['translations'][$language]['explanation'] !== '' && $value['population'][$language] !== '' && $value['limitations'][$language] !== ''));
    }

    private function translations(mixed $input): array
    {
        if (! is_array($input) || array_diff(array_keys($input), ['en', 'fa']) || count($input) !== 2) {
            throw new InvalidArgumentException('Invalid recommendation translations.');
        }
        $value = [];
        foreach (['en', 'fa'] as $language) {
            $row = $input[$language];
            if (! is_array($row) || array_diff(array_keys($row), ['title', 'explanation']) || count($row) !== 2) {
                throw new InvalidArgumentException('Invalid recommendation translations.');
            }
            $value[$language] = ['title' => $this->text($row['title'], 200), 'explanation' => $this->text($row['explanation'], 1000)];
        }

        return $value;
    }

    private function localized(mixed $input, int $limit): array
    {
        if (! is_array($input) || array_diff(array_keys($input), ['en', 'fa']) || count($input) !== 2) {
            throw new InvalidArgumentException('Invalid recommendation text.');
        }

        return ['en' => $this->text($input['en'], $limit), 'fa' => $this->text($input['fa'], $limit)];
    }

    private function text(mixed $value, int $limit): string
    {
        if (! is_string($value) || ! mb_check_encoding($value, 'UTF-8') || mb_strlen($value) > $limit || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value)) {
            throw new InvalidArgumentException('Invalid recommendation text.');
        }

        return trim($value);
    }

    public function canonical(mixed $value): string
    {
        $sort = function ($item) use (&$sort) {
            if (! is_array($item)) {
                return $item;
            }
            if (! array_is_list($item)) {
                ksort($item, SORT_STRING);
            }

            return array_map($sort, $item);
        };

        return json_encode($sort($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
