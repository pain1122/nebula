<?php

namespace App\Services\Content;

use App\Models\ArticleTerm;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Catalog anchor -> fresh authority -> target/parents. No clinical catalog mutations. */
final class ArticleTaxonomyWrite
{
    public function __construct(private readonly ArticleSnapshots $snapshots, private readonly ArticleContent $content, private readonly AuditLogger $audit) {}

    public function context(Request $request, ?string $id): array
    {
        abort_if($request->query(), 422);

        return DB::transaction(function () use ($request, $id) {
            [$state, $actor, $term, $snapshot] = $this->locked($request, $id);

            return ['id' => $snapshot['id'] ?? null, 'revision' => $this->revision($state, $actor, $snapshot),
                'current' => $snapshot === null ? null : $this->snapshots->termResource($snapshot),
                'catalog_revision' => (int) $state->revision, 'can_create' => $term === null,
                'can_update' => $term !== null && (bool) $term->is_active,
                'can_retire' => $term !== null && (bool) $term->is_active && ! DB::table('article_terms')->where('parent_id', $term->id)->where('is_active', true)->exists(),
                'limits' => ['label' => 200, 'description' => 1000, 'reason' => 1000, 'hierarchy_depth' => 64]];
        });
    }

    public function mutate(Request $request, ?string $id, string $operation): array
    {
        abort_unless(in_array($operation, ['create', 'update', 'retire'], true), 422);
        abort_if($request->query(), 422);
        $rules = ['expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/',
            'reason' => 'required|string|max:1000', 'confirmed' => 'required|accepted'];
        if ($operation === 'create') {
            $rules += ['kind' => 'required|in:category,topic,tag', 'slug' => 'required|string|regex:/\A[a-z0-9][a-z0-9-]{1,158}[a-z0-9]\z/'];
        }
        if ($operation !== 'retire') {
            $rules += ['labels' => 'required|array:en,fa', 'descriptions' => 'sometimes|array:en,fa', 'parent_id' => 'sometimes|nullable|ulid'];
        } else {
            $rules += ['action' => 'required|in:retire'];
        }
        // Validate the original JSON: global TrimStrings must not silently erase control bytes.
        abort_unless($request->isJson() && strlen($request->getContent()) <= 65536, 422);
        $input = json_decode($request->getContent(), true, 16);
        abort_unless(is_array($input) && ! array_is_list($input), 422);
        abort_if(array_diff(array_keys($input), array_keys($rules)) !== [], 422);
        $data = validator($input, $rules)->validate();
        $reason = $this->text($data['reason'], 1000);
        abort_unless($this->meaningful($reason), 422);
        if ($operation !== 'retire') {
            $data['labels'] = $this->localized($data['labels'], 200, true);
            $data['descriptions'] = $this->localized($data['descriptions'] ?? [], 1000, false);
        }

        // A lost response is resolved by a fresh read, never by automatically replaying a write.
        return DB::transaction(function () use ($request, $id, $operation, $data, $reason) {
            [$state, $actor, $term, $before] = $this->locked($request, $id);
            $confirmedAt = $request->hasSession() ? (int) $request->session()->get('auth.password_confirmed_at', 0) : 0;
            abort_unless($confirmedAt > 0 && $confirmedAt + (int) config('auth.high_authority_password_timeout', 900) >= time(), 423);
            abort_unless(hash_equals($this->revision($state, $actor, $before), $data['expected_revision']), 409);
            abort_unless(($operation === 'create') === ($term === null), 409);
            abort_if($term !== null && ! $term->is_active, 409);
            $kind = $term?->kind ?? $data['kind'];
            $slug = $term?->slug ?? $data['slug'];
            if ($operation === 'create') {
                abort_if(DB::table('article_terms')->where('kind', $kind)->where('slug', $slug)->exists(), 409);
            }
            if ($operation === 'retire') {
                abort_if(DB::table('article_terms')->where('parent_id', $term->id)->where('is_active', true)->exists(), 409);
                $labels = $before['labels'];
                $descriptions = $before['descriptions'];
                $parentId = $term->parent_id;
            } else {
                $labels = $data['labels'];
                $descriptions = $data['descriptions'];
                $parentId = $this->parent($data['parent_id'] ?? null, $kind, $term?->id);
                if ($before !== null) {
                    abort_if($this->content->hash([$labels, $descriptions, $parentId]) === $this->content->hash([$before['labels'], $before['descriptions'], $term->parent_id]), 409);
                }
            }
            $version = ($term === null ? 0 : (int) $term->current_version) + 1;
            $this->snapshots->require($version <= 4294967295 && (int) $state->revision < 9007199254740991);
            $now = now();
            if ($term === null) {
                $termId = DB::table('article_terms')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'kind' => $kind,
                    'slug' => $slug, 'current_version' => 0, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
            } else {
                $termId = $term->id;
            }
            DB::table('article_term_versions')->insert(['public_id' => strtolower((string) Str::ulid()), 'term_id' => $termId,
                'version' => $version, 'schema_version' => 1, 'labels' => json_encode((object) $labels, JSON_THROW_ON_ERROR),
                'descriptions' => json_encode((object) $descriptions, JSON_THROW_ON_ERROR), 'parent_id' => $parentId,
                'is_active' => $operation !== 'retire', 'actor_user_id' => $actor->id, 'recorded_at' => $now]);
            DB::table('article_terms')->where('id', $termId)->update(['current_version' => $version, 'parent_id' => $parentId,
                'is_active' => $operation !== 'retire', 'updated_at' => $now]);
            DB::table('article_catalog_state')->where('id', 1)->update(['revision' => (int) $state->revision + 1, 'updated_at' => $now]);
            $row = DB::table('article_terms')->find($termId);
            $after = $this->current($row);
            $subject = new ArticleTerm;
            $subject->setRawAttributes((array) $row, true);
            $subject->exists = true;
            $this->audit->log($request, $actor, 'admin.article_term.'.['create' => 'created', 'update' => 'updated', 'retire' => 'retired'][$operation],
                $subject, 'high', $before === null ? null : $this->auditSnapshot($before), $this->auditSnapshot($after), reason: $reason);

            return $this->snapshots->termResource($after);
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
        $term = $id === null ? null : DB::table('article_terms')->where('public_id', strtolower($id))->lockForUpdate()->first();
        abort_if($id !== null && $term === null, 404);

        return [$state, $actor, $term, $term === null ? null : $this->current($term)];
    }

    private function revision(object $state, User $actor, ?array $snapshot): string
    {
        $key = config('app.key');
        $this->snapshots->require(is_string($key) && $key !== '');
        $hash = $this->content->hash(['purpose' => 'article-taxonomy-write-v1', 'catalog' => (int) $state->revision,
            'term' => $snapshot, 'actor' => [$actor->public_id, $actor->getRawOriginal('updated_at'), $actor->roles->pluck('name')->sort()->values()->all()]]);

        return hash_hmac('sha256', $hash, $key);
    }

    private function current(object $term): array
    {
        $version = DB::table('article_term_versions')->where('term_id', $term->id)->where('version', $term->current_version)->first();
        $this->snapshots->require($version !== null && (int) DB::table('article_term_versions')->where('term_id', $term->id)->max('version') === (int) $term->current_version);

        return $this->snapshots->term($term, $version);
    }

    private function parent(?string $id, string $kind, ?int $target): ?int
    {
        if ($id === null) {
            return null;
        }
        abort_unless($kind === 'category', 422);
        $row = DB::table('article_terms')->where('public_id', strtolower($id))->lockForUpdate()->first();
        abort_unless($row !== null, 422);
        $parent = (int) $row->id;
        $seen = $target === null ? [] : [$target => true];
        // Bound malformed legacy ancestry as well as newly proposed cycles; never silently detach it.
        for ($depth = 1; ; $depth++) {
            abort_if($depth >= 64 || isset($seen[(int) $row->id]), 422);
            $seen[(int) $row->id] = true;
            $this->current($row);
            abort_unless($row->kind === 'category' && (bool) $row->is_active, 422);
            if ($row->parent_id === null) {
                break;
            }
            $row = DB::table('article_terms')->where('id', $row->parent_id)->lockForUpdate()->first();
            $this->snapshots->require($row !== null);
        }

        return $parent;
    }

    private function localized(array $values, int $limit, bool $required): array
    {
        foreach ($values as $language => $value) {
            $values[$language] = $this->text($value, $limit);
        }
        abort_if($required && ! collect($values)->contains(fn ($value) => $this->meaningful($value)), 422);
        ksort($values);

        return $values;
    }

    private function text(mixed $value, int $limit): string
    {
        abort_unless(is_string($value) && mb_check_encoding($value, 'UTF-8') && mb_strlen($value) <= $limit
            && ! preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value), 422);

        return trim($value);
    }

    private function meaningful(string $value): bool
    {
        return preg_match('/[^\s\p{Z}\p{Cf}]/u', $value) === 1;
    }

    private function auditSnapshot(array $snapshot): array
    {
        return array_intersect_key($snapshot, array_flip(['id', 'version_id', 'kind', 'slug', 'version', 'is_active', 'parent_id']));
    }
}
