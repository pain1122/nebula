<?php

namespace App\Services;

use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuditLogger
{
    /**
     * @param array<string, mixed>|null $before
     * @param array<string, mixed>|null $after
     */
    public function log(
        Request $request,
        ?User $actor,
        string $action,
        Model $subject,
        string $riskLevel,
        ?array $before,
        ?array $after,
        ?string $batchId = null,
        ?string $reason = null,
        string $outcome = 'succeeded',
    ): AuditEvent {
        return AuditEvent::create([
            'batch_id' => $batchId,
            'actor_user_id' => $actor?->id,
            'actor_public_id' => $actor?->public_id,
            'actor_name_snapshot' => $actor?->name,
            'action' => $action,
            'subject_type' => get_class($subject),
            'subject_id' => $subject->getKey(),
            'subject_public_id' => $subject->getAttribute('public_id'),
            'risk_level' => $riskLevel,
            'reason' => $reason,
            'outcome' => $outcome,
            'before' => $this->filterSensitive($before),
            'after' => $this->filterSensitive($after),
            'route' => trim($request->method().' '.$request->getPathInfo()),
            'correlation_id' => (string) Str::uuid(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    /**
     * @param array<string, mixed>|null $values
     * @return array<string, mixed>|null
     */
    private function filterSensitive(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        $blockedFragments = [
            'password',
            'secret',
            'token',
            'session',
            'authorization',
            'cookie',
            'phone',
            'nid',
            'national_id',
            'birth_date',
            'address',
            'zip_code',
            'bio',
            'allerg',
            'chronic_disease',
            'answers_json',
            'medical',
            'diagnosis',
            'disk',
            'path',
        ];

        $filtered = [];

        foreach ($values as $key => $value) {
            $normalizedKey = strtolower((string) $key);

            if ($this->containsBlockedFragment($normalizedKey, $blockedFragments)) {
                continue;
            }

            $filtered[$key] = is_array($value)
                ? $this->filterSensitive($value)
                : $value;
        }

        return $filtered;
    }

    /**
     * @param list<string> $blockedFragments
     */
    private function containsBlockedFragment(string $key, array $blockedFragments): bool
    {
        foreach ($blockedFragments as $fragment) {
            if (str_contains($key, $fragment)) {
                return true;
            }
        }

        return false;
    }
}
