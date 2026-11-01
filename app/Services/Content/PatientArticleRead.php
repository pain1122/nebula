<?php

namespace App\Services\Content;

use App\Models\User;
use DOMDocument;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

/** Published-only patient reads; never authorizes staff inventory or patient-health access. */
final class PatientArticleRead
{
    public function __construct(private readonly ArticleSnapshots $snapshots, private readonly ArticleMediaEligibility $eligibility,
        private readonly ArticleMediaStorage $storage) {}

    public function read(Request $request, string $operation, ?string $id = null, ?string $assetId = null): array
    {
        abort_unless(config('article_content.enabled') === true, 503);
        foreach (['article_catalog_state', 'articles', 'article_versions', 'article_terms', 'article_term_versions', 'article_version_terms'] as $table) {
            abort_unless(Schema::hasTable($table), 503);
        }

        return DB::transaction(function () use ($request, $operation, $id, $assetId) {
            $catalog = DB::table('article_catalog_state')->where('id', 1)->sharedLock()->first();
            $this->snapshots->require($catalog !== null && DB::table('article_catalog_state')->count() === 1);
            $actor = User::query()->whereKey($request->user()->getAuthIdentifier())->lockForUpdate()->first();
            abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
            $actor->setRelation('roles', $actor->roles()->sharedLock()->get());
            abort_unless($actor->hasRole('patient'), 403);

            return match ($operation) {
                'articles' => $this->articles($request),
                'taxonomies' => $this->taxonomies($request),
                'article' => $this->detail($request, strtolower($id)),
                'media' => $this->media($request, strtolower($id), strtolower($assetId)),
            };
        });
    }

    private function parameters(Request $request, array $extra = [], bool $paging = false): array
    {
        $rules = ['language' => 'sometimes|in:en,fa'] + $extra + ($paging ? [
            'page' => 'sometimes|integer|min:1|max:10000', 'per_page' => 'sometimes|integer|min:1|max:24',
        ] : []);
        abort_if(array_diff(array_keys($request->query()), array_keys($rules)) !== [], 422);

        return Validator::make($request->query(), $rules)->validate();
    }

    private function published(): Builder
    {
        return DB::table('articles as a')->join('article_versions as v', fn ($join) => $join
            ->on('v.article_id', '=', 'a.id')->on('v.version', '=', 'a.published_version'))
            ->whereNull('a.archived_at')->select('a.*');
    }

    private function search(Builder $query, string $term, array $columns): void
    {
        $pattern = '%'.strtr(trim($term), ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
        $query->where(function (Builder $nested) use ($pattern, $columns) {
            foreach ($columns as $column) {
                $nested->orWhereRaw($nested->getGrammar()->wrap($column)." LIKE ? ESCAPE '!'", [$pattern]);
            }
        });
    }

    private function paginate(Builder $query, array $parameters, callable $present): array
    {
        $page = $query->paginate((int) ($parameters['per_page'] ?? 12), ['*'], 'page', (int) ($parameters['page'] ?? 1));

        return ['data' => $page->getCollection()->map($present)->all(), 'meta' => ['pagination' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(),
        ]]];
    }

    private function articles(Request $request): array
    {
        $parameters = $this->parameters($request, ['q' => 'sometimes|string|max:120|not_regex:/[\x00-\x1f\x7f]/',
            'category_id' => 'sometimes|string|ulid', 'tag_id' => 'sometimes|string|ulid'], true);
        $query = $this->published();
        if (isset($parameters['q'])) {
            $this->search($query, $parameters['q'], ['a.slug', 'v.translations->en->title', 'v.translations->fa->title',
                'v.translations->en->summary', 'v.translations->fa->summary']);
        }
        foreach (['category', 'tag'] as $kind) {
            if (isset($parameters[$kind.'_id'])) {
                $query->whereExists(fn (Builder $sub) => $sub->selectRaw('1')->from('article_version_terms as l')
                    ->join('article_terms as t', 't.id', '=', 'l.term_id')->whereColumn('l.article_version_id', 'v.id')
                    ->where('t.kind', $kind)->where('t.public_id', strtolower($parameters[$kind.'_id'])));
            }
        }
        $query->orderByDesc('v.recorded_at')->orderByDesc('a.id');

        return $this->paginate($query, $parameters, fn ($article) => $this->present($article, $parameters['language'] ?? 'en'));
    }

    private function taxonomies(Request $request): array
    {
        $parameters = $this->parameters($request, ['kind' => 'required|in:category,tag',
            'q' => 'sometimes|string|max:120|not_regex:/[\x00-\x1f\x7f]/'], true);
        $references = DB::table('article_version_terms as l')->join('article_versions as v', 'v.id', '=', 'l.article_version_id')
            ->join('articles as a', fn ($join) => $join->on('a.id', '=', 'v.article_id')->on('a.published_version', '=', 'v.version'))
            ->join('article_term_versions as pinned', 'pinned.id', '=', 'l.term_version_id')->whereNull('a.archived_at')
            ->select('l.term_id')->selectRaw('MAX(pinned.version) as pinned_version')->groupBy('l.term_id');
        $query = DB::query()->fromSub($references, 'refs')->join('article_terms as t', 't.id', '=', 'refs.term_id')
            ->join('article_term_versions as tv', fn ($join) => $join->on('tv.term_id', '=', 't.id')->on('tv.version', '=', 'refs.pinned_version'))
            ->where('t.kind', $parameters['kind'])->select('t.*', 'tv.id as pinned_id')->orderBy('t.public_id');
        if (isset($parameters['q'])) {
            $this->search($query, $parameters['q'], ['tv.labels->en', 'tv.labels->fa']);
        }

        return $this->paginate($query, $parameters, function ($term) use ($parameters) {
            $pinned = DB::table('article_term_versions')->where('id', $term->pinned_id)->first();
            $snapshot = $this->snapshots->term($term, $pinned);

            return $this->term($snapshot, $parameters['language'] ?? 'en');
        });
    }

    private function article(string $id): object
    {
        $article = $this->published()->where('a.public_id', $id)->first();
        abort_unless($article !== null, 404);

        return $article;
    }

    private function version(object $article): array
    {
        $row = DB::table('article_versions')->where('article_id', $article->id)->where('version', $article->published_version)->first();
        $this->snapshots->require($row !== null);
        $version = $this->snapshots->version($row);
        $this->snapshots->require($version['publishable_languages'] !== []);

        return $version;
    }

    private function language(array $version, string $requested): string
    {
        return in_array($requested, $version['publishable_languages'], true) ? $requested : $version['publishable_languages'][0];
    }

    private function term(array $term, string $language): array
    {
        $labels = (array) $term['labels'];

        return ['id' => $term['id'], 'label' => $labels[$language] ?? $labels[$language === 'en' ? 'fa' : 'en'] ?? ''];
    }

    private function image(object $article, array $version, array $reference, string $language, string $alt = ''): ?array
    {
        if (config('article_content.media_enabled') !== true) {
            return null;
        }
        $asset = DB::table('article_media_assets')->where('public_id', $reference['id'])->first();
        if ($asset === null || $this->eligibility->snapshot($asset) !== $reference || $this->eligibility->blocker($asset) !== null) {
            return null;
        }

        return ['content_path' => '/api/my/articles/'.$article->public_id.'/media/'.$reference['id'].'?'.http_build_query([
            'version_id' => $version['id'], 'language' => $language,
        ]), 'alt' => $alt, 'width' => $reference['width'], 'height' => $reference['height']];
    }

    private function present(object $article, string $requested, bool $detail = false): array
    {
        $version = $this->version($article);
        $language = $this->language($version, $requested);
        $translation = ((array) $version['translations'])[$language];
        $thumbnail = $version['presentation']['thumbnail'] ?? null;
        $result = ['id' => $article->public_id, 'version_id' => $version['id'], 'title' => $translation['title'],
            'summary' => $translation['summary'], 'content_language' => $language, 'fallback_used' => $language !== $requested,
            'categories' => [], 'tags' => [], 'thumbnail' => $thumbnail === null ? null
                : $this->image($article, $version, $thumbnail['asset'], $language, $thumbnail['alt'][$language] ?? '')];
        foreach ($version['taxonomy'] as $term) {
            if (in_array($term['kind'], ['category', 'tag'], true)) {
                $result[$term['kind'] === 'category' ? 'categories' : 'tags'][] = $this->term($term, $requested);
            }
        }
        if ($detail) {
            $images = [];
            foreach ($version['presentation']['inline'] ?? [] as $reference) {
                if ($reference['language'] === $language) {
                    $images[$reference['asset']['id']] = $this->image($article, $version, $reference['asset'], $language);
                }
            }
            $author = DB::table('users')->where('id', $article->author_user_id)->value('name');
            $this->snapshots->require(is_string($author));
            $result += ['author' => ['display_name' => $author], 'source_links' => $version['source_links'],
                'body_html' => $this->body($translation['body_html'], $images)];
        }

        return $result;
    }

    private function detail(Request $request, string $id): array
    {
        $parameters = $this->parameters($request);

        return ['data' => $this->present($this->article($id), $parameters['language'] ?? 'en', true)];
    }

    private function body(string $html, array $images): string
    {
        $document = new DOMDocument('1.0', 'UTF-8');
        $document->loadHTML('<?xml encoding="UTF-8"><div>'.$html.'</div>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        $root = $document->getElementsByTagName('div')->item(0);
        foreach (iterator_to_array($root->getElementsByTagName('img')) as $image) {
            $source = $image->getAttribute('src');
            $reference = preg_match('~\A/api/admin/article-media/([0-7][0-9a-hjkmnp-tv-z]{25})/content\z~', $source, $match)
                ? ($images[$match[1]] ?? null) : null;
            if ($reference === null) {
                $image->parentNode->removeChild($image);
            } else {
                $image->setAttribute('src', $reference['content_path']);
                $image->setAttribute('class', 'img-fluid');
                $image->setAttribute('loading', 'lazy');
            }
        }
        foreach (iterator_to_array($root->getElementsByTagName('figure')) as $figure) {
            if ($figure->getElementsByTagName('img')->length === 0 && trim($figure->textContent) === '') {
                $figure->parentNode->removeChild($figure);
            }
        }
        $output = '';
        foreach ($root->childNodes as $child) {
            $output .= $document->saveHTML($child);
        }

        return $output;
    }

    private function media(Request $request, string $id, string $assetId): array
    {
        $parameters = $this->parameters($request, ['version_id' => 'required|string|ulid']);
        $article = $this->article($id);
        $version = $this->version($article);
        abort_unless($version['id'] === strtolower($parameters['version_id']) && config('article_content.media_enabled') === true, 404);
        $language = $this->language($version, $parameters['language'] ?? 'en');
        $references = [];
        if (isset($version['presentation']['thumbnail']['asset'])) {
            $references[] = $version['presentation']['thumbnail']['asset'];
        }
        foreach ($version['presentation']['inline'] ?? [] as $reference) {
            if ($reference['language'] === $language) {
                $references[] = $reference['asset'];
            }
        }
        $reference = collect($references)->first(fn ($reference) => $reference['id'] === $assetId);
        abort_unless($reference !== null, 404);
        $asset = DB::table('article_media_assets')->where('public_id', $assetId)->sharedLock()->first();
        abort_unless($asset !== null && $this->eligibility->snapshot($asset) === $reference && $this->eligibility->blocker($asset) === null, 404);

        return ['stream' => $this->storage->copy($asset), 'mime' => $asset->mime_type, 'bytes' => (int) $asset->size_bytes];
    }
}
