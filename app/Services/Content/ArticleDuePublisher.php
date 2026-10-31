<?php

namespace App\Services\Content;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use UnexpectedValueException;

/** Bounded article-only delivery. No queue, general scheduler, file scan or implicit authority. */
final class ArticleDuePublisher
{
    private const HEARTBEAT = 'article-publisher:last-successful-tick:v1';

    public function __construct(private readonly ArticleScheduleState $state, private readonly ArticleSnapshots $snapshots,
        private readonly ArticleAdministrationRead $reader, private readonly ArticleEditorial $editorial) {}

    public static function available(): bool
    {
        if (config('article_content.enabled') !== true || config('article_content.scheduling_enabled') !== true
            || config('article_content.publisher_enabled') !== true) {
            return false;
        }
        $last = Cache::get(self::HEARTBEAT);

        return is_int($last) && $last <= now('UTC')->timestamp && $last >= now('UTC')->timestamp - 120;
    }

    public static function authorizedReviewer(object $article): bool
    {
        return $article->reviewed_by_user_id !== null && self::authority((int) $article->reviewed_by_user_id)?->canAccessAdminPanel() === true;
    }

    private static function authority(int $id): ?User
    {
        $actor = User::query()->whereKey($id)->lockForUpdate()->first();
        if ($actor === null || ! $actor->permitsAuthentication()) {
            return null;
        }
        $actor->setRelation('roles', $actor->roles()->sharedLock()->get());

        return $actor;
    }

    public function tick(int $limit = 20): array
    {
        abort_unless(config('article_content.enabled') === true && config('article_content.scheduling_enabled') === true
            && config('article_content.publisher_enabled') === true, 503);
        abort_unless($limit >= 1 && $limit <= 50, 422);
        $this->state->requireSchema();
        $ids = DB::table('article_publication_schedules')->where('status', 'armed')
            ->where('publish_at', '<=', now('UTC')->format('Y-m-d H:i:s'))->orderBy('publish_at')->orderBy('id')->limit($limit)->pluck('id');
        $result = ['published' => 0, 'blocked' => 0, 'skipped' => 0];
        foreach ($ids as $id) {
            $outcome = $this->publish((int) $id);
            $result[$outcome]++;
        }
        // Advertise availability only after an entire successful bounded tick, with a short expiry.
        abort_unless(Cache::put(self::HEARTBEAT, now('UTC')->timestamp, 120) === true, 503);

        return $result;
    }

    private function publish(int $id): string
    {
        return DB::transaction(function () use ($id) {
            $catalog = DB::table('article_catalog_state')->where('id', 1)->lockForUpdate()->first();
            $this->snapshots->require($catalog !== null && (int) $catalog->revision >= 0 && DB::table('article_catalog_state')->count() === 1);
            $candidate = DB::table('article_publication_schedules')->find($id);
            if ($candidate === null) {
                return 'skipped';
            }
            $actor = self::authority((int) $candidate->actor_user_id);
            $article = DB::table('articles')->where('id', $candidate->article_id)->lockForUpdate()->first();
            $schedule = DB::table('article_publication_schedules')->where('id', $id)->lockForUpdate()->first();
            $this->snapshots->require($article !== null && $schedule !== null);
            if ($schedule->status !== 'armed' || $schedule->publish_at > now('UTC')->format('Y-m-d H:i:s')) {
                return 'skipped';
            }
            $auditActor = $actor ?? User::query()->find($schedule->actor_user_id);
            $this->snapshots->require($auditActor !== null);
            $request = Request::create('/internal/articles/publish-due', 'POST');
            $request->setUserResolver(fn () => $auditActor);
            $blocker = null;
            if ($actor === null || ! $actor->canAccessAdminPanel()) {
                $blocker = 'scheduling_authority_revoked';
            } elseif (! self::authorizedReviewer($article)) {
                $blocker = 'reviewer_authority_revoked';
            } else {
                try {
                    $plain = Request::create('/api/admin/articles/'.$article->public_id, 'GET');
                    $plain->setUserResolver(fn () => $actor);
                    $current = $this->reader->read($plain, 'article', $article->public_id)['data'];
                    $preference = $current['working']['presentation']['publication'] ?? null;
                    if ($current['working']['version'] !== (int) $schedule->version
                        || ! hash_equals($current['working']['content_hash'], $schedule->content_hash)
                        || $preference === null || $preference['timezone'] !== $schedule->timezone
                        || (new \DateTimeImmutable($preference['publish_at']))->format('Y-m-d H:i:s') !== $schedule->publish_at) {
                        $blocker = 'version_binding_changed';
                    } else {
                        $blocker = $this->editorial->blockers($article, $current, null, 'publish')[0] ?? null;
                    }
                } catch (UnexpectedValueException) {
                    $blocker = 'content_integrity_unavailable';
                }
            }
            $this->snapshots->require((int) $catalog->revision < 9007199254740991);
            if ($blocker === null) {
                DB::table('articles')->where('id', $article->id)->update(['working_state' => 'published',
                    'published_version' => (int) $schedule->version, 'updated_at' => now('UTC')]);
            }
            $outcome = $blocker === null ? 'published' : 'blocked';
            $this->state->finish($request, $auditActor, $article, $schedule, $outcome, $blocker, $outcome);
            DB::table('article_catalog_state')->where('id', 1)->update(['revision' => (int) $catalog->revision + 1, 'updated_at' => now('UTC')]);

            return $outcome;
        });
    }
}
