<?php

namespace App\Services\Content;

use App\Models\Article;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

final class ArticleAdministrationRead
{
    private array $versions = [];

    public function __construct(private readonly ArticleSnapshots $snapshots, private readonly ArticleContent $content) {}

    public function read(Request $request, string $operation, ?string $id = null, ?string $versionId = null): array
    {
        $this->versions = [];
        $id = $id === null ? null : strtolower($id);
        $versionId = $versionId === null ? null : strtolower($versionId);

        return DB::transaction(function () use ($request, $operation, $id, $versionId) {
            // Future writers take this same anchor exclusively before entity/authority rows.
            $state = DB::table('article_catalog_state')->where('id', 1)->sharedLock()->first();
            $this->snapshots->require($state !== null && (int) $state->revision >= 0 && DB::table('article_catalog_state')->count() === 1);
            $actor = User::query()->select(['id', 'public_id', 'account_state', 'updated_at'])
                ->whereKey($request->user()->getAuthIdentifier())->lockForUpdate()->first();
            abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
            $actor->setRelation('roles', $actor->roles()->sharedLock()->get());
            abort_unless($actor->canAccessAdminPanel(), 403);
            $result = match ($operation) {
                'articles' => $this->articles($request),
                'article' => $this->articleDetail($request, $id),
                'article_versions' => $this->articleVersions($request, $id),
                'article_version' => $this->articleVersion($request, $id, $versionId),
                'article_events' => $this->articleEvents($request, $id),
                'terms' => $this->terms($request),
                'term' => $this->termDetail($request, $id),
                'term_versions' => $this->termVersions($request, $id),
            };
            $key = config('app.key');
            $this->snapshots->require(is_string($key) && $key !== '');
            $signature = $this->content->hash(['resource' => $operation, 'id' => $id, 'version_id' => $versionId,
                'catalog' => (int) $state->revision, 'result' => $result, 'actor' => [$actor->public_id,
                    $actor->getRawOriginal('updated_at'), $actor->roles->pluck('name')->sort()->values()->all()]]);
            $result['meta'] = ($result['meta'] ?? []) + ['read_only' => true, 'catalog_revision' => (int) $state->revision,
                'revision' => hash_hmac('sha256', $signature, $key)];

            return $result;
        });
    }

    private function query(Request $request, array $extra = [], bool $paging = false): array
    {
        $rules = $extra + ($paging ? ['page' => 'sometimes|integer|min:1|max:10000', 'per_page' => 'sometimes|integer|min:1|max:50'] : []);
        abort_if(array_diff(array_keys($request->query()), array_keys($rules)) !== [], 422);

        return Validator::make($request->query(), $rules)->validate();
    }

    private function search(Builder $query, string $term, array $columns): void
    {
        $pattern = '%'.strtr(trim($term), ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
        $query->where(function (Builder $nested) use ($pattern, $columns) {
            foreach ($columns as $column) {
                $wrapped = $nested->getGrammar()->wrap($column);
                $nested->orWhereRaw($wrapped." LIKE ? ESCAPE '!'", [$pattern]);
            }
        });
    }

    private function page(Builder $query, array $filters, callable $present): array
    {
        $page = $query->paginate((int) ($filters['per_page'] ?? 20), ['*'], 'page', (int) ($filters['page'] ?? 1));

        return ['data' => $page->getCollection()->map($present)->all(), 'meta' => ['pagination' => ['current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()]]];
    }

    private function articles(Request $request): array
    {
        $filters = $this->query($request, ['q' => 'sometimes|string|max:120|not_regex:/[\x00-\x1f\x7f]/',
            'status' => 'sometimes|in:all,draft,in_review,reviewed,published,published_with_draft,archived',
            'author_id' => 'sometimes|ulid', 'category_id' => 'sometimes|ulid', 'topic_id' => 'sometimes|ulid', 'tag_id' => 'sometimes|ulid',
            'sort' => 'sometimes|in:id,slug,created_at,updated_at,title', 'direction' => 'sometimes|in:asc,desc', 'language' => 'sometimes|in:en,fa'], true);
        $query = DB::table('articles as a')->leftJoin('article_versions as v', fn ($join) => $join->on('v.article_id', '=', 'a.id')->on('v.version', '=', 'a.working_version'))->select('a.*');
        if (isset($filters['q'])) {
            $this->search($query, $filters['q'], ['a.slug', 'v.translations->en->title', 'v.translations->fa->title']);
        }
        $status = $filters['status'] ?? 'all';
        if ($status === 'archived') {
            $query->whereNotNull('a.archived_at');
        } elseif ($status !== 'all') {
            $query->whereNull('a.archived_at');
            if (in_array($status, ['published', 'published_with_draft'], true)) {
                $query->whereNotNull('a.published_version');
                if ($status === 'published_with_draft') {
                    $query->whereColumn('a.working_version', '<>', 'a.published_version');
                }
            } else {
                $query->where('a.working_state', $status);
                if ($status === 'draft') {
                    $query->whereNull('a.published_version');
                }
            }
        }
        if (isset($filters['author_id'])) {
            $author = DB::table('users')->where('public_id', strtolower($filters['author_id']))->value('id');
            $query->where('a.author_user_id', $author ?? -1);
        }
        foreach (['category', 'topic', 'tag'] as $kind) {
            if (! isset($filters[$kind.'_id'])) {
                continue;
            }
            $term = DB::table('article_terms')->where('public_id', strtolower($filters[$kind.'_id']))->where('kind', $kind)->first();
            abort_unless($term !== null, 422);
            $query->whereExists(fn (Builder $sub) => $sub->selectRaw('1')->from('article_version_terms as links')
                ->whereColumn('links.article_version_id', 'v.id')->where('links.term_id', $term->id));
        }
        $sort = $filters['sort'] ?? 'id';
        $column = $sort === 'title' ? 'v.translations->'.($filters['language'] ?? 'en').'->title' : 'a.'.$sort;
        $query->orderBy($column, $filters['direction'] ?? 'desc')->orderByDesc('a.id');

        $result = $this->page($query, $filters, fn ($row) => $this->article($row, false));
        $result['meta']['taxonomy_filter_basis'] = 'working_version';

        return $result;
    }

    private function articleRow(string $id): object
    {
        $row = DB::table('articles')->where('public_id', strtolower($id))->first();
        abort_unless($row !== null, 404);

        return $row;
    }

    private function version(object $article, int $number): array
    {
        $key = $article->id.':'.$number;
        if (! isset($this->versions[$key])) {
            $row = DB::table('article_versions')->where('article_id', $article->id)->where('version', $number)->first();
            $this->snapshots->require($row !== null);
            $this->versions[$key] = $this->snapshots->version($row);
        }

        return $this->versions[$key];
    }

    private function article(object $row, bool $full): array
    {
        $this->snapshots->require(in_array($row->working_state, ['draft', 'in_review', 'reviewed', 'published'], true)
            && (int) $row->working_version > 0 && (int) DB::table('article_versions')->where('article_id', $row->id)->max('version') === (int) $row->working_version);
        $working = $this->version($row, (int) $row->working_version);
        $published = $row->published_version === null ? null : $this->version($row, (int) $row->published_version);
        $this->snapshots->require($published === null || ($published['version'] <= $working['version'] && $published['publishable_languages'] !== []));
        $review = null;
        if ($row->reviewed_version !== null) {
            $this->snapshots->require((int) $row->reviewed_version === $working['version'] && $row->reviewed_hash === $working['content_hash']
                && $row->reviewed_by_user_id !== null && $row->reviewed_at !== null && $working['publishable_languages'] !== []
                && in_array($row->working_state, ['reviewed', 'published'], true));
            $review = ['version' => (int) $row->reviewed_version, 'content_hash' => $row->reviewed_hash,
                'actor' => $this->snapshots->actor((int) $row->reviewed_by_user_id), 'recorded_at' => $row->reviewed_at, 'kind' => 'editorial'];
        } else {
            $this->snapshots->require($row->reviewed_hash === null && $row->reviewed_by_user_id === null && $row->reviewed_at === null
                && ! in_array($row->working_state, ['reviewed', 'published'], true));
        }
        $this->snapshots->require($row->working_state !== 'published' || ($published !== null && $published['version'] === $working['version']));
        $changed = $published !== null && $published['version'] !== $working['version'];
        $status = $row->archived_at !== null ? 'archived' : ($published !== null ? ($changed ? 'published_with_draft' : 'published') : $row->working_state);

        return ['id' => $this->snapshots->publicId($row->public_id), 'slug' => $row->slug, 'author' => $this->snapshots->actor((int) $row->author_user_id),
            'working_state' => $row->working_state, 'status' => $status, 'has_unpublished_changes' => $changed,
            'working' => $full ? $working : $this->versionSummary($working),
            'published' => $published === null ? null : ($full ? $published : $this->versionSummary($published)),
            'review' => $review, 'created_at' => $row->created_at, 'updated_at' => $row->updated_at, 'archived_at' => $row->archived_at,
            'scheduling_enabled' => config('article_content.scheduling_enabled') === true];
    }

    private function versionSummary(array $version): array
    {
        $version['translations'] = (object) array_map(fn ($translation) => ['title' => $translation['title'], 'summary' => $translation['summary']], (array) $version['translations']);
        unset($version['health_references'], $version['source_links']);

        return $version;
    }

    private function articleDetail(Request $request, string $id): array
    {
        $this->query($request);

        return ['data' => $this->article($this->articleRow($id), true)];
    }

    private function articleVersions(Request $request, string $id): array
    {
        $filters = $this->query($request, [], true);
        $article = $this->articleRow($id);
        $this->article($article, false);

        return $this->page(DB::table('article_versions')->where('article_id', $article->id)->orderByDesc('version'), $filters,
            fn ($row) => $this->versionSummary($this->snapshots->version($row)));
    }

    private function articleVersion(Request $request, string $id, string $versionId): array
    {
        $this->query($request);
        $article = $this->articleRow($id);
        $this->article($article, false);
        $row = DB::table('article_versions')->where('article_id', $article->id)->where('public_id', strtolower($versionId))->first();
        abort_unless($row !== null, 404);

        return ['data' => $this->snapshots->version($row)];
    }

    private function articleEvents(Request $request, string $id): array
    {
        $filters = $this->query($request, [], true);
        $article = $this->articleRow($id);
        $this->article($article, false);
        $actions = ['admin.article.created', 'admin.article.draft_saved', 'admin.article.submitted', 'admin.article.reviewed',
            'admin.article.published', 'admin.article.archived', 'admin.article.version_copied'];

        return $this->page(DB::table('audit_events')->where('subject_type', Article::class)->where('subject_id', $article->id)
            ->where('subject_public_id', $article->public_id)->where('outcome', 'succeeded')->whereIn('action', $actions)->orderByDesc('id'), $filters,
            function ($event) use ($article) {
                $this->snapshots->require($event->actor_public_id !== null && ($event->actor_name_snapshot === null || is_string($event->actor_name_snapshot)));
                $after = $this->eventSnapshot($event->after, $article);
                $state = ['admin.article.created' => 'draft', 'admin.article.draft_saved' => 'draft', 'admin.article.submitted' => 'in_review',
                    'admin.article.reviewed' => 'reviewed', 'admin.article.published' => 'published', 'admin.article.version_copied' => 'draft'][$event->action] ?? null;
                $this->snapshots->require($state === null || $after['working_state'] === $state);
                $this->snapshots->require($event->action !== 'admin.article.archived' || ($after['archived'] ?? false) === true);
                $this->snapshots->require($event->action !== 'admin.article.version_copied' || isset($after['source_version_id']));

                return ['id' => $this->snapshots->publicId($event->public_id), 'action' => $event->action,
                    'actor' => ['id' => $this->snapshots->publicId($event->actor_public_id), 'name' => $event->actor_name_snapshot],
                    'before' => $event->before === null ? null : $this->eventSnapshot($event->before, $article),
                    'after' => $after, 'recorded_at' => $event->created_at, 'kind' => 'editorial'];
            });
    }

    private function eventSnapshot(string $json, object $article): array
    {
        $value = $this->snapshots->decode($json);
        $this->snapshots->require(($value['id'] ?? null) === $article->public_id && is_int($value['version'] ?? null)
            && $value['version'] > 0 && is_string($value['version_id'] ?? null) && is_string($value['content_hash'] ?? null)
            && preg_match('/\A[a-f0-9]{64}\z/', $value['content_hash']) === 1
            && ($value['slug'] ?? null) !== null && is_string($value['slug'])
            && preg_match('/\A[a-z0-9][a-z0-9-]{1,158}[a-z0-9]\z/', $value['slug']) === 1
            && in_array($value['working_state'] ?? null, ['draft', 'in_review', 'reviewed', 'published'], true)
            && array_key_exists('published_version', $value) && ($value['published_version'] === null || (is_int($value['published_version'])
                && $value['published_version'] > 0 && $value['published_version'] <= $value['version'])));
        $value['version_id'] = $this->snapshots->publicId($value['version_id']);
        $version = DB::table('article_versions')->where('article_id', $article->id)->where('public_id', $value['version_id'])->first();
        $this->snapshots->require($version !== null && (int) $version->version === $value['version'] && $version->content_hash === $value['content_hash']);
        $safe = array_intersect_key($value, array_flip(['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version']));
        foreach (['taxonomy_count' => 30, 'reference_count' => 30, 'source_count' => 20] as $field => $max) {
            if (array_key_exists($field, $value)) {
                $this->snapshots->require(is_int($value[$field]) && $value[$field] >= 0 && $value[$field] <= $max);
                $safe[$field] = $value[$field];
            }
        }
        if (array_key_exists('archived', $value)) {
            $this->snapshots->require(is_bool($value['archived']));
            $safe['archived'] = $value['archived'];
        }
        if (isset($value['source_version_id'])) {
            $sourceId = $this->snapshots->publicId($value['source_version_id']);
            $source = DB::table('article_versions')->where('article_id', $article->id)->where('public_id', $sourceId)->first();
            $this->snapshots->require($source !== null && (int) $source->version < $value['version'] && $source->content_hash === $value['content_hash']);
            $safe['source_version_id'] = $sourceId;
        }

        return $safe;
    }

    private function terms(Request $request): array
    {
        $filters = $this->query($request, ['q' => 'sometimes|string|max:120|not_regex:/[\x00-\x1f\x7f]/',
            'kind' => 'sometimes|in:category,topic,tag', 'active' => 'sometimes|in:all,0,1', 'parent_id' => 'sometimes|ulid',
            'sort' => 'sometimes|in:id,slug,updated_at', 'direction' => 'sometimes|in:asc,desc'], true);
        $query = DB::table('article_terms as t')->leftJoin('article_term_versions as v', fn ($join) => $join->on('v.term_id', '=', 't.id')->on('v.version', '=', 't.current_version'))->select('t.*');
        foreach (['kind', 'parent_id'] as $field) {
            if (! isset($filters[$field])) {
                continue;
            }
            if ($field === 'kind') {
                $query->where('t.kind', $filters[$field]);
            } else {
                $parent = DB::table('article_terms')->where('public_id', strtolower($filters[$field]))->where('kind', 'category')->first();
                abort_unless($parent !== null, 422);
                $query->where('t.parent_id', $parent->id);
            }
        }
        if (isset($filters['active']) && $filters['active'] !== 'all') {
            $query->where('t.is_active', $filters['active'] === '1');
        }
        if (isset($filters['q'])) {
            $this->search($query, $filters['q'], ['t.slug', 'v.labels->en', 'v.labels->fa']);
        }
        $query->orderBy('t.'.($filters['sort'] ?? 'id'), $filters['direction'] ?? 'desc')->orderByDesc('t.id');

        return $this->page($query, $filters, fn ($row) => $this->term($row));
    }

    private function termRow(string $id): object
    {
        $row = DB::table('article_terms')->where('public_id', strtolower($id))->first();
        abort_unless($row !== null, 404);

        return $row;
    }

    private function term(object $row): array
    {
        $version = DB::table('article_term_versions')->where('term_id', $row->id)->where('version', $row->current_version)->first();
        $this->snapshots->require($version !== null && (int) DB::table('article_term_versions')->where('term_id', $row->id)->max('version') === (int) $row->current_version);

        return $this->snapshots->termResource($this->snapshots->term($row, $version)) + ['actor' => $this->snapshots->actor((int) $version->actor_user_id),
            'recorded_at' => $version->recorded_at, 'created_at' => $row->created_at, 'updated_at' => $row->updated_at];
    }

    private function termDetail(Request $request, string $id): array
    {
        $this->query($request);

        return ['data' => $this->term($this->termRow($id))];
    }

    private function termVersions(Request $request, string $id): array
    {
        $filters = $this->query($request, [], true);
        $term = $this->termRow($id);
        $this->term($term);

        return $this->page(DB::table('article_term_versions')->where('term_id', $term->id)->orderByDesc('version'), $filters,
            fn ($row) => $this->snapshots->termResource($this->snapshots->term($term, $row)) + ['is_current' => (int) $row->version === (int) $term->current_version,
                'actor' => $this->snapshots->actor((int) $row->actor_user_id), 'recorded_at' => $row->recorded_at]);
    }
}
