<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\QuestionnaireSubmission;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Shared self/support presentation. Deliberately never serializes a clinical model. */
class PanelProfileService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function authorize(User $actor, User $subject, bool $support): void
    {
        $actor->loadMissing('roles');
        $subject->loadMissing('roles');
        if (! $support) {
            abort_unless($actor->is($subject), 403);

            return;
        }
        abort_unless($actor->canAccessAdminPanel(), 403);
        abort_if($subject->isRootAdmin(), 403);
        abort_if($subject->hasRole(UserRole::Admin->value) && ! $actor->isRootAdmin(), 403);
    }

    public function revision(User $subject): string
    {
        $subject->loadMissing('roles');

        return hash_hmac('sha256', json_encode([
            $subject->public_id, $subject->getRawOriginal('updated_at'),
            $subject->first_name, $subject->last_name,
            $subject->roles->pluck('name')->sort()->values()->all(),
            $subject->account_state?->value,
            AuditEvent::query()->where('subject_type', User::class)->where('subject_id', $subject->id)->max('id'),
        ], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    private function reservations(User $subject): Builder
    {
        return Reservation::query()->where(function (Builder $query) use ($subject): void {
            $query->where('user_id', $subject->id);
            if ($subject->hasRole(UserRole::Doctor->value)) {
                $query->orWhereHas('doctor', fn (Builder $doctor) => $doctor->where('user_id', $subject->id));
            }
        });
    }

    /** @return array<string, mixed> */
    public function read(User $actor, User $subject, bool $support): array
    {
        $this->authorize($actor, $subject, $support);
        $reservations = $this->reservations($subject);
        $requests = ReservationMedicalRequest::query()->whereIn('reservation_id', (clone $reservations)->select('id'));
        $reports = ReservationReport::query()->where('status', 'published')
            ->where(function (Builder $query): void {
                $query->whereNull('retention_until')->orWhere('retention_until', '>', now());
            })->whereIn('reservation_id', (clone $reservations)->select('id'));
        $submissions = QuestionnaireSubmission::query()->where('user_id', $subject->id);

        return [
            'user' => [
                'id' => $subject->id, 'public_id' => (string) $subject->public_id,
                'name' => $subject->name, 'first_name' => $subject->first_name,
                'last_name' => $subject->last_name, 'role' => $subject->roles->pluck('name')->first(),
                'doctor_profile_id' => $subject->hasRole(UserRole::Doctor->value) ? $subject->doctorProfile?->id : null,
                'account_state' => $subject->account_state?->value,
                'created_at' => $subject->created_at?->toISOString(),
            ],
            'mode' => $support ? 'support' : 'self',
            'revision' => $this->revision($subject),
            'editable_fields' => ['first_name', 'last_name'],
            'summary' => [
                'reservations' => (clone $reservations)->count(),
                'upcoming' => (clone $reservations)->where('status', 'confirmed')->where('starts_at', '>', now())->count(),
                'completed' => (clone $reservations)->where('status', 'completed')->count(),
                'medical_requests' => (clone $requests)->count(),
                'published_reports' => (clone $reports)->count(),
                'questionnaire_submissions' => (clone $submissions)->count(),
            ],
            'reservations' => (clone $reservations)->orderByDesc('starts_at')->orderByDesc('id')->limit(10)
                ->get(['public_id', 'status', 'starts_at', 'ends_at', 'timezone'])->map(fn ($row) => [
                    'public_id' => (string) $row->public_id, 'status' => $row->status->value,
                    'starts_at' => $row->starts_at?->toISOString(), 'ends_at' => $row->ends_at?->toISOString(),
                    'timezone' => $row->timezone,
                ])->all(),
            'requests' => (clone $requests)->orderByDesc('created_at')->orderByDesc('id')->limit(10)
                ->get(['public_id', 'status', 'created_at', 'closed_at'])->map(fn ($row) => [
                    'public_id' => (string) $row->public_id, 'status' => $row->status->value,
                    'created_at' => $row->created_at?->toISOString(), 'closed_at' => $row->closed_at?->toISOString(),
                ])->all(),
            'reports' => (clone $reports)->orderByDesc('published_at')->orderByDesc('id')->limit(10)
                ->get(['public_id', 'status', 'published_at', 'supersedes_report_id'])->map(fn ($row) => [
                    'public_id' => (string) $row->public_id, 'status' => $row->status->value,
                    'published_at' => $row->published_at?->toISOString(), 'is_amendment' => $row->supersedes_report_id !== null,
                ])->all(),
            'submissions' => (clone $submissions)->orderByDesc('created_at')->orderByDesc('id')->limit(10)
                ->get(['public_id', 'created_at'])->map(fn ($row) => [
                    'public_id' => (string) $row->public_id, 'status' => 'submitted', 'created_at' => $row->created_at?->toISOString(),
                ])->all(),
            // No audit reason, payload, route, IP, session details or other user's identity.
            'activity' => AuditEvent::query()->where('actor_user_id', $subject->id)
                ->whereIn('action', [
                    'reservation.cancelled', 'reservation.completed', 'reservation.rescheduled',
                    'reservation_file.uploaded', 'reservation_medical_file.uploaded', 'reservation_report.published',
                    'profile.display_name.updated', 'admin.profile.display_name.updated',
                ])->orderByDesc('created_at')->orderByDesc('id')->limit(10)
                ->get(['public_id', 'action', 'created_at'])->map(fn ($row) => [
                    'public_id' => (string) $row->public_id,
                    // Preserve the public attachment category for older profile clients.
                    'action' => $row->action === 'reservation_medical_file.uploaded' ? 'reservation_file.uploaded' : $row->action,
                    'created_at' => $row->created_at?->toISOString(),
                ])->all(),
        ];
    }

    /** @param array{first_name:string,last_name:string,reason:string,expected_revision:string} $data */
    public function update(Request $request, User $actor, User $subject, bool $support, array $data): User
    {
        $this->authorize($actor, $subject, $support);

        return DB::transaction(function () use ($request, $actor, $subject, $support, $data): User {
            $lockedActor = User::query()->lockForUpdate()->findOrFail($actor->id);
            $lockedSubject = User::query()->lockForUpdate()->findOrFail($subject->id);
            abort_unless($lockedActor->permitsAuthentication(), 403);
            $this->authorize($lockedActor, $lockedSubject, $support);
            if (! hash_equals($this->revision($lockedSubject), $data['expected_revision'])) {
                abort(409, 'The profile changed. Refresh before editing.');
            }
            $reason = trim($data['reason']);
            if ($reason === '' || trim($data['first_name']) === '' || trim($data['last_name']) === '') {
                throw ValidationException::withMessages(['profile' => 'Display names and a reason are required.']);
            }
            $before = $lockedSubject->only(['first_name', 'last_name']);
            $lockedSubject->first_name = trim($data['first_name']);
            $lockedSubject->last_name = trim($data['last_name']);
            $lockedSubject->name = $lockedSubject->first_name.' '.$lockedSubject->last_name;
            if (! $lockedSubject->isDirty(['first_name', 'last_name', 'name'])) {
                throw ValidationException::withMessages(['profile' => 'The display name has not changed.']);
            }
            $lockedSubject->save();
            $this->auditLogger->log(
                request: $request, actor: $lockedActor,
                action: $support ? 'admin.profile.display_name.updated' : 'profile.display_name.updated',
                subject: $lockedSubject, riskLevel: 'high', before: $before,
                after: $lockedSubject->only(['first_name', 'last_name']), reason: $reason,
            );

            return $lockedSubject->fresh()->load('roles');
        });
    }
}
