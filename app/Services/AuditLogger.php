<?php

namespace App\Services;

use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuditLogger
{
    /** @var array<string, list<string>> */
    private const SNAPSHOT_ALLOWLISTS = [
        'admin.user.created' => ['id', 'roles', 'email', 'patient_status'],
        'admin.user.updated' => ['id', 'roles', 'email', 'patient_status'],
        'admin.user.account_state.changed' => [
            'account_state',
            'account_state_changed_at',
            'account_state_changed_by',
            'closed_at',
        ],
        'admin.doctor.verification_changed' => ['verified', 'verified_at', 'verified_by'],
        'admin.questionnaire.created' => ['slug', 'status', 'version', 'published_at', 'deleted_at'],
        'admin.questionnaire.updated' => ['slug', 'status', 'version', 'published_at', 'deleted_at'],
        'admin.questionnaire.archived' => ['slug', 'status', 'version', 'published_at', 'deleted_at'],
        'admin.questionnaire_submission.archived' => ['questionnaire_public_id', 'deleted_at'],
        'admin.rating_option.created' => ['type', 'slug', 'active', 'sort_order', 'deleted_at'],
        'admin.rating_option.updated' => ['type', 'slug', 'active', 'sort_order', 'deleted_at'],
        'admin.rating_option.archived' => ['type', 'slug', 'active', 'sort_order', 'deleted_at'],
        'admin.reservation.status_overridden' => ['status', 'completed_at', 'cancelled_at', 'expired_at'],
        'admin.payment.adjustment_requested' => ['payment_public_id', 'type', 'amount', 'currency', 'status'],
        'admin.checkup.archived' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'description',
            'price',
            'deleted_at',
        ],
        'admin.checkup.updated' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'description',
            'price',
            'deleted_at',
        ],
        'admin.checkup.category_detached' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'price',
            'deleted_at',
        ],
        'admin.checkup.category_reassigned' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'price',
            'deleted_at',
        ],
        'admin.checkup_category.archived' => [
            'id',
            'name',
            'slug',
            'description',
            'deleted_at',
            'checkup_action',
            'replacement_category_id',
            'affected_checkup_count',
        ],
        'tenant.registry.updated' => [
            'display_name',
            'domain',
            'state',
            'plan_key',
            'subscription_status',
            'feature_set_version',
        ],
        'tenant.feature_override.set' => [
            'tenant_instance_public_id',
            'feature_key',
            'enabled',
            'expires_at',
        ],
        'settings.marketplace.updated' => ['setting_key', 'scope_type', 'scope_key', 'value'],
        'reservation_file.uploaded' => [
            'reservation_public_id',
            'classification',
            'scan_status',
            'mime_type',
            'size_bytes',
            'retention_until',
            'archived',
        ],
        'reservation_file.scan_recorded' => [
            'reservation_public_id',
            'classification',
            'scan_status',
            'mime_type',
            'size_bytes',
            'retention_until',
            'archived',
        ],
        'reservation_file.accessed' => ['scan_status'],
        'reservation_file.archived' => [
            'reservation_public_id',
            'classification',
            'scan_status',
            'mime_type',
            'size_bytes',
            'retention_until',
            'archived',
        ],
        'test.redaction' => ['email', 'phone', 'nested'],
    ];

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
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
            'before' => $this->sanitizeSnapshot($action, $before),
            'after' => $this->sanitizeSnapshot($action, $after),
            'route' => trim($request->method().' '.$request->getPathInfo()),
            'correlation_id' => (string) Str::uuid(),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $values
     * @return array<string, mixed>|null
     */
    private function sanitizeSnapshot(string $action, ?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        $allowedKeys = self::SNAPSHOT_ALLOWLISTS[$action] ?? [];
        $allowlisted = array_intersect_key($values, array_flip($allowedKeys));

        return $this->filterSensitive($allowlisted);
    }

    /**
     * @param  array<string, mixed>|null  $values
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
     * @param  list<string>  $blockedFragments
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
