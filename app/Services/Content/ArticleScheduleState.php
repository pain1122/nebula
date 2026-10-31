<?php

namespace App\Services\Content;

use App\Models\Article;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** All mutations run inside the caller's catalog/article transaction, including their audit. */
final class ArticleScheduleState
{
    public function __construct(private readonly AuditLogger $audit, private readonly ArticleSnapshots $snapshots) {}

    public function requireSchema(): void
    {
        foreach (['article_catalog_state', 'articles', 'article_versions', 'article_version_terms', 'article_terms',
            'article_term_versions', 'article_publication_schedules', 'article_media_assets', 'article_version_media'] as $table) {
            abort_unless(Schema::hasTable($table), 503);
        }
        abort_unless(Schema::hasColumn('article_versions', 'presentation'), 503);
    }

    public function resource(?object $row): ?array
    {
        if ($row === null) {
            return null;
        }
        $this->snapshots->require(in_array($row->status, ['armed', 'cancelled', 'blocked', 'published'], true)
            && (int) $row->revision > 0 && (int) $row->version > 0
            && preg_match('/\A[a-f0-9]{64}\z/', $row->content_hash) === 1
            && $row->timezone === ArticlePublicationTime::TIMEZONE);

        $article = DB::table('articles')->find($row->article_id, ['public_id']);
        $this->snapshots->require($article !== null);

        return ['id' => $this->snapshots->publicId($row->public_id), 'article_id' => $this->snapshots->publicId($article->public_id), 'version' => (int) $row->version,
            'content_hash' => $row->content_hash, 'publish_at' => $row->publish_at, 'timezone' => $row->timezone,
            'status' => $row->status, 'revision' => (int) $row->revision, 'blocker' => $row->blocker,
            'finished_at' => $row->finished_at, 'actor' => $this->snapshots->actor((int) $row->actor_user_id)];
    }

    public function invalidate(Request $request, User $actor, object $article, string $blocker): void
    {
        // Existing deployments have only the original six tables. Never require this migration for old authoring.
        if (! Schema::hasTable('article_publication_schedules')) {
            return;
        }
        $row = DB::table('article_publication_schedules')->where('article_id', $article->id)->lockForUpdate()->first();
        if ($row === null || $row->status !== 'armed') {
            return;
        }
        $this->finish($request, $actor, $article, $row, 'cancelled', $blocker, 'invalidated');
    }

    public function finish(Request $request, User $actor, object $article, object $schedule, string $status,
        ?string $blocker, string $action, ?string $reason = null): void
    {
        $before = $this->resource($schedule);
        $this->snapshots->require((int) $schedule->revision < 9007199254740991);
        DB::table('article_publication_schedules')->where('id', $schedule->id)->update([
            'status' => $status, 'blocker' => $blocker, 'revision' => (int) $schedule->revision + 1,
            'finished_at' => now('UTC'), 'updated_at' => now('UTC'),
        ]);
        $this->record($request, $actor, $article, $action, $before,
            $this->resource(DB::table('article_publication_schedules')->find($schedule->id)), $reason);
    }

    public function record(Request $request, User $actor, object $article, string $action, ?array $before,
        array $after, ?string $reason = null): void
    {
        $subject = new Article;
        $subject->setRawAttributes((array) $article, true);
        $subject->exists = true;
        // No body, private health, storage identity or raw validation evidence enters these snapshots.
        $safe = fn (?array $resource) => $resource === null ? null : array_intersect_key($resource,
            array_flip(['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at']));
        $this->audit->log($request, $actor, 'admin.article_schedule.'.$action, $subject, 'high',
            $safe($before), $safe($after), reason: $reason);
    }
}
