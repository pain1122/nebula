<?php

namespace App\Services\Recommendations;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class RecommendationAuthority
{
    public function enabled(): void
    {
        abort_unless(config('recommendations.authoring_enabled') === true && config('article_content.enabled') === true, 503);
        foreach (['recommendation_catalog_state', 'recommendation_rules', 'recommendation_rule_versions',
            'recommendation_rule_version_targets', 'recommendation_rule_reviews', 'recommendation_reviewer_grants'] as $table) {
            abort_unless(Schema::hasTable($table), 503);
        }
    }

    /** Consistent cross-module order: both catalogs, then actor/subject rows. */
    public function catalog(bool $write = false): object
    {
        $this->enabled();
        $query = DB::table('recommendation_catalog_state')->where('id', 1);
        $row = ($write ? $query->lockForUpdate() : $query->sharedLock())->first();
        abort_unless($row !== null && DB::table('recommendation_catalog_state')->count() === 1, 503);
        abort_unless(DB::table('article_catalog_state')->where('id', 1)->sharedLock()->first() !== null, 503);

        return $row;
    }

    public function actor(Request $request, bool $exclusive = false): User
    {
        $id = $request->user()?->getAuthIdentifier();
        abort_unless($id !== null, 401);
        $query = User::query()->whereKey($id);
        // Staff/reviewer reads must not each hold X on their own user then wait on
        // the other's attribution row. Catalog serialization owns rule writes.
        $actor = ($exclusive ? $query->lockForUpdate() : $query->sharedLock())->first();
        abort_unless($actor !== null && $actor->permitsAuthentication(), 403);
        $actor->setRelation('roles', $actor->roles()->sharedLock()->get());

        return $actor;
    }

    public function staff(User $actor): bool
    {
        return $actor->hasAnyRole(['admin', 'root-admin']);
    }

    public function grant(int $userId, ?int $grantId = null): ?object
    {
        $doctor = User::query()->whereKey($userId)->sharedLock()->first();
        if (! $doctor || ! $doctor->permitsAuthentication()) {
            return null;
        }
        $doctor->setRelation('roles', $doctor->roles()->sharedLock()->get());
        if (! $doctor->hasRole('doctor') || DB::table('doctor_profiles')->where('user_id', $userId)->where('verified', true)->whereNull('deleted_at')->sharedLock()->first(['id']) === null) {
            return null;
        }

        return DB::table('recommendation_reviewer_grants')->where('user_id', $userId)->where('scope', 'article')
            ->when($grantId !== null, fn ($query) => $query->where('id', $grantId))->whereNull('revoked_at')
            ->where('valid_from', '<=', now())->where('valid_until', '>', now())->orderByDesc('id')->sharedLock()->first();
    }

    public function bump(): void
    {
        $row = DB::table('recommendation_catalog_state')->where('id', 1)->lockForUpdate()->first();
        abort_unless($row !== null && (int) $row->revision < 9007199254740991, 503);
        DB::table('recommendation_catalog_state')->where('id', 1)->update(['revision' => (int) $row->revision + 1, 'updated_at' => now()]);
    }
}
