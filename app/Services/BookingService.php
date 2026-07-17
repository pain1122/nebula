<?php

namespace App\Services;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    /**
     * @return array{0: Reservation, 1: Payment}
     */
    public function createReservation(
        User $user,
        Checkup $checkup,
        DoctorProfile $doctor,
        Carbon $start,
        int $durationMinutes,
        ?DoctorWorkplace $workplace = null,
        ?string $idempotencyKey = null
    ): array {
        if ($idempotencyKey !== null) {
            $existing = Reservation::query()
                ->where('booking_idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                if ($existing->user_id !== $user->id) {
                    throw ValidationException::withMessages([
                        'idempotency_key' => ['idempotency_key_conflict'],
                    ]);
                }

                return [$existing, $existing->payment()->firstOrFail()];
            }
        }

        return DB::transaction(function () use (
            $user,
            $checkup,
            $doctor,
            $start,
            $durationMinutes,
            $workplace,
            $idempotencyKey
        ): array {
            $lockedCheckup = Checkup::query()->whereKey($checkup->id)->lockForUpdate()->first();

            if (! $lockedCheckup) {
                throw ValidationException::withMessages(['checkup_id' => ['checkup_not_available']]);
            }

            $lockedDoctor = DoctorProfile::query()->whereKey($doctor->id)->lockForUpdate()->first();

            if (! $lockedDoctor) {
                throw ValidationException::withMessages(['doctor_profile_id' => ['doctor_not_found']]);
            }

            $lockedWorkplace = $this->resolveBookableWorkplace(
                $lockedCheckup,
                $lockedDoctor,
                $workplace?->id
            );
            $service = $lockedWorkplace->checkups()
                ->whereKey($lockedCheckup->id)
                ->wherePivot('is_active', true)
                ->firstOrFail();
            $configuredDuration = $service->pivot->duration_override_minutes
                ?? $lockedCheckup->default_duration_minutes;

            if ($durationMinutes !== (int) $configuredDuration) {
                throw ValidationException::withMessages(['duration' => ['duration_not_offered']]);
            }

            $this->assertRequestedSlotIsGenerated($lockedWorkplace, $start, $durationMinutes);

            $end = $start->copy()->addMinutes($durationMinutes);

            if (SchedulingService::hasConflict($lockedDoctor->id, $start, $end)) {
                throw ValidationException::withMessages(['time' => ['time_conflict']]);
            }

            $lockedWorkplace->loadMissing(['hospital', 'doctorProfile.user']);
            $lockedCheckup->loadMissing('category');
            $price = (int) ($service->pivot->price_override ?? $lockedCheckup->price);
            $currency = $service->pivot->currency_override ?? $lockedCheckup->currency;

            $reservation = Reservation::query()->create([
                'user_id' => $user->id,
                'doctor_profile_id' => $lockedDoctor->id,
                'doctor_workplace_id' => $lockedWorkplace->id,
                'checkup_id' => $lockedCheckup->id,
                'starts_at' => $start,
                'ends_at' => $end,
                'duration_minutes' => $durationMinutes,
                'timezone' => $lockedWorkplace->hospital->timezone,
                'status' => ReservationStatus::Pending,
                'hold_expires_at' => now()->addHour(),
                'booking_idempotency_key' => $idempotencyKey,
                'hospital_name_snapshot' => $lockedWorkplace->hospital->name,
                'doctor_name_snapshot' => $lockedDoctor->user->name,
                'checkup_title_snapshot' => $lockedCheckup->title,
                'category_name_snapshot' => $lockedCheckup->category?->name,
                'price_snapshot' => $price,
                'currency_snapshot' => $currency,
            ]);

            $payment = Payment::query()->create([
                'reservation_id' => $reservation->id,
                'amount' => $price,
                'currency' => $currency,
                'status' => 'unpaid',
            ]);

            return [$reservation, $payment];
        });
    }

    public function resolveBookableWorkplace(
        Checkup $checkup,
        DoctorProfile $doctor,
        ?int $workplaceId = null
    ): DoctorWorkplace {
        if (! $doctor->verified) {
            throw ValidationException::withMessages(['doctor_profile_id' => ['doctor_not_verified']]);
        }

        $query = DoctorWorkplace::query()
            ->where('doctor_profile_id', $doctor->id)
            ->where('is_active', true)
            ->whereHas('hospital', fn ($hospital) => $hospital->where('is_active', true)->whereNull('archived_at'))
            ->whereHas('checkups', function ($services) use ($checkup): void {
                $services
                    ->where('checkups.id', $checkup->id)
                    ->where('doctor_workplace_checkup.is_active', true);
            });

        if ($workplaceId !== null) {
            $query->whereKey($workplaceId);
        }

        $workplaces = $query->limit(2)->get();

        if ($workplaces->isEmpty()) {
            throw ValidationException::withMessages([
                'doctor_workplace_id' => ['doctor_not_assigned_to_checkup_at_workplace'],
            ]);
        }

        if ($workplaceId === null && $workplaces->count() > 1) {
            throw ValidationException::withMessages(['doctor_workplace_id' => ['workplace_required']]);
        }

        return $workplaces->first();
    }

    public function assertDoctorCanPerformCheckup(Checkup $checkup, DoctorProfile $doctor): void
    {
        $this->resolveBookableWorkplace($checkup, $doctor);
    }

    public function assertRequestedSlotIsGenerated(
        DoctorWorkplace $workplace,
        Carbon $start,
        int $durationMinutes
    ): void {
        if ($durationMinutes <= 0) {
            throw ValidationException::withMessages(['duration' => ['invalid_duration']]);
        }

        if ($start->lessThanOrEqualTo(now())) {
            throw ValidationException::withMessages(['starts_at' => ['past_slot']]);
        }

        $end = $start->copy()->addMinutes($durationMinutes);
        $slots = SchedulingService::buildWorkplaceSlots(
            $workplace,
            $start->copy()->startOfDay(),
            $start->copy()->endOfDay(),
            $durationMinutes
        );

        foreach ($slots as [$slotStart, $slotEnd]) {
            if ($slotStart->equalTo($start) && $slotEnd->equalTo($end)) {
                return;
            }
        }

        throw ValidationException::withMessages(['starts_at' => ['slot_not_available']]);
    }
}
