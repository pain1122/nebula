<?php

namespace App\Services;

use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\Reservation;
use App\Models\ReservationScheduleChange;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Support\ReservationRevision;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class ReservationRescheduleService
{
    public function __construct(
        private readonly BookingService $bookingService,
        private readonly AuditLogger $auditLogger,
    ) {}

    public function reschedule(
        Request $request,
        User $actor,
        Reservation $reservation,
        string $replacementSlotPublicId,
        string $reason,
        ?string $expectedRevision = null,
    ): Reservation {
        Gate::forUser($actor)->authorize('reschedule', $reservation);
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A reschedule reason is required.');
        }

        return DB::transaction(function () use ($request, $actor, $reservation, $replacementSlotPublicId, $reason, $expectedRevision): Reservation {
            $actor = User::query()->lockForUpdate()->findOrFail($actor->getKey());
            $actor->load('roles');
            if (! $actor->permitsAuthentication()) {
                throw new AuthorizationException('The reservation actor is no longer active.');
            }

            $replacementSlot = DoctorVisitSlot::query()
                ->where('public_id', $replacementSlotPublicId)
                ->lockForUpdate()
                ->first();

            if (! $replacementSlot
                || ! $replacementSlot->is_active
                || ! $replacementSlot->starts_at->isFuture()
                || ! $replacementSlot->workingWindow()->where('is_active', true)->exists()) {
                throw new DomainException('The replacement visit slot is not available.');
            }

            DoctorProfile::query()->whereKey($reservation->doctor_profile_id)->lockForUpdate()->firstOrFail();
            $locked = Reservation::query()->whereKey($reservation->getKey())->lockForUpdate()->firstOrFail();
            Gate::forUser($actor)->authorize('reschedule', $locked);
            if ($expectedRevision !== null) {
                ReservationRevision::assertMatches($locked, $locked->payment()->lockForUpdate()->first(), $expectedRevision);
            }

            if ($locked->doctor_profile_id !== $reservation->doctor_profile_id) {
                throw new DomainException('Reservation assignment changed; refresh before rescheduling.');
            }

            if (! in_array($locked->status, [ReservationStatus::Pending, ReservationStatus::Confirmed], true)
                || ($locked->status === ReservationStatus::Pending && ! $locked->hold_expires_at?->isFuture())) {
                throw new DomainException('Reservation is not in a live reschedulable state.');
            }

            if ($locked->doctor_visit_slot_id === $replacementSlot->getKey()) {
                throw new DomainException('The replacement visit slot must be different.');
            }

            $doctor = DoctorProfile::query()->findOrFail($locked->doctor_profile_id);

            if ($replacementSlot->doctor_workplace_id !== $locked->doctor_workplace_id
                || $replacementSlot->checkup_id !== $locked->checkup_id
                || $replacementSlot->workplace()->value('doctor_profile_id') !== $locked->doctor_profile_id) {
                throw new DomainException('The replacement visit slot must belong to the same offering.');
            }

            if (! $replacementSlot->checkup || $replacementSlot->checkup->trashed() || ! $replacementSlot->checkup->is_active) {
                throw new DomainException('The replacement offering is no longer available.');
            }

            $this->bookingService->resolveBookableWorkplace(
                $replacementSlot->checkup,
                $doctor,
                $replacementSlot->doctor_workplace_id,
            );

            $newStart = $replacementSlot->starts_at;
            $newEnd = $replacementSlot->ends_at;

            if (SchedulingService::hasConflict(
                $doctor->id,
                $newStart,
                $newEnd,
                $locked->id,
                lockForUpdate: true,
            )) {
                throw new DomainException('The requested visit slot conflicts with another reservation.');
            }

            $before = $this->snapshot($locked);
            $newDuration = (int) $newStart->diffInMinutes($newEnd);

            ReservationScheduleChange::query()->create([
                'reservation_id' => $locked->id,
                'actor_id' => $actor->id,
                'previous_doctor_visit_slot_id' => $locked->doctor_visit_slot_id,
                'new_doctor_visit_slot_id' => $replacementSlot->id,
                'previous_doctor_workplace_id' => $locked->doctor_workplace_id,
                'new_doctor_workplace_id' => $locked->doctor_workplace_id,
                'previous_starts_at' => $locked->starts_at,
                'previous_ends_at' => $locked->ends_at,
                'previous_duration_minutes' => $locked->duration_minutes,
                'new_starts_at' => $newStart,
                'new_ends_at' => $newEnd,
                'new_duration_minutes' => $newDuration,
                'reason' => $reason,
            ]);

            $locked->forceFill([
                'doctor_visit_slot_id' => $replacementSlot->id,
                'starts_at' => $newStart,
                'ends_at' => $newEnd,
                'duration_minutes' => $newDuration,
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'reservation.rescheduled',
                subject: $locked,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($locked),
                reason: $reason,
            );

            return $locked->fresh(['payment', 'scheduleChanges']);
        });
    }

    /** @return array<string, mixed> */
    private function snapshot(Reservation $reservation): array
    {
        return [
            'doctor_visit_slot_id' => $reservation->doctor_visit_slot_id,
            'doctor_workplace_id' => $reservation->doctor_workplace_id,
            'checkup_id' => $reservation->checkup_id,
            'starts_at' => $reservation->starts_at?->toISOString(),
            'ends_at' => $reservation->ends_at?->toISOString(),
            'duration_minutes' => $reservation->duration_minutes,
            'price_snapshot' => $reservation->price_snapshot,
            'currency_snapshot' => $reservation->currency_snapshot,
        ];
    }
}
