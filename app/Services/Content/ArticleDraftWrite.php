<?php

namespace App\Services\Content;

use App\Models\Article;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Health\HealthCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/** Draft persistence only. Catalog -> authority -> article -> sorted taxonomy references. */
final class ArticleDraftWrite
{
    public function __construct(private readonly ArticleContent $content, private readonly ArticleSnapshots $snapshots,
        private readonly ArticleAdministrationRead $reader, private readonly AuditLogger $audit) {}

    public function context(Request $request, ?string $id): array
    {
        abort_if($request->query(), 422);

        return DB::transaction(function () use ($request, $id) {
            [$state, $actor, $row, $current] = $this->locked($request, $id);

            return ['id' => $current['id'] ?? null, 'current' => $current,
                'health_catalog' => HealthCatalog::response(),
                'revision' => $this->revision($state, $actor, $current), 'catalog_revision' => (int) $state->revision,
                'presentation_enabled' => config('article_content.presentation_enabled') === true && Schema::hasColumn('article_versions', 'presentation'),
                'composer_enabled' => true,
                'media_enabled' => config('article_content.media_enabled') === true && Schema::hasTable('article_media_assets'),
                'scheduling_available' => config('article_content.presentation_enabled') === true
                    && Schema::hasColumn('article_versions', 'presentation') && Schema::hasTable('article_publication_schedules')
                    && ArticleDuePublisher::available(),
                'can_create' => $row === null, 'can_update' => $row !== null && $row->archived_at === null,
                'can_edit_slug' => $row === null || ($row->archived_at === null && $row->published_version === null),
                'limits' => ['title' => 200, 'summary' => 1000, 'body_utf16_units' => 20000, 'body_utf8_bytes' => 80000,
                    'taxonomy' => 30, 'health_references' => 30, 'source_links' => 20, 'reason' => 1000, 'json_bytes' => 1048576]];
        });
    }

    public function save(Request $request, ?string $id): array
    {
        abort_if($request->query(), 422);
        // Read the original JSON so global trimming cannot hide invalid control bytes.
        abort_unless($request->isJson() && strlen($request->getContent()) <= 1048576, 422);
        $input = json_decode($request->getContent(), true, 20);
        abort_unless(is_array($input) && ! array_is_list($input), 422);
        $rules = ['expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/', 'confirmed' => 'sometimes|accepted',
            'reason' => 'sometimes|string|max:1000', 'slug' => 'required|string|regex:/\A[a-z0-9][a-z0-9-]{1,158}[a-z0-9]\z/',
            'translations' => 'sometimes|array:en,fa', 'health_references' => 'sometimes|array|max:30', 'source_links' => 'sometimes|array|max:20',
            'presentation' => 'sometimes|array:publication,thumbnail,inline', 'intent' => 'sometimes|required|in:draft,publish,schedule',
            'editorial_confirmed' => 'sometimes|accepted',
            'taxonomy' => 'sometimes|array|max:30', 'taxonomy.*' => 'required|array:id,kind',
            'taxonomy.*.id' => 'required|string|ulid', 'taxonomy.*.kind' => 'required|in:category,topic,tag'];
        abort_if(array_diff(array_keys($input), ['expected_revision', 'confirmed', 'reason', 'slug', 'translations', 'health_references', 'source_links', 'taxonomy', 'presentation', 'intent', 'editorial_confirmed']) !== [], 422);
        if (($input['intent'] ?? null) === 'schedule') {
            abort_unless(config('article_content.presentation_enabled') === true && config('article_content.scheduling_enabled') === true
                && ArticleDuePublisher::available(), 503);
            app(ArticleScheduleState::class)->requireSchema();
        }
        if (array_key_exists('presentation', $input)) {
            abort_unless(config('article_content.presentation_enabled') === true && Schema::hasColumn('article_versions', 'presentation'), 503);
        }
        $data = validator($input, $rules)->validate();
        $reason = $data['reason'] ?? 'Article editor action: '.($data['intent'] ?? 'draft').'.';
        abort_unless(mb_check_encoding($reason, 'UTF-8') && ! preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $reason)
            && preg_match('/[^\s\p{Z}\p{Cf}]/u', $reason), 422);
        $selected = $data['taxonomy'] ?? [];
        abort_unless(array_is_list($selected), 422);
        $seen = [];
        foreach ($selected as &$selection) {
            $selection['id'] = strtolower($selection['id']);
            abort_if(isset($seen[$selection['id']]), 422);
            $seen[$selection['id']] = true;
        }
        unset($selection);
        usort($selected, fn ($a, $b) => strcmp($a['id'], $b['id']));

        // No automatic transaction replay; uncertain delivery requires a fresh context/read.
        return DB::transaction(function () use ($request, $id, $data, $reason, $selected) {
            [$state, $actor, $row, $before] = $this->locked($request, $id);
            abort_unless(hash_equals($this->revision($state, $actor, $before), $data['expected_revision']), 409);
            abort_if($row !== null && $row->archived_at !== null, 409);
            $contentInput = array_intersect_key($data, array_flip(['translations', 'health_references', 'source_links', 'presentation']));
            $hasMedia = ($data['presentation']['thumbnail'] ?? null) !== null || ($data['presentation']['inline'] ?? []) !== [];
            if ($hasMedia) {
                try {
                    $contentInput['presentation'] = app(ArticleMediaReferences::class)->resolve($data['presentation']);
                } catch (\InvalidArgumentException) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['presentation' => 'Invalid editorial media references.']);
                }
            }
            $prepared = $this->content->prepare($contentInput, null, $hasMedia);
            // An old client must not silently discard a newer version's preferences/media manifest.
            abort_if(($before['working']['schema_version'] ?? 1) >= 3 && $prepared['schema_version'] < 3, 409);
            abort_if($row !== null && $row->published_version !== null && $row->slug !== $data['slug'], 409);
            abort_if(DB::table('articles')->where('slug', $data['slug'])->when($row !== null, fn ($q) => $q->where('id', '<>', $row->id))->exists(), 409);
            [$snapshots, $links] = $this->taxonomy($selected);
            $hash = $this->content->hash($prepared, $snapshots);
            $unchanged = $before !== null && $before['slug'] === $data['slug'] && hash_equals($before['working']['content_hash'], $hash);
            if ($unchanged) {
                abort_unless(in_array($data['intent'] ?? null, ['publish', 'schedule'], true), 409);

                return app(ArticleComposer::class)->finish($request, $before, $data['intent'], trim($reason));
            }
            $version = ($row === null ? 0 : (int) $row->working_version) + 1;
            $this->snapshots->require($version <= 4294967295 && (int) $state->revision < 9007199254740991);
            $now = now();
            $articleId = $row?->id ?? DB::table('articles')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'slug' => $data['slug'],
                'author_user_id' => $actor->id, 'working_version' => 0, 'working_state' => 'draft', 'created_at' => $now, 'updated_at' => $now]);
            $versionId = DB::table('article_versions')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'article_id' => $articleId,
                'version' => $version, 'schema_version' => $prepared['schema_version'], 'translations' => json_encode((object) $prepared['translations'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'health_catalog_version' => $prepared['health_catalog_version'], 'health_references' => json_encode($prepared['health_references'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'source_links' => json_encode($prepared['source_links'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), 'content_hash' => $hash, 'actor_user_id' => $actor->id, 'recorded_at' => $now]
                + ($prepared['schema_version'] === 3 ? ['presentation' => json_encode($prepared['presentation'], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)] : []));
            foreach ($links as $link) {
                DB::table('article_version_terms')->insert(['article_version_id' => $versionId] + $link);
            }
            if ($prepared['schema_version'] === 3) {
                app(ArticleMediaReferences::class)->store($articleId, $version, $prepared['presentation']);
            }
            DB::table('articles')->where('id', $articleId)->update(['slug' => $data['slug'], 'working_version' => $version, 'working_state' => 'draft',
                'reviewed_version' => null, 'reviewed_hash' => null, 'reviewed_by_user_id' => null, 'reviewed_at' => null, 'updated_at' => $now]);
            app(ArticleScheduleState::class)->invalidate($request, $actor, DB::table('articles')->find($articleId), 'draft_changed');
            DB::table('article_catalog_state')->where('id', 1)->update(['revision' => (int) $state->revision + 1, 'updated_at' => $now]);
            $stored = DB::table('articles')->find($articleId);
            $after = $this->reader->read($request, 'article', $stored->public_id)['data'];
            $subject = new Article;
            $subject->setRawAttributes((array) $stored, true);
            $subject->exists = true;
            $this->audit->log($request, $actor, $row === null ? 'admin.article.created' : 'admin.article.draft_saved', $subject, 'high',
                $before === null ? null : $this->auditSnapshot($before), $this->auditSnapshot($after), reason: trim($reason));

            return app(ArticleComposer::class)->finish($request, $after, $data['intent'] ?? 'draft', trim($reason));
        });
    }

    private function locked(Request $request, ?string $id): array
    {
        $state = DB::table('article_catalog_state')->where('id', 1)->lockForUpdate()->first();
        $this->snapshots->require($state !== null && (int) $state->revision >= 0 && DB::table('article_catalog_state')->count() === 1);
        $actor = User::query()->select(['id', 'public_id', 'name', 'account_state', 'updated_at'])
            ->whereKey($request->user()->getAuthIdentifier())->lockForUpdate()->first();
        abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
        $actor->setRelation('roles', $actor->roles()->sharedLock()->get());
        abort_unless($actor->canAccessAdminPanel(), 403);
        $row = $id === null ? null : DB::table('articles')->where('public_id', strtolower($id))->lockForUpdate()->first();
        abort_if($id !== null && $row === null, 404);
        $current = $row === null ? null : $this->reader->read($request, 'article', $row->public_id)['data'];

        return [$state, $actor, $row, $current];
    }

    private function revision(object $state, User $actor, ?array $current): string
    {
        $key = config('app.key');
        $this->snapshots->require(is_string($key) && $key !== '');
        $normalized = json_decode(json_encode($current, JSON_THROW_ON_ERROR), true, 32, JSON_THROW_ON_ERROR);
        $hash = $this->content->hash(['purpose' => 'article-draft-write-v1', 'catalog' => (int) $state->revision, 'current' => $normalized,
            'actor' => [$actor->public_id, $actor->getRawOriginal('updated_at'), $actor->roles->pluck('name')->sort()->values()->all()]]);

        return hash_hmac('sha256', $hash, $key);
    }

    private function taxonomy(array $selected): array
    {
        $snapshots = [];
        $links = [];
        foreach ($selected as $selection) {
            $term = DB::table('article_terms')->where('public_id', $selection['id'])->lockForUpdate()->first();
            abort_unless($term !== null && $term->kind === $selection['kind'] && (bool) $term->is_active, 422);
            $version = $this->termVersion($term);
            $snapshots[] = $this->snapshots->term($term, $version);
            $links[] = ['term_id' => $term->id, 'term_version_id' => $version->id];
            $seen = [$term->id => true];
            for ($depth = 1; $term->parent_id !== null; $depth++) {
                $this->snapshots->require($depth < 64 && ! isset($seen[$term->parent_id]));
                $seen[$term->parent_id] = true;
                $term = DB::table('article_terms')->where('id', $term->parent_id)->lockForUpdate()->first();
                $this->snapshots->require($term !== null && $term->kind === 'category');
                abort_unless((bool) $term->is_active, 422);
                $this->snapshots->term($term, $this->termVersion($term));
            }
        }

        return [$snapshots, $links];
    }

    private function termVersion(object $term): object
    {
        $version = DB::table('article_term_versions')->where('term_id', $term->id)->where('version', $term->current_version)->first();
        $this->snapshots->require($version !== null && (int) DB::table('article_term_versions')->where('term_id', $term->id)->max('version') === (int) $term->current_version);

        return $version;
    }

    private function auditSnapshot(array $article): array
    {
        return ['id' => $article['id'], 'version_id' => $article['working']['id'], 'slug' => $article['slug'],
            'version' => $article['working']['version'], 'content_hash' => $article['working']['content_hash'],
            'working_state' => $article['working_state'], 'published_version' => $article['published']['version'] ?? null,
            'taxonomy_count' => count($article['working']['taxonomy']), 'reference_count' => count($article['working']['health_references']),
            'source_count' => count($article['working']['source_links'])];
    }
}
