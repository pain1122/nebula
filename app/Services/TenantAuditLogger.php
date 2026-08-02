<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TenantAuditLogger
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function log(
        Request $request,
        int $actorId,
        string $action,
        string $subjectType,
        ?int $subjectId,
        ?string $subjectPublicId,
        string $riskLevel,
        ?array $before,
        ?array $after,
        string $reason,
    ): void {
        $actorName = DB::connection('tenant')->table('users')->where('id', $actorId)->value('name');

        DB::connection('tenant')->table('audit_events')->insert([
            'public_id' => (string) Str::ulid(),
            'actor_user_id' => $actorId,
            'actor_name_snapshot' => $actorName,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'subject_public_id' => $subjectPublicId,
            'risk_level' => $riskLevel,
            'reason' => $reason,
            'outcome' => 'succeeded',
            'before' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR),
            'after' => $after === null ? null : json_encode($after, JSON_THROW_ON_ERROR),
            'correlation_id' => (string) Str::uuid(),
            'route' => trim($request->method().' '.$request->getPathInfo()),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);
    }
}
