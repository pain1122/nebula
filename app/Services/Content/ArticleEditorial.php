<?php

namespace App\Services\Content;

use App\Models\Article;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Explicit editorial actions; never implies clinical review or automatic publication. */
final class ArticleEditorial
{
    private const ACTIONS = 'submit,review,publish,archive,copy_version';

    public function __construct(private readonly ArticleContent $content, private readonly ArticleSnapshots $snapshots,
        private readonly ArticleAdministrationRead $reader, private readonly AuditLogger $audit) {}

    public function context(Request $request, string $id): array
    {
        $input = $request->query();
        abort_if(array_diff(array_keys($input), ['action', 'source_version_id']) !== [], 422);
        abort_if(($input['action'] ?? null) !== 'copy_version' && array_key_exists('source_version_id', $input), 422);
        $data = validator($input, ['action' => 'required|in:'.self::ACTIONS,
            'source_version_id' => 'required_if:action,copy_version|prohibited_unless:action,copy_version|string|ulid'])->validate();

        return DB::transaction(function () use ($request, $id, $data) {
            [$state, $actor, $row, $current, $source] = $this->locked($request, $id, $data['source_version_id'] ?? null);
            $blockers = $this->blockers($row, $current, $source, $data['action']);

            return ['action' => $data['action'], 'current' => $current, 'source' => $source, 'eligible' => $blockers === [],
                'blockers' => $blockers, 'review_kind' => 'editorial', 'catalog_revision' => (int) $state->revision,
                'revision' => $this->revision($state, $actor, $current, $source, $data['action'])];
        });
    }

    public function act(Request $request, string $id, bool $fromComposer = false): array
    {
        abort_if($fromComposer && DB::transactionLevel() < 1, 503);
        abort_if($request->query(), 422);
        abort_unless($request->isJson() && strlen($request->getContent()) <= 16384, 422);
        $input = json_decode($request->getContent(), true, 12);
        abort_unless(is_array($input) && ! array_is_list($input), 422);
        abort_if(($input['action'] ?? null) !== 'copy_version'
            && array_intersect(array_keys($input), ['source_version_id', 'source_hash']) !== [], 422);
        $rules = ['action' => 'required|in:'.self::ACTIONS, 'expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/',
            'expected_version' => 'required|integer|min:1|max:4294967295', 'expected_hash' => 'required|string|regex:/\A[a-f0-9]{64}\z/',
            'reason' => ($input['action'] ?? null) === 'publish' ? 'sometimes|string|max:1000' : 'required|string|max:1000',
            'confirmed' => ($input['action'] ?? null) === 'publish' ? 'sometimes|accepted' : 'required|accepted',
            'source_version_id' => 'required_if:action,copy_version|prohibited_unless:action,copy_version|string|ulid',
            'source_hash' => 'required_if:action,copy_version|prohibited_unless:action,copy_version|string|regex:/\A[a-f0-9]{64}\z/'];
        abort_if(array_diff(array_keys($input), array_keys($rules)) !== [], 422);
        $data = validator($input, $rules)->validate();
        $reason = $data['reason'] ?? 'Article publication action.';
        abort_unless(mb_check_encoding($reason, 'UTF-8') && ! preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $reason)
            && preg_match('/[^\s\p{Z}\p{Cf}]/u', $reason), 422);

        return DB::transaction(function () use ($request, $id, $data, $reason, $fromComposer) {
            [$state, $actor, $row, $before, $source] = $this->locked($request, $id, $data['source_version_id'] ?? null);
            $confirmed = $request->hasSession() ? (int) $request->session()->get('auth.password_confirmed_at', 0) : 0;
            if (! $fromComposer && $data['action'] !== 'publish') {
                abort_unless($confirmed > 0 && $confirmed + (int) config('auth.high_authority_password_timeout', 900) >= time(), 423);
            }
            abort_unless(hash_equals($this->revision($state, $actor, $before, $source, $data['action']), $data['expected_revision'])
                && (int) $data['expected_version'] === $before['working']['version'] && hash_equals($before['working']['content_hash'], $data['expected_hash']), 409);
            abort_if($source !== null && ! hash_equals($source['content_hash'], $data['source_hash']), 409);
            abort_unless($this->blockers($row, $before, $source, $data['action']) === [], 409);
            $this->snapshots->require((int) $state->revision < 9007199254740991);
            $now = now();
            $values = ['updated_at' => $now];
            switch ($data['action']) {
                case 'submit':
                    $values += ['working_state' => 'in_review'];
                    break;
                case 'review':
                    $values += ['working_state' => 'reviewed', 'reviewed_version' => $before['working']['version'],
                        'reviewed_hash' => $before['working']['content_hash'], 'reviewed_by_user_id' => $actor->id, 'reviewed_at' => $now];
                    break;
                case 'publish':
                    $values += ['working_state' => 'published', 'published_version' => $before['working']['version']];
                    break;
                case 'archive':
                    $values += ['archived_at' => $now];
                    break;
                case 'copy_version':
                    $number = (int) $row->working_version + 1;
                    $this->snapshots->require($number <= 4294967295);
                    $this->copy($row, $source, $number, $actor);
                    $values += ['working_version' => $number, 'working_state' => 'draft', 'reviewed_version' => null,
                        'reviewed_hash' => null, 'reviewed_by_user_id' => null, 'reviewed_at' => null];
                    break;
            }
            DB::table('articles')->where('id', $row->id)->update($values);
            if (in_array($data['action'], ['publish', 'archive', 'copy_version'], true)) {
                app(ArticleScheduleState::class)->invalidate($request, $actor, $row,
                    ['publish' => 'immediate_publication', 'archive' => 'archived', 'copy_version' => 'version_recovered'][$data['action']]);
            }
            DB::table('article_catalog_state')->where('id', 1)->update(['revision' => (int) $state->revision + 1, 'updated_at' => $now]);
            $after = $this->read($request, $row->public_id);
            $subject = new Article;
            $subject->setRawAttributes((array) DB::table('articles')->find($row->id), true);
            $subject->exists = true;
            $action = ['submit' => 'submitted', 'review' => 'reviewed', 'publish' => 'published', 'archive' => 'archived', 'copy_version' => 'version_copied'][$data['action']];
            $this->audit->log($request, $actor, 'admin.article.'.$action, $subject, 'high', $this->auditSnapshot($before),
                $this->auditSnapshot($after) + ($source === null ? [] : ['source_version_id' => $source['id']]), reason: trim($reason));

            return $after;
        });
    }

    private function locked(Request $request, string $id, ?string $sourceId): array
    {
        $state = DB::table('article_catalog_state')->where('id', 1)->lockForUpdate()->first();
        $this->snapshots->require($state !== null && (int) $state->revision >= 0 && DB::table('article_catalog_state')->count() === 1);
        $actor = User::query()->select(['id', 'public_id', 'name', 'account_state', 'updated_at'])
            ->whereKey($request->user()->getAuthIdentifier())->lockForUpdate()->first();
        abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
        $actor->setRelation('roles', $actor->roles()->sharedLock()->get());
        abort_unless($actor->canAccessAdminPanel(), 403);
        $row = DB::table('articles')->where('public_id', strtolower($id))->lockForUpdate()->first();
        abort_unless($row !== null, 404);
        $current = $this->read($request, $row->public_id);
        $source = null;
        if ($sourceId !== null) {
            $version = DB::table('article_versions')->where('article_id', $row->id)->where('public_id', strtolower($sourceId))->first();
            abort_unless($version !== null, 404);
            $source = $this->snapshots->version($version);
        }

        return [$state, $actor, $row, $current, $source];
    }

    private function read(Request $request, string $id): array
    {
        $plain = Request::create('/api/admin/articles/'.$id, 'GET');
        $plain->setUserResolver($request->getUserResolver());

        return $this->reader->read($plain, 'article', $id)['data'];
    }

    /** Caller holds the catalog and article locks; also used by the dedicated schedule publisher. */
    public function blockers(object $row, array $current, ?array $source, string $action): array
    {
        if ($row->archived_at !== null) {
            return ['archived'];
        }
        if ($action === 'archive') {
            return [];
        }
        if ($action === 'copy_version') {
            return $source === null || $source['version'] >= $current['working']['version'] ? ['source_not_older']
                : ($source['content_hash'] === $current['working']['content_hash'] ? ['no_content_change'] : []);
        }
        $required = ['submit' => 'draft', 'review' => 'in_review', 'publish' => 'reviewed'][$action];
        $blockers = $row->working_state === $required ? [] : ['wrong_state'];
        if ($action === 'publish' && $row->published_version !== null && (int) $row->published_version === $current['working']['version']) {
            $blockers[] = 'already_published';
        }
        if ($current['working']['publishable_languages'] === []) {
            $blockers[] = 'incomplete_translation';
        }
        // Resolve current identity/ancestry under the same catalog lock, without rewriting historical labels.
        foreach ($current['working']['taxonomy'] as $reference) {
            $term = DB::table('article_terms')->where('public_id', $reference['id'])->lockForUpdate()->first();
            $this->snapshots->require($term !== null);
            $seen = [];
            for ($depth = 0; ; $depth++) {
                $this->snapshots->require($depth < 64 && ! isset($seen[$term->id]));
                $seen[$term->id] = true;
                $version = DB::table('article_term_versions')->where('term_id', $term->id)->where('version', $term->current_version)->first();
                $this->snapshots->require($version !== null && (int) DB::table('article_term_versions')->where('term_id', $term->id)->max('version') === (int) $term->current_version);
                $this->snapshots->term($term, $version);
                if (! $term->is_active) {
                    $blockers[] = 'inactive_taxonomy_reference';
                }
                if ($term->parent_id === null) {
                    break;
                }
                $term = DB::table('article_terms')->where('id', $term->parent_id)->lockForUpdate()->first();
                $this->snapshots->require($term !== null && $term->kind === 'category');
            }
        }

        return array_values(array_unique(array_merge($blockers, app(ArticleMediaReferences::class)->blockers($current['working']))));
    }

    private function revision(object $state, User $actor, array $current, ?array $source, string $action): string
    {
        $key = config('app.key');
        $this->snapshots->require(is_string($key) && $key !== '');
        $normalized = json_decode(json_encode([$current, $source], JSON_THROW_ON_ERROR), true, 32, JSON_THROW_ON_ERROR);
        $signature = $this->content->hash(['purpose' => 'article-editorial-v1', 'action' => $action, 'catalog' => (int) $state->revision,
            'resources' => $normalized, 'actor' => [$actor->public_id, $actor->getRawOriginal('updated_at'), $actor->roles->pluck('name')->sort()->values()->all()]]);

        return hash_hmac('sha256', $signature, $key);
    }

    private function copy(object $article, array $source, int $number, User $actor): void
    {
        $row = DB::table('article_versions')->where('article_id', $article->id)->where('public_id', $source['id'])->first();
        $this->snapshots->require($row !== null);
        $id = DB::table('article_versions')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'article_id' => $article->id,
            'version' => $number, 'schema_version' => $row->schema_version, 'translations' => $row->translations,
            'health_catalog_version' => $row->health_catalog_version, 'health_references' => $row->health_references,
            'source_links' => $row->source_links, 'content_hash' => $row->content_hash, 'actor_user_id' => $actor->id, 'recorded_at' => now()]
            + ((int) $row->schema_version === 3 ? ['presentation' => $row->presentation] : []));
        foreach (DB::table('article_version_terms')->where('article_version_id', $row->id)->orderBy('term_id')->get() as $link) {
            DB::table('article_version_terms')->insert(['article_version_id' => $id, 'term_id' => $link->term_id, 'term_version_id' => $link->term_version_id]);
        }
        if ((int) $row->schema_version === 3) {
            app(ArticleMediaReferences::class)->store((int) $article->id, $number, $source['presentation']);
        }
    }

    private function auditSnapshot(array $article): array
    {
        return ['id' => $article['id'], 'version_id' => $article['working']['id'], 'slug' => $article['slug'],
            'version' => $article['working']['version'], 'content_hash' => $article['working']['content_hash'],
            'working_state' => $article['working_state'], 'published_version' => $article['published']['version'] ?? null,
            'archived' => $article['archived_at'] !== null];
    }
}
