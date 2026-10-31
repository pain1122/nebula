<?php

namespace App\Services;

use App\Models\DoctorVisitSlot;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Support\ReservationRevision;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/** Advisory reads. Every write still checks current authority/state under locks. */
class AdminReservationActionService
{
    public function __construct(
        private readonly BookingService $booking,
        private readonly ReservationOverrideService $overrides,
    ) {}

    /** @return array<string, mixed> */
    public function metadata(User $actor, Reservation $reservation): array
    {
        $actor = $actor->fresh(['roles']);
        if (! $actor || ! $actor->permitsAuthentication() || ! $actor->canAccessAdminPanel()) {
            throw new AuthorizationException;
        }
        $reservation->loadMissing(['payment', 'doctor']);
        // Detail presentation deliberately selects fewer catalog fields.
        $reservation->load('checkup');
        $canReschedule = Gate::forUser($actor)->allows('reschedule', $reservation)
            && ($reservation->status !== ReservationStatus::Pending || $reservation->hold_expires_at?->isFuture());
        if ($canReschedule) {
            try {
                if (! $reservation->checkup || $reservation->checkup->trashed() || ! $reservation->checkup->is_active) {
                    $canReschedule = false;
                } else {
                    $this->booking->resolveBookableWorkplace($reservation->checkup, $reservation->doctor, $reservation->doctor_workplace_id);
                }
            } catch (ValidationException) {
                $canReschedule = false;
            }
        }

        return [
            'revision' => ReservationRevision::token($reservation, $reservation->payment),
            'generated_at' => now()->toIso8601String(),
            'can_reschedule' => (bool) $canReschedule,
            'allowed_statuses' => $actor->isRootAdmin()
                ? array_values(array_map(fn ($status) => $status->value,
                    array_filter(ReservationStatus::cases(), fn ($status) => $this->overrides->canTransition($reservation, $reservation->payment, $status))))
                : [],
        ];
    }

    /** @return array<string, mixed> */
    public function slots(User $actor, Reservation $reservation, string $from, string $to, int $page, int $perPage): array
    {
        if ($page < 1 || $page > 1000 || $perPage < 1 || $perPage > 100) {
            throw ValidationException::withMessages(['page' => ['invalid_page_bound']]);
        }
        $actions = $this->metadata($actor, $reservation);
        if (! $actions['can_reschedule']) {
            throw ValidationException::withMessages(['reservation' => ['reschedule_unavailable']]);
        }
        $clock = CarbonImmutable::now();
        $start = CarbonImmutable::createFromFormat('!Y-m-d', $from, $reservation->timezone);
        $end = CarbonImmutable::createFromFormat('!Y-m-d', $to, $reservation->timezone)->addDay();
        if ($start->diffInDays($end) > 31) {
            throw ValidationException::withMessages(['to' => ['date_range_exceeds_31_days']]);
        }
        $conflicts = Reservation::query()->selectRaw('1')->blocking()
            ->where('doctor_profile_id', $reservation->doctor_profile_id)->whereKeyNot($reservation->id)
            ->whereColumn('reservations.starts_at', '<', 'doctor_visit_slots.ends_at')
            ->whereColumn('reservations.ends_at', '>', 'doctor_visit_slots.starts_at');
        $slots = DoctorVisitSlot::query()
            ->where('doctor_workplace_id', $reservation->doctor_workplace_id)
            ->where('checkup_id', $reservation->checkup_id)
            ->whereKeyNot($reservation->doctor_visit_slot_id)
            ->where('is_active', true)->whereHas('workingWindow', fn ($rule) => $rule->where('is_active', true))
            ->where('starts_at', '>=', $start->utc())->where('starts_at', '<', $end->utc())
            ->where('starts_at', '>', $clock)->whereColumn('ends_at', '>', 'starts_at')
            ->whereNotExists($conflicts->getQuery())
            ->orderBy('starts_at')->orderBy('id')->paginate($perPage, ['*'], 'page', $page);

        return [
            'reservation_id' => $reservation->id,
            'actions' => $actions,
            'booked_amount' => (int) $reservation->price_snapshot,
            'booked_currency' => $reservation->currency_snapshot,
            'timezone' => $reservation->timezone,
            'items' => $slots->map(fn (DoctorVisitSlot $slot): array => [
                'slot_id' => (string) $slot->public_id,
                'starts_at' => $slot->starts_at->toIso8601String(),
                'ends_at' => $slot->ends_at->toIso8601String(),
                'duration_minutes' => (int) $slot->starts_at->diffInMinutes($slot->ends_at),
            ])->all(),
            'pagination' => [
                'current_page' => $slots->currentPage(), 'per_page' => $slots->perPage(),
                'last_page' => $slots->lastPage(), 'total' => $slots->total(),
            ],
        ];
    }
}
