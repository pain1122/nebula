<?php

namespace App\Services\Recommendations;

use App\Models\AuditEvent;
use App\Models\RecommendationReviewerGrant;
use App\Models\RecommendationRule;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Health\HealthCatalog;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RecommendationAdministration
{
    public function __construct(private readonly RecommendationAuthority $authority, private readonly RecommendationContent $content,
        private readonly AuditLogger $audit, private readonly RecommendationTargetPreview $targets) {}

    public function read(Request $request, ?string $id = null): array
    {
        return DB::transaction(function () use ($request, $id) {
            $state = $this->authority->catalog();
            $actor = $this->authority->actor($request);
            abort_unless($this->authority->staff($actor) || $actor->hasRole('doctor'), 403);
            if ($id !== null) {
                abort_if($request->query() !== [], 422);
                $row = $this->row($id);
                $this->visible($actor, $row);

                return $this->resource($actor, $row, $state);
            }
            $parameters = $request->query();
            abort_if(array_diff(array_keys($parameters), ['q', 'state', 'page', 'reviewer_q']), 422);
            $data = validator($parameters, ['q' => 'sometimes|string|max:100|not_regex:/[\x00-\x1f\x7f]/',
                'state' => 'sometimes|in:draft,in_review,reviewed,rejected,published,retired', 'page' => 'sometimes|integer|min:1|max:10000',
                'reviewer_q' => 'sometimes|string|max:100|not_regex:/[\x00-\x1f\x7f]/'])->validate();
            abort_if(isset($data['reviewer_q']) && ! $actor->hasRole('root-admin'), 403);
            $query = DB::table('recommendation_rules as r');
            if (! $this->authority->staff($actor)) {
                $grant = $this->authority->grant($actor->id);
                $query->where(fn ($q) => $q->where(fn ($assigned) => $assigned->where('assigned_reviewer_id', $actor->id)->whereRaw($grant === null ? '0 = 1' : '1 = 1'))->orWhereExists(fn ($reviews) => $reviews
                    ->selectRaw('1')->from('recommendation_rule_reviews as review')->whereColumn('review.rule_id', 'r.id')->where('reviewer_user_id', $actor->id)));
            }
            if (! empty($data['q'])) {
                $pattern = '%'.strtr($data['q'], ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
                $query->whereRaw("r.slug LIKE ? ESCAPE '!'", [$pattern]);
            }
            if (isset($data['state'])) {
                $data['state'] === 'retired' ? $query->whereNotNull('retired_at') : $query->whereNull('retired_at')->where('working_state', $data['state']);
            }
            $page = $query->orderByDesc('r.id')->paginate(12, ['r.*'], 'page', (int) ($data['page'] ?? 1));
            $items = $page->getCollection()->map(fn ($row) => $this->summary($actor, $row))->all();
            $reviewers = [];
            foreach (DB::table('recommendation_reviewer_grants')->whereNull('revoked_at')->where('valid_until', '>', now())->orderBy('id')->limit(100)->get() as $grant) {
                if ($this->authority->grant((int) $grant->user_id, (int) $grant->id)) {
                    $user = User::query()->whereKey($grant->user_id)->first();
                    $reviewers[$user->public_id] = ['id' => $user->public_id, 'name' => $user->name, 'valid_until' => $grant->valid_until];
                }
            }
            $grants = $actor->hasRole('root-admin') ? DB::table('recommendation_reviewer_grants')->orderByDesc('id')->limit(100)->get()
                ->map(fn ($row) => ['id' => $row->public_id, 'reviewer' => $this->person((int) $row->user_id), 'scope' => $row->scope,
                    'valid_until' => $row->valid_until, 'revoked' => $row->revoked_at !== null,
                    'revoke_revision' => $this->revision($actor, $state, $row->public_id, 'revoke')])->all() : [];

            $candidates = [];
            if ($actor->hasRole('root-admin')) {
                $doctors = User::query()->where('account_state', 'active')->whereHas('roles', fn ($q) => $q->where('name', 'doctor'))
                    ->whereHas('doctorProfile', fn ($q) => $q->where('verified', true));
                if (! empty($data['reviewer_q'])) {
                    $pattern = '%'.strtr($data['reviewer_q'], ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
                    $doctors->whereRaw("name LIKE ? ESCAPE '!'", [$pattern]);
                }
                $candidates = $doctors->orderBy('name')->limit(20)->get(['public_id', 'name'])->map(fn ($row) => ['id' => $row->public_id, 'name' => $row->name])->all();
            }

            return ['items' => $items, 'pagination' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
                'designation_candidates' => $candidates,
                'reviewers' => $this->authority->staff($actor) ? array_values($reviewers) : [], 'grants' => $grants, 'catalog' => HealthCatalog::response(),
                'create_revision' => $this->authority->staff($actor) ? $this->revision($actor, $state, null, 'save') : null,
                'grant_revision' => $actor->hasRole('root-admin') ? $this->revision($actor, $state, null, 'grant') : null];
        });
    }

    public function save(Request $request, ?string $id): array
    {
        $input = $this->json($request, ['expected_revision', 'action_key', 'slug', 'content']);
        validator($input, ['slug' => 'required|string|regex:/\A[a-z0-9][a-z0-9-]{1,158}[a-z0-9]\z/', 'content' => 'required|array'])->validate();

        return DB::transaction(function () use ($request, $id, $input) {
            $state = $this->authority->catalog(true);
            $actor = $this->authority->actor($request);
            abort_unless($this->authority->staff($actor), 403);
            $row = $id === null ? null : $this->row($id);
            if ($event = $this->replay($actor, 'draft_saved', $input, $id)) {
                return ['id' => $event->subject_public_id, 'applied' => true];
            }
            $this->expect($actor, $state, $id, 'save', $input);
            abort_if($row !== null && $row->retired_at !== null, 409);
            abort_if($row !== null && $row->published_version !== null && $input['slug'] !== $row->slug, 409);
            abort_if(DB::table('recommendation_rules')->where('slug', $input['slug'])->when($row !== null, fn ($q) => $q->where('id', '!=', $row->id))->exists(), 409);
            $value = $this->content->input($input['content']);
            if ($row === null) {
                $key = DB::table('recommendation_rules')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'slug' => $input['slug'],
                    'author_user_id' => $actor->id, 'created_at' => now(), 'updated_at' => now()]);
                $row = DB::table('recommendation_rules')->where('id', $key)->first();
            }
            $version = (int) $row->working_version + 1;
            abort_if($version > 4294967295, 409);
            $record = ['public_id' => strtolower((string) Str::ulid()), 'rule_id' => $row->id, 'version' => $version,
                'actor_user_id' => $actor->id, 'schema_version' => 1, 'health_catalog_version' => HealthCatalog::VERSION,
                'evaluator_version' => RuleCondition::EVALUATOR_VERSION, 'content_hash' => $this->content->hash($value, $actor->id), 'recorded_at' => now()];
            foreach ($value as $key => $item) {
                $record[$key] = $key === 'priority' ? $item : json_encode($item, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            }
            DB::table('recommendation_rule_versions')->insert($record);
            foreach ($value['targets'] as $target) {
                $article = DB::table('articles')->where('public_id', $target['id'])->first();
                DB::table('recommendation_rule_version_targets')->insert(['rule_id' => $row->id, 'rule_version' => $version,
                    'article_id' => $article->id, 'article_version' => $target['version'], 'content_hash' => $target['content_hash']]);
            }
            DB::table('recommendation_rules')->where('id', $row->id)->update(['slug' => $input['slug'], 'working_version' => $version,
                'working_state' => 'draft', 'assigned_reviewer_id' => null, 'updated_at' => now()]);
            $this->record($request, $actor, 'draft_saved', $row, $input, ['version' => $version, 'content_hash' => $record['content_hash'], 'state' => 'draft']);

            return ['id' => $row->public_id, 'applied' => true];
        });
    }

    public function act(Request $request, string $id): array
    {
        $input = $this->json($request, ['expected_revision', 'action_key', 'action'], ['reviewer_id', 'review_id', 'assessment', 'valid_until_local', 'attested']);
        abort_unless(in_array($input['action'], ['submit', 'publish', 'retire', 'approve', 'reject', 'withdraw'], true), 422);
        $extra = match ($input['action']) {
            'submit' => ['reviewer_id'], 'approve' => ['assessment', 'valid_until_local', 'attested'],
            'reject' => ['assessment'], 'withdraw' => ['assessment', 'review_id'], default => [],
        };
        abort_if(array_diff(array_keys($input), ['expected_revision', 'action_key', 'action', ...$extra]), 422);

        return DB::transaction(function () use ($request, $id, $input) {
            $state = $this->authority->catalog(true);
            $actor = $this->authority->actor($request);
            $row = $this->row($id);
            $action = $input['action'];
            $staffAction = in_array($action, ['submit', 'publish', 'retire'], true);
            abort_unless($staffAction ? $this->authority->staff($actor) : $actor->hasRole('doctor'), 403);
            $this->visible($actor, $row);
            if ($event = $this->replay($actor, $action, $input, $id)) {
                return ['id' => $event->subject_public_id, 'applied' => true];
            }
            $this->expect($actor, $state, $id, $action, $input);
            abort_if($row->retired_at !== null && $action !== 'withdraw', 409);
            $version = $this->version($row, (int) $row->working_version);
            $snapshot = in_array($action, ['retire', 'withdraw'], true) ? [] : $this->content->snapshot($version);
            $values = ['updated_at' => now()];
            if ($action === 'submit') {
                $reviewer = User::where('public_id', $input['reviewer_id'] ?? '')->first();
                abort_unless($reviewer !== null && $reviewer->id !== (int) $version->actor_user_id
                    && $this->authority->grant($reviewer->id) !== null && $this->reviewable($version, $snapshot), 409);
                $values += ['assigned_reviewer_id' => $reviewer->id, 'working_state' => 'in_review'];
            } elseif ($action === 'publish') {
                $review = $this->approval($row, $version, $snapshot);
                abort_unless($row->working_state === 'reviewed' && $review !== null, 409);
                $values += ['published_version' => $row->working_version, 'published_review_id' => $review->id, 'working_state' => 'published'];
            } elseif ($action === 'retire') {
                $values += ['retired_at' => now()];
            } else {
                $this->clinical($actor, $row, $version, $snapshot, $input);
                if ($action !== 'withdraw') {
                    $values += ['working_state' => $action === 'approve' ? 'reviewed' : 'rejected'];
                }
            }
            DB::table('recommendation_rules')->where('id', $row->id)->update($values);
            $this->record($request, $actor, $action, $row, $input, ['version' => (int) $row->working_version, 'state' => $values['working_state'] ?? $row->working_state]);

            return ['id' => $id, 'applied' => true];
        });
    }

    private function clinical(User $actor, object $rule, object $version, array $snapshot, array $input): void
    {
        $action = $input['action'];
        $old = null;
        if ($action === 'withdraw') {
            $old = DB::table('recommendation_rule_reviews')->where('public_id', $input['review_id'] ?? '')->where('rule_id', $rule->id)
                ->where('reviewer_user_id', $actor->id)->lockForUpdate()->first();
            abort_unless($old !== null && $old->outcome === 'approved', 409);
            abort_if(DB::table('recommendation_rule_reviews')->where('supersedes_review_id', $old->id)->sharedLock()->first() !== null, 409);
            $grant = DB::table('recommendation_reviewer_grants')->where('id', $old->reviewer_grant_id)->sharedLock()->first();
            $version = $this->version($rule, (int) $old->rule_version);
        } else {
            $grant = $this->authority->grant($actor->id);
            abort_unless($grant !== null && (int) $rule->assigned_reviewer_id === $actor->id && (int) $version->actor_user_id !== $actor->id
                && $rule->working_state === 'in_review' && $this->reviewable($version, $snapshot), 403);
        }
        $assessment = $input['assessment'] ?? null;
        abort_unless(is_string($assessment) && mb_check_encoding($assessment, 'UTF-8') && mb_strlen($assessment) >= 1
            && mb_strlen($assessment) <= 2000 && trim($assessment) !== '' && ! preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $assessment), 422);
        $expires = $action === 'approve' ? $this->expiry($input['valid_until_local'] ?? null) : now();
        if ($action === 'approve') {
            abort_unless(($input['attested'] ?? null) === true && $expires <= $grant->valid_until, 422);
            abort_unless($this->targets->readable($snapshot), 409);
        }
        DB::table('recommendation_rule_reviews')->insert(['public_id' => strtolower((string) Str::ulid()), 'rule_id' => $rule->id,
            'rule_version' => $version->version, 'reviewer_grant_id' => $grant->id, 'reviewer_user_id' => $actor->id,
            'outcome' => ['approve' => 'approved', 'reject' => 'rejected', 'withdraw' => 'withdrawn'][$action],
            'content_hash' => $version->content_hash, 'assessment' => $assessment, 'valid_until' => $expires,
            'supersedes_review_id' => $old?->id, 'action_key' => $input['action_key'], 'recorded_at' => now()]);
    }

    public function designate(Request $request, ?string $id = null): array
    {
        $action = $id === null ? 'grant' : 'revoke';
        $input = $this->json($request, ['expected_revision', 'action_key', 'confirmed'], $id === null ? ['reviewer_id', 'evidence_ref', 'valid_until_local'] : []);

        return DB::transaction(function () use ($request, $id, $action, $input) {
            $state = $this->authority->catalog(true);
            $actor = $this->authority->actor($request);
            abort_unless($actor->hasRole('root-admin'), 403);
            $confirmed = $request->hasSession() ? (int) $request->session()->get('auth.password_confirmed_at', 0) : 0;
            abort_unless(($input['confirmed'] ?? null) === true && $confirmed > 0
                && $confirmed + (int) config('auth.high_authority_password_timeout', 900) >= time(), 423);
            if ($event = $this->replay($actor, $action, $input, $id)) {
                return ['id' => $event->subject_public_id, 'applied' => true];
            }
            $this->expect($actor, $state, $id, $action, $input);
            if ($id === null) {
                $doctor = User::query()->where('public_id', $input['reviewer_id'] ?? '')->sharedLock()->first();
                if ($doctor !== null) {
                    $doctor->setRelation('roles', $doctor->roles()->sharedLock()->get());
                }
                abort_unless($doctor !== null && $doctor->permitsAuthentication() && $doctor->hasRole('doctor')
                    && DB::table('doctor_profiles')->where('user_id', $doctor->id)->where('verified', true)->whereNull('deleted_at')->sharedLock()->first() !== null, 409);
                $evidence = $input['evidence_ref'] ?? null;
                abort_unless(is_string($evidence) && preg_match('/\A[a-zA-Z0-9][a-zA-Z0-9._:\/-]{2,199}\z/', $evidence), 422);
                $until = $this->expiry($input['valid_until_local'] ?? null);
                abort_if($this->authority->grant($doctor->id) !== null, 409);
                $key = DB::table('recommendation_reviewer_grants')->insertGetId(['public_id' => strtolower((string) Str::ulid()),
                    'user_id' => $doctor->id, 'granted_by_user_id' => $actor->id, 'scope' => 'article', 'evidence_ref' => $evidence,
                    'valid_from' => now(), 'valid_until' => $until, 'created_at' => now(), 'updated_at' => now()]);
            } else {
                $grant = DB::table('recommendation_reviewer_grants')->where('public_id', $id)->lockForUpdate()->first();
                abort_unless($grant !== null && $grant->revoked_at === null, 409);
                $key = $grant->id;
                DB::table('recommendation_reviewer_grants')->where('id', $key)->update(['revoked_at' => now(), 'updated_at' => now()]);
            }
            $subject = RecommendationReviewerGrant::query()->findOrFail($key);
            $this->audit->log($request, $actor, 'recommendation.'.$action, $subject, 'high', null,
                ['id' => $subject->public_id, 'scope' => 'article', 'action_key' => $input['action_key'], 'request_hash' => $this->requestHash($input)],
                reason: 'Recommendation reviewer designation action.');
            $this->authority->bump();

            return ['id' => $subject->public_id, 'applied' => true];
        });
    }

    public function approval(object $rule, object $version, array $snapshot): ?object
    {
        $review = DB::table('recommendation_rule_reviews')->where('rule_id', $rule->id)->where('rule_version', $version->version)
            ->whereIn('outcome', ['approved', 'rejected'])
            ->orderByDesc('id')->sharedLock()->first();
        if ($review === null || $review->outcome !== 'approved' || ! hash_equals($review->content_hash, $version->content_hash)
            || DB::table('recommendation_rule_reviews')->where('supersedes_review_id', $review->id)->sharedLock()->first() !== null
            || $review->valid_until <= now()->toDateTimeString() || (int) $review->reviewer_user_id === (int) $version->actor_user_id
            || $this->authority->grant((int) $review->reviewer_user_id, (int) $review->reviewer_grant_id) === null
            || ! $this->reviewable($version, $snapshot)) {
            return null;
        }

        return $review;
    }

    private function reviewable(object $version, array $snapshot): bool
    {
        return $this->content->languages($snapshot) !== [] && $snapshot['sources'] !== [] && $this->content->targetsCurrent($version, $snapshot);
    }

    private function resource(User $actor, object $row, object $state): array
    {
        $staff = $this->authority->staff($actor);
        $assigned = (int) $row->assigned_reviewer_id === $actor->id && $this->authority->grant($actor->id) !== null;
        $reviews = DB::table('recommendation_rule_reviews')->where('rule_id', $row->id)
            ->when(! $staff, fn ($q) => $q->where('reviewer_user_id', $actor->id))->orderByDesc('id')->limit(50)->get();
        $number = $staff || $assigned ? (int) $row->working_version : (int) $reviews->first()?->rule_version;
        $version = $this->version($row, $number);
        $snapshot = $this->content->snapshot($version);
        unset($snapshot['author_id']);
        $contexts = [];
        foreach ([...($staff ? ['save', 'submit', 'publish', 'retire'] : []), ...($actor->hasRole('doctor') ? ['approve', 'reject', 'withdraw'] : [])] as $action) {
            $contexts[$action] = $this->revision($actor, $state, $row->public_id, $action);
        }
        $published = $row->published_version === null ? null : $this->version($row, (int) $row->published_version);
        $eligible = $published !== null && $row->retired_at === null
            && ($approval = $this->approval($row, $published, $this->content->snapshot($published))) !== null
            && (int) $row->published_review_id === (int) $approval->id;
        $history = DB::table('recommendation_rule_versions')->where('rule_id', $row->id)
            ->when(! $staff, fn ($q) => $q->where(fn ($visible) => $visible->where('version', $number)->orWhereIn('version', $reviews->pluck('rule_version'))))
            ->orderByDesc('version')->limit(50)->get(['public_id', 'version', 'content_hash', 'recorded_at']);

        return [...$this->summary($actor, $row), 'working' => $snapshot, 'target_previews' => $this->targets->previews($snapshot),
            'published_version' => $staff ? ($row->published_version === null ? null : (int) $row->published_version) : null,
            'publication_eligible' => $eligible, 'can_publish' => $staff && $row->working_state === 'reviewed' && $this->approval($row, $version, $this->content->snapshot($version)) !== null,
            'can_review' => $assigned && $actor->hasRole('doctor') && (int) $version->actor_user_id !== $actor->id && $row->working_state === 'in_review'
                && $this->authority->grant($actor->id) !== null && $this->reviewable($version, $snapshot),
            'assigned_reviewer' => $row->assigned_reviewer_id === null ? null : $this->person((int) $row->assigned_reviewer_id),
            'contexts' => $contexts, 'versions' => $history->map(fn ($item) => ['id' => $item->public_id, 'version' => (int) $item->version, 'content_hash' => $item->content_hash, 'recorded_at' => $item->recorded_at])->all(),
            'reviews' => $reviews->map(fn ($review) => ['id' => $review->public_id, 'version' => (int) $review->rule_version,
                'outcome' => $review->outcome, 'reviewer' => $this->person((int) $review->reviewer_user_id), 'valid_until' => $review->valid_until,
                'withdrawable' => (int) $review->reviewer_user_id === $actor->id && $review->outcome === 'approved'
                    && DB::table('recommendation_rule_reviews')->where('supersedes_review_id', $review->id)->sharedLock()->first() === null,
                'assessment' => $review->assessment, 'recorded_at' => $review->recorded_at])->all()];
    }

    private function summary(User $actor, object $row): array
    {
        return ['id' => $row->public_id, 'slug' => $row->slug, 'state' => $row->retired_at === null ? $row->working_state : 'retired',
            'working_version' => (int) $row->working_version, 'author' => $this->person((int) $row->author_user_id),
            'staff' => $this->authority->staff($actor), 'assigned' => (int) $row->assigned_reviewer_id === $actor->id];
    }

    private function person(int $id): array
    {
        $row = User::query()->whereKey($id)->sharedLock()->firstOrFail();

        return ['id' => $row->public_id, 'name' => $row->name];
    }

    private function visible(User $actor, object $row): void
    {
        abort_unless($this->authority->staff($actor) || ($actor->hasRole('doctor') && (((int) $row->assigned_reviewer_id === $actor->id && $this->authority->grant($actor->id) !== null)
            || DB::table('recommendation_rule_reviews')->where('rule_id', $row->id)->where('reviewer_user_id', $actor->id)->sharedLock()->first() !== null)), 403);
    }

    public function media(Request $request, string $id, string $assetId): array
    {
        abort_if(array_diff(array_keys($request->query()), ['article_id', 'rule_version', 'language']), 422);
        $input = validator($request->query(), ['article_id' => 'required|string|ulid', 'rule_version' => 'required|integer|min:1|max:4294967295',
            'language' => 'required|in:en,fa'])->validate();

        return DB::transaction(function () use ($request, $id, $assetId, $input) {
            $this->authority->catalog();
            $actor = $this->authority->actor($request);
            $row = $this->row($id);
            $this->visible($actor, $row);
            $version = (int) $input['rule_version'];
            abort_unless($this->authority->staff($actor)
                || ((int) $row->working_version === $version && (int) $row->assigned_reviewer_id === $actor->id && $this->authority->grant($actor->id) !== null)
                || DB::table('recommendation_rule_reviews')->where('rule_id', $row->id)->where('rule_version', $version)->where('reviewer_user_id', $actor->id)->sharedLock()->first() !== null, 403);

            return $this->targets->media($this->content->snapshot($this->version($row, $version)), strtolower($input['article_id']), $assetId, $input['language']);
        });
    }

    private function row(string $id): object
    {
        $row = DB::table('recommendation_rules')->where('public_id', $id)->lockForUpdate()->first();
        abort_unless($row !== null, 404);

        return $row;
    }

    private function version(object $rule, int $number): object
    {
        $row = DB::table('recommendation_rule_versions')->where('rule_id', $rule->id)->where('version', $number)->sharedLock()->first();
        abort_unless($row !== null, 503);

        return $row;
    }

    public function preview(Request $request, string $id): array
    {
        abort_if(array_diff(array_keys($request->query()), ['case']), 422);
        $case = validator($request->query(), ['case' => 'required|in:missing,unknown,recent,stale'])->validate()['case'];
        // Reuse the full assigned/historical version boundary; no patient selector or projection is accepted.
        $view = $this->read($request->duplicate([]), $id);
        $instant = now('UTC')->toDateTimeImmutable();
        $outcome = (new RulePredicateEvaluator)->evaluate(RuleCondition::fromArray($view['working']['definition']),
            SyntheticRecommendationCases::projection($case, $instant), $instant);

        return ['rule_version_id' => $view['working']['id'], 'case' => $case, 'outcome' => $outcome->value];
    }

    private function revision(User $actor, object $state, ?string $id, string $action): string
    {
        return hash_hmac('sha256', json_encode([(int) $state->revision, DB::table('article_catalog_state')->where('id', 1)->value('revision'),
            $actor->public_id, $actor->getRawOriginal('updated_at'), $actor->roles->pluck('name')->sort()->values()->all(), $id, $action], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    private function expect(User $actor, object $state, ?string $id, string $action, array $input): void
    {
        abort_unless(hash_equals($this->revision($actor, $state, $id, $action), $input['expected_revision']), 409);
    }

    private function json(Request $request, array $required, array $optional = []): array
    {
        abort_unless($request->isJson() && strlen($request->getContent()) <= 65536 && $request->query() === [], 422);
        $input = json_decode($request->getContent(), true, 16);
        abort_unless(is_array($input) && ! array_is_list($input) && ! array_diff($required, array_keys($input))
            && ! array_diff(array_keys($input), [...$required, ...$optional]), 422);
        validator($input, ['expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/', 'action_key' => 'required|string|uuid'])->validate();

        return $input;
    }

    private function requestHash(array $input): string
    {
        return hash_hmac('sha256', $this->content->canonical($input), (string) config('app.key'));
    }

    private function replay(User $actor, string $action, array $input, ?string $subject): ?AuditEvent
    {
        $event = AuditEvent::query()->where('actor_user_id', $actor->id)->where('action', 'recommendation.'.$action)
            ->where('after->action_key', $input['action_key'])->lockForUpdate()->first();
        abort_if($event !== null && (! hash_equals($event->after['request_hash'] ?? '', $this->requestHash($input))
            || ($subject !== null && $subject !== $event->subject_public_id)), 409);

        return $event;
    }

    private function record(Request $request, User $actor, string $action, object $row, array $input, array $metadata): void
    {
        $this->audit->log($request, $actor, 'recommendation.'.$action, RecommendationRule::query()->findOrFail($row->id), 'high', null,
            ['id' => $row->public_id, ...$metadata, 'action_key' => $input['action_key'], 'request_hash' => $this->requestHash($input)],
            reason: 'Recommendation rule administration.');
        $this->authority->bump();
    }

    private function expiry(mixed $value): string
    {
        abort_unless(is_string($value) && preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}\z/', $value), 422);
        $time = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $value, new DateTimeZone('Asia/Tehran'));
        abort_unless($time !== false && $time->format('Y-m-d\TH:i') === $value && $time > now()->toDateTimeImmutable()
            && $time <= now()->addDays(3650)->toDateTimeImmutable(), 422);

        return $time->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
}
