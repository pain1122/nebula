<?php

namespace App\Services;

use App\Enums\OutboxEventType;
use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkplace;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    public function __construct(
        private readonly OutboxPublisher $outboxPublisher,
    ) {}

    /**
     * @return array{0: Reservation, 1: Payment}
     */
    public function createReservation(
        User $user,
        string $slotPublicId,
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
            $slotPublicId,
            $idempotencyKey
        ): array {
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
            $activeHoldLimit = max(1, (int) config('payments.max_active_holds_per_user', 3));
            $activeHoldCount = Reservation::query()
                ->where('user_id', $user->getKey())
                ->where('status', ReservationStatus::Pending)
                ->where('hold_expires_at', '>', now())
                ->count();

            if ($activeHoldCount >= $activeHoldLimit) {
                throw ValidationException::withMessages([
                    'reservation' => ['active_hold_limit_reached'],
                ]);
            }

            $lockedSlot = DoctorVisitSlot::query()
                ->where('public_id', $slotPublicId)
                ->lockForUpdate()
                ->first();

            if (! $lockedSlot
                || ! $lockedSlot->is_active
                || ! $lockedSlot->workingWindow()->where('is_active', true)->exists()) {
                throw ValidationException::withMessages(['slot_id' => ['slot_not_available']]);
            }

            if ($lockedSlot->starts_at->lessThanOrEqualTo(now())) {
                throw ValidationException::withMessages(['slot_id' => ['past_slot']]);
            }

            $lockedWorkplace = DoctorWorkplace::query()
                ->whereKey($lockedSlot->doctor_workplace_id)
                ->lockForUpdate()
                ->firstOrFail();
            $lockedDoctor = DoctorProfile::query()
                ->whereKey($lockedWorkplace->doctor_profile_id)
                ->lockForUpdate()
                ->first();

            if (! $lockedDoctor) {
                throw ValidationException::withMessages(['doctor_profile_id' => ['doctor_not_found']]);
            }

            $lockedCheckup = Checkup::query()->whereKey($lockedSlot->checkup_id)->lockForUpdate()->first();

            if (! $lockedCheckup) {
                throw ValidationException::withMessages(['checkup_id' => ['checkup_not_available']]);
            }

            $lockedWorkplace = $this->resolveBookableWorkplace(
                $lockedCheckup,
                $lockedDoctor,
                $lockedWorkplace->getKey(),
            );
            $start = $lockedSlot->starts_at;
            $end = $lockedSlot->ends_at;
            $durationMinutes = (int) $start->diffInMinutes($end);

            if (SchedulingService::hasConflict(
                $lockedDoctor->id,
                $start,
                $end,
                lockForUpdate: true,
            )) {
                throw ValidationException::withMessages(['time' => ['time_conflict']]);
            }

            $lockedWorkplace->loadMissing(['hospital', 'doctorProfile.user']);
            $lockedCheckup->loadMissing('category');
            $price = (int) $lockedSlot->price;
            $currency = (string) $lockedSlot->currency;

            $reservation = Reservation::query()->create([
                'doctor_visit_slot_id' => $lockedSlot->id,
                'user_id' => $user->id,
                'doctor_profile_id' => $lockedDoctor->id,
                'doctor_workplace_id' => $lockedWorkplace->id,
                'checkup_id' => $lockedCheckup->id,
                'starts_at' => $start,
                'ends_at' => $end,
                'duration_minutes' => $durationMinutes,
                'timezone' => app(GeneralMarketplaceRuntime::class)->timezone($lockedWorkplace->hospital->timezone),
                'status' => ReservationStatus::Pending,
                'hold_expires_at' => now()->addMinutes(
                    app(GeneralMarketplaceRuntime::class)->holdMinutes()
                ),
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

            $this->outboxPublisher->marketplace(
                $reservation,
                OutboxEventType::ReservationCreated,
                [
                    'reservation_public_id' => (string) $reservation->public_id,
                    'actor_public_id' => (string) $user->public_id,
                    'occurred_at' => now()->toISOString(),
                ],
            );

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
}
