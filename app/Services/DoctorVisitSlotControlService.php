<?php

namespace App\Services;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Reservation;
use App\Models\ReservationScheduleChange;
use App\Models\User;
use App\Support\ScheduleControlConflict;
use Carbon\Carbon;
use DomainException;
use Illuminate\Database\DeadlockException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use PDOException;

class DoctorVisitSlotControlService
{
    private const MAX_TARGETS = 250;

    public function __construct(private readonly AuditLogger $auditLogger) {}

    /**
     * @return Collection<int, DoctorVisitSlot>
     */
    public function change(
        Request $request,
        User $actor,
        DoctorWorkplace $workplace,
        Checkup $checkup,
        string $scope,
        Carbon $localDate,
        ?DoctorVisitSlot $slot,
        ?bool $isActive,
        ?int $price,
        string $reason,
    ): Collection {
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A schedule-control reason is required.');
        }

        if ($isActive === null && $price === null) {
            throw new InvalidArgumentException('At least one of is_active or price is required.');
        }

        if (! in_array($scope, ['slot', 'day', 'week'], true)) {
            throw new InvalidArgumentException('Invalid visit-slot control scope.');
        }

        if ($price !== null && $price < 0) {
            throw new InvalidArgumentException('Visit-slot price cannot be negative.');
        }

        try {
            return DB::transaction(function () use (
                $request,
                $actor,
                $workplace,
                $checkup,
                $scope,
                $localDate,
                $slot,
                $isActive,
                $price,
                $reason,
            ): Collection {
                // Read only enough context to select candidates. All authority,
                // eligibility and timezone facts are checked again under locks.
                $context = DoctorWorkplace::query()->findOrFail($workplace->getKey());
                $timezone = $context->hospital()->value('timezone') ?? config('app.timezone');
                $query = DoctorVisitSlot::query()
                    ->where('doctor_workplace_id', $context->getKey())
                    ->where('checkup_id', $checkup->getKey());
                $date = Carbon::createFromFormat('!Y-m-d', $localDate->toDateString(), $timezone);
                if ($scope === 'slot') {
                    if ($slot === null) {
                        throw new InvalidArgumentException('A slot is required for slot scope.');
                    }
                    $query->where('public_id', $slot->public_id);
                } else {
                    $from = $scope === 'week' ? $date->copy()->startOfWeek(Carbon::MONDAY) : $date->copy();
                    $until = $from->copy()->addDays($scope === 'week' ? 7 : 1)->startOfDay();
                    $query->where('starts_at', '>=', $from->utc())->where('starts_at', '<', $until->utc());
                }
                // Match booking/admin ordering; never hold the workplace while
                // waiting for one of its slots. Do not filter via locking subqueries.
                $candidates = $query->orderBy('id')->limit(self::MAX_TARGETS + 1)->lockForUpdate()->get();
                if ($candidates->count() > self::MAX_TARGETS) {
                    throw new DomainException('Selection exceeds 250 visit slots. Choose a smaller scope.');
                }
                $lockedWorkplace = DoctorWorkplace::query()
                    ->whereKey($workplace->getKey())
                    ->lockForUpdate()
                    ->firstOrFail();
                $doctor = DoctorProfile::query()->lockForUpdate()->find($lockedWorkplace->doctor_profile_id);
                $service = Checkup::query()->lockForUpdate()->find($checkup->getKey());
                $hospital = MarketplaceHospital::query()->lockForUpdate()->find($lockedWorkplace->marketplace_hospital_id);
                // Actor/user locks follow resource locks, matching admin's doctor-
                // owner locks and avoiding a new user -> slot inversion.
                $currentActor = User::query()->lockForUpdate()->find($actor->getKey());
                if ($currentActor) {
                    DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $currentActor->id)->orderBy('role_id')->lockForUpdate()->get();
                    $currentActor->setRelation('roles', $currentActor->roles()->lockForUpdate()->get());
                }
                if (! $currentActor || ! $currentActor->permitsAuthentication() || ! $currentActor->hasRole('doctor')
                    || ! $doctor || $doctor->user_id !== $currentActor->getKey()) {
                    throw new DomainException('The schedule does not belong to this doctor.');
                }

                if (! $lockedWorkplace->is_active || $lockedWorkplace->archived_at
                    || ! $hospital || ! $hospital->is_active || $hospital->archived_at) {
                    throw new DomainException('The workplace is not active.');
                }
                if (($hospital->timezone ?? config('app.timezone')) !== $timezone
                    || $lockedWorkplace->doctor_profile_id !== $context->doctor_profile_id
                    || $lockedWorkplace->marketplace_hospital_id !== $context->marketplace_hospital_id) {
                    throw new ScheduleControlConflict;
                }
                $offering = DB::table('doctor_workplace_checkup')->where('doctor_workplace_id', $lockedWorkplace->id)
                    ->where('checkup_id', $checkup->id)->lockForUpdate()->first();
                if (! $service || ! $service->is_active || ! $offering || ! $offering->is_active) {
                    throw new DomainException('The workplace service is not active.');
                }
                $rules = DoctorWorkingWindow::query()->whereIn('id', $candidates->pluck('doctor_working_window_id'))
                    ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
                $targets = $candidates->filter(function (DoctorVisitSlot $target) use ($rules, $lockedWorkplace, $service, $doctor): bool {
                    $rule = $rules->get($target->doctor_working_window_id);
                    if (! $target->starts_at->isFuture() || ! $target->ends_at->greaterThan($target->starts_at) || ! $rule || ! $rule->is_active
                        || $rule->doctor_workplace_id !== $lockedWorkplace->id || $rule->checkup_id !== $service->id) {
                        return false;
                    }
                    // Current locking reads after the doctor lock avoid a stale
                    // repeatable-read snapshot after waiting for booking/reschedule.
                    $reserved = Reservation::query()->where('doctor_visit_slot_id', $target->id)->orderBy('id')->limit(1)->lockForUpdate()->get(['id']);
                    $history = ReservationScheduleChange::query()->where(fn ($q) => $q->where('previous_doctor_visit_slot_id', $target->id)
                        ->orWhere('new_doctor_visit_slot_id', $target->id))->orderBy('id')->limit(1)->lockForUpdate()->get(['id']);
                    $conflicts = Reservation::blocking()->where('doctor_profile_id', $doctor->id)->where('starts_at', '<', $target->ends_at)
                        ->where('ends_at', '>', $target->starts_at)->orderBy('id')->limit(1)->lockForUpdate()->get(['id']);

                    return $reserved->isEmpty() && $history->isEmpty() && $conflicts->isEmpty();
                });
                if ($scope !== 'slot') {
                    $localDate = $date;
                }

                if ($targets->isEmpty()) {
                    throw new DomainException('No future unreserved visit slots matched this control.');
                }

                $before = $this->snapshot($scope, $localDate, $targets);

                foreach ($targets as $target) {
                    $target->fill(array_filter([
                        'is_active' => $isActive,
                        'price' => $price,
                    ], fn ($value): bool => $value !== null))->save();
                }

                $this->auditLogger->log(
                    request: $request,
                    actor: $currentActor,
                    action: 'doctor.visit_slots.controlled',
                    subject: $lockedWorkplace,
                    riskLevel: 'high',
                    before: $before,
                    after: $this->snapshot($scope, $localDate, $targets->map->fresh()),
                    reason: $reason,
                );

                return $targets->map->fresh();
            }, 3);
        } catch (DeadlockException $error) {
            // Laravel cannot safely retry an inner transaction after MySQL
            // rolled back its outer owner. Let the owner unwind through 409.
            throw new ScheduleControlConflict($error);
        } catch (PDOException $error) {
            if ((string) $error->getCode() === '40001' || in_array((int) ($error->errorInfo[1] ?? 0), [1205, 1213], true)) {
                throw new ScheduleControlConflict($error);
            }
            throw $error;
        }
    }

    /** @param Collection<int, DoctorVisitSlot> $slots */
    private function snapshot(string $scope, Carbon $localDate, Collection $slots): array
    {
        return [
            'scope' => $scope,
            'date' => $localDate->toDateString(),
            'slot_public_ids' => $slots->pluck('public_id')->map(fn ($id): string => (string) $id)->all(),
            'slot_count' => $slots->count(),
            'active_count' => $slots->where('is_active', true)->count(),
            'prices' => $slots->pluck('price')->map(fn ($value): int => (int) $value)->unique()->values()->all(),
        ];
    }
}
