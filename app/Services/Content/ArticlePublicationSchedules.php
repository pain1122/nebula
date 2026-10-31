<?php

namespace App\Services\Content;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Password-confirmed authorization of an exact, already reviewed immutable version. */
final class ArticlePublicationSchedules
{
    public function __construct(private readonly ArticleContent $content, private readonly ArticleSnapshots $snapshots,
        private readonly ArticleAdministrationRead $reader, private readonly ArticleEditorial $editorial,
        private readonly ArticleScheduleState $state, private readonly ArticlePublicationTime $time) {}

    public function context(Request $request, string $id): array
    {
        $input = $request->query();
        abort_if(array_diff(array_keys($input), ['action']) !== [], 422);
        $action = validator($input, ['action' => 'required|in:arm,cancel'])->validate()['action'];

        return DB::transaction(function () use ($request, $id, $action) {
            [$catalog, $actor, $article, $current, $schedule] = $this->locked($request, $id);
            $blockers = $this->blockers($article, $current, $schedule, $action);

            return ['action' => $action, 'current' => $current, 'schedule' => $this->state->resource($schedule),
                'eligible' => $blockers === [], 'blockers' => $blockers,
                'timezone' => ArticlePublicationTime::TIMEZONE, 'runner_available' => ArticleDuePublisher::available(),
                'revision' => $this->revision($catalog, $actor, $current, $schedule, $action)];
        });
    }

    public function act(Request $request, string $id, bool $fromComposer = false): array
    {
        abort_if($fromComposer && DB::transactionLevel() < 1, 503);
        abort_if($request->query(), 422);
        abort_unless($request->isJson() && strlen($request->getContent()) <= 16384, 422);
        $input = json_decode($request->getContent(), true, 12);
        abort_unless(is_array($input) && ! array_is_list($input), 422);
        $rules = ['action' => 'required|in:arm,cancel', 'expected_revision' => 'required|string|regex:/\A[a-f0-9]{64}\z/',
            'expected_version' => 'required|integer|min:1|max:4294967295', 'expected_hash' => 'required|string|regex:/\A[a-f0-9]{64}\z/',
            'reason' => 'required|string|max:1000', 'confirmed' => 'required|accepted'];
        abort_if(array_diff(array_keys($input), array_keys($rules)) !== [], 422);
        $data = validator($input, $rules)->validate();
        $reason = $data['reason'];
        abort_unless(mb_check_encoding($reason, 'UTF-8') && ! preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $reason)
            && preg_match('/[^\s\p{Z}\p{Cf}]/u', $reason), 422);

        return DB::transaction(function () use ($request, $id, $data, $reason, $fromComposer) {
            [$catalog, $actor, $article, $current, $schedule] = $this->locked($request, $id);
            $confirmed = $request->hasSession() ? (int) $request->session()->get('auth.password_confirmed_at', 0) : 0;
            if (! $fromComposer) {
                abort_unless($confirmed > 0 && $confirmed + (int) config('auth.high_authority_password_timeout', 900) >= time(), 423);
            }
            abort_unless(hash_equals($this->revision($catalog, $actor, $current, $schedule, $data['action']), $data['expected_revision'])
                && (int) $data['expected_version'] === $current['working']['version']
                && hash_equals($current['working']['content_hash'], $data['expected_hash']), 409);
            abort_unless($this->blockers($article, $current, $schedule, $data['action']) === [], 409);
            if ($data['action'] === 'cancel') {
                $this->state->finish($request, $actor, $article, $schedule, 'cancelled', 'staff_cancelled', 'cancelled', trim($reason));
            } else {
                $preference = $current['working']['presentation']['publication'];
                $values = ['article_id' => $article->id, 'version' => $current['working']['version'],
                    'content_hash' => $current['working']['content_hash'], 'publish_at' => (new \DateTimeImmutable($preference['publish_at']))->format('Y-m-d H:i:s'),
                    'timezone' => $preference['timezone'], 'actor_user_id' => $actor->id, 'status' => 'armed',
                    'revision' => $schedule === null ? 1 : (int) $schedule->revision + 1, 'blocker' => null,
                    'finished_at' => null, 'updated_at' => now('UTC')];
                $this->snapshots->require($values['revision'] <= 9007199254740991);
                if ($schedule === null) {
                    DB::table('article_publication_schedules')->insert($values + ['public_id' => strtolower((string) Str::ulid()), 'created_at' => now('UTC')]);
                } else {
                    DB::table('article_publication_schedules')->where('id', $schedule->id)->update($values);
                }
                $after = DB::table('article_publication_schedules')->where('article_id', $article->id)->first();
                $this->state->record($request, $actor, $article, $schedule === null ? 'armed' : 'rescheduled',
                    $this->state->resource($schedule), $this->state->resource($after), trim($reason));
            }
            $this->snapshots->require((int) $catalog->revision < 9007199254740991);
            DB::table('article_catalog_state')->where('id', 1)->update(['revision' => (int) $catalog->revision + 1, 'updated_at' => now('UTC')]);

            return ['schedule' => $this->state->resource(DB::table('article_publication_schedules')->where('article_id', $article->id)->first())];
        });
    }

    private function locked(Request $request, string $id): array
    {
        $this->state->requireSchema();
        $catalog = DB::table('article_catalog_state')->where('id', 1)->lockForUpdate()->first();
        $this->snapshots->require($catalog !== null && (int) $catalog->revision >= 0 && DB::table('article_catalog_state')->count() === 1);
        $actor = User::query()->whereKey($request->user()->getAuthIdentifier())->lockForUpdate()->first();
        abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
        $actor->setRelation('roles', $actor->roles()->sharedLock()->get());
        abort_unless($actor->canAccessAdminPanel(), 403);
        $article = DB::table('articles')->where('public_id', strtolower($id))->lockForUpdate()->first();
        abort_unless($article !== null, 404);
        $plain = Request::create('/api/admin/articles/'.$article->public_id, 'GET');
        $plain->setUserResolver(fn () => $actor);
        $current = $this->reader->read($plain, 'article', $article->public_id)['data'];
        $schedule = DB::table('article_publication_schedules')->where('article_id', $article->id)->lockForUpdate()->first();

        return [$catalog, $actor, $article, $current, $schedule];
    }

    private function blockers(object $article, array $current, ?object $schedule, string $action): array
    {
        if ($action === 'cancel') {
            return $schedule !== null && $schedule->status === 'armed' ? [] : ['not_armed'];
        }
        $blockers = $this->editorial->blockers($article, $current, null, 'publish');
        if (! ArticleDuePublisher::available()) {
            $blockers[] = 'publisher_unavailable';
        }
        if ($schedule !== null && $schedule->status === 'armed') {
            $blockers[] = 'already_armed';
        }
        if (! ArticleDuePublisher::authorizedReviewer($article)) {
            $blockers[] = 'reviewer_authority_revoked';
        }
        try {
            $preference = $current['working']['presentation']['publication'] ?? null;
            $this->time->forSchedule($preference === null ? null : array_intersect_key($preference, array_flip(['local_time', 'timezone'])), now('UTC'));
        } catch (\InvalidArgumentException) {
            $blockers[] = 'invalid_publication_time';
        }

        return array_values(array_unique($blockers));
    }

    private function revision(object $catalog, User $actor, array $current, ?object $schedule, string $action): string
    {
        $key = config('app.key');
        $this->snapshots->require(is_string($key) && $key !== '');
        $resource = json_decode(json_encode([$current, $this->state->resource($schedule)], JSON_THROW_ON_ERROR), true, 32, JSON_THROW_ON_ERROR);

        return hash_hmac('sha256', $this->content->hash(['purpose' => 'article-schedule-v1', 'action' => $action,
            'catalog' => (int) $catalog->revision, 'resources' => $resource,
            'actor' => [$actor->public_id, $actor->getRawOriginal('updated_at'), $actor->roles->pluck('name')->sort()->values()->all()]]), $key);
    }
}
