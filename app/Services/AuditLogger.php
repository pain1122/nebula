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
        'admin.article_media.uploaded' => ['id', 'status', 'revision', 'checksum_sha256', 'mime_type', 'size_bytes'],
        'admin.article_media.validated' => ['id', 'status', 'revision', 'checksum_sha256', 'mime_type', 'size_bytes'],
        'admin.article_media.validation_failed' => ['id', 'status', 'revision', 'checksum_sha256', 'mime_type', 'size_bytes'],
        'admin.article_media.retired' => ['id', 'status', 'revision', 'checksum_sha256', 'mime_type', 'size_bytes'],
        'admin.article_schedule.armed' => ['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at'],
        'admin.article_schedule.rescheduled' => ['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at'],
        'admin.article_schedule.cancelled' => ['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at'],
        'admin.article_schedule.invalidated' => ['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at'],
        'admin.article_schedule.blocked' => ['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at'],
        'admin.article_schedule.published' => ['id', 'version', 'content_hash', 'publish_at', 'timezone', 'status', 'revision', 'blocker', 'finished_at'],
        'admin.article.submitted' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'archived'],
        'admin.article.reviewed' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'archived'],
        'admin.article.published' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'archived'],
        'admin.article.archived' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'archived'],
        'admin.article.version_copied' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'archived', 'source_version_id'],
        'admin.article.created' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'taxonomy_count', 'reference_count', 'source_count'],
        'admin.article.draft_saved' => ['id', 'version_id', 'slug', 'version', 'content_hash', 'working_state', 'published_version', 'taxonomy_count', 'reference_count', 'source_count'],
        'admin.article_term.created' => ['id', 'version_id', 'kind', 'slug', 'version', 'is_active', 'parent_id'],
        'admin.article_term.updated' => ['id', 'version_id', 'kind', 'slug', 'version', 'is_active', 'parent_id'],
        'admin.article_term.retired' => ['id', 'version_id', 'kind', 'slug', 'version', 'is_active', 'parent_id'],
        'patient.health.updated' => ['snapshot_id', 'version', 'schema_version', 'changed_count', 'observation_count'],
        'admin.hospital.created' => ['public_id', 'name', 'is_active'],
        'admin.hospital.updated' => ['public_id', 'name', 'is_active'],
        'admin.doctor.onboarded' => ['verified', 'specialty_id', 'fee', 'experience_years'],
        'doctor.location.added' => ['workplace_id', 'hospital_public_id', 'services'],
        'doctor.location.prices.updated' => ['workplace_id', 'services'],
        'profile.display_name.updated' => ['first_name', 'last_name'],
        'admin.profile.display_name.updated' => ['first_name', 'last_name'],
        'admin.user.created' => ['id', 'roles', 'first_name', 'last_name', 'patient_status'],
        'admin.user.updated' => ['id', 'roles', 'first_name', 'last_name', 'patient_status'],
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
        'reservation.cancelled' => ['status', 'cancelled_at'],
        'reservation.completed' => ['status', 'completed_at'],
        'reservation.rescheduled' => [
            'doctor_visit_slot_id',
            'doctor_workplace_id',
            'checkup_id',
            'starts_at',
            'ends_at',
            'duration_minutes',
            'price_snapshot',
            'currency_snapshot',
        ],
        'doctor.visit_slots.controlled' => [
            'scope',
            'date',
            'slot_public_ids',
            'slot_count',
            'active_count',
            'prices',
        ],
        'admin.visit_slots.controlled' => ['selection', 'slots'],
        'admin.payment.adjustment_requested' => ['payment_public_id', 'type', 'amount', 'currency', 'status'],
        'admin.checkup.created' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'description',
            'price',
            'currency',
            'default_duration_minutes',
            'is_active',
            'deleted_at',
        ],
        'admin.checkup.archived' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'description',
            'price',
            'currency',
            'default_duration_minutes',
            'is_active',
            'deleted_at',
        ],
        'admin.checkup.updated' => [
            'id',
            'checkup_category_id',
            'title',
            'slug',
            'description',
            'price',
            'currency',
            'default_duration_minutes',
            'is_active',
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
        'admin.checkup_category.created' => ['id', 'name', 'slug', 'description', 'is_active', 'deleted_at'],
        'admin.checkup_category.updated' => ['id', 'name', 'slug', 'description', 'is_active', 'deleted_at'],
        'admin.specialty.created' => ['id', 'name', 'slug', 'parent_id', 'level', 'is_active', 'deleted_at'],
        'admin.specialty.updated' => ['id', 'name', 'slug', 'parent_id', 'level', 'is_active', 'deleted_at'],
        'admin.specialty.archived' => ['id', 'name', 'slug', 'parent_id', 'level', 'is_active', 'deleted_at'],
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
        'settings.marketplace.updated' => ['setting_key', 'scope_type', 'scope_key', 'value', 'stored'],
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
            'content_policy_revision', 'content_validator',
            'scanner_engine', 'scanner_version', 'scanner_database_version', 'scanner_database_updated_at', 'scan_checksum_sha256',
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
        'reservation_medical_file.uploaded' => [
            'attachment_policy_revision',
            'effective_attachment_policy_revision',
            'file_public_id',
            'request_public_id',
            'reservation_public_id',
            'scan_status',
            'scanned_at',
            'retention_until',
            'archived_at',
        ],
        'reservation_medical_file.scan_recorded' => [
            'content_policy_revision', 'content_validator',
            'scanner_engine', 'scanner_version', 'scanner_database_version', 'scanner_database_updated_at', 'scan_checksum_sha256',
            'file_public_id',
            'request_public_id',
            'reservation_public_id',
            'scan_status',
            'scanned_at',
            'retention_until',
            'archived_at',
        ],
        'reservation_medical_file.accessed' => [
            'file_public_id',
            'request_public_id',
            'reservation_public_id',
            'scan_status',
            'scanned_at',
            'retention_until',
            'archived_at',
        ],
        'reservation_medical_file.archived' => [
            'file_public_id',
            'request_public_id',
            'reservation_public_id',
            'scan_status',
            'scanned_at',
            'retention_until',
            'archived_at',
        ],
        'reservation_medical_request.created' => [
            'attachment_policy_revision',
            'request_public_id',
            'reservation_public_id',
            'status',
            'due_at',
            'retention_until',
        ],
        'reservation_medical_request.review_started' => [
            'attachment_policy_revision',
            'request_public_id',
            'reservation_public_id',
            'status',
            'due_at',
            'reviewed_at',
            'closed_at',
            'retention_until',
        ],
        'reservation_report.draft_saved' => [
            'report_public_id',
            'request_public_id',
            'reservation_public_id',
            'status',
            'published_at',
            'supersedes_report_public_id',
            'request_status',
            'request_closed_at',
            'retention_until',
        ],
        'reservation_report.published' => [
            'report_public_id',
            'request_public_id',
            'reservation_public_id',
            'status',
            'published_at',
            'supersedes_report_public_id',
            'request_status',
            'request_closed_at',
            'retention_until',
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
