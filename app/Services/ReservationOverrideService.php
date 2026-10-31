<?php

namespace App\Services;

use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Support\ReservationRevision;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class ReservationOverrideService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function changeStatus(
        Request $request,
        User $actor,
        Reservation $reservation,
        ReservationStatus $newStatus,
        string $reason,
        ?string $expectedRevision = null,
    ): Reservation {
        Gate::forUser($actor)->authorize('overrideStatus', $reservation);
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A reservation override reason is required.');
        }

        return DB::transaction(function () use ($request, $actor, $reservation, $newStatus, $reason, $expectedRevision): Reservation {
            $actor = User::query()->lockForUpdate()->findOrFail($actor->getKey());
            $actor->load('roles');
            if (! $actor->permitsAuthentication()) {
                throw new AuthorizationException('The reservation actor is no longer active.');
            }

            $locked = Reservation::query()->lockForUpdate()->findOrFail($reservation->getKey());
            Gate::forUser($actor)->authorize('overrideStatus', $locked);
            $payment = $locked->payment()->lockForUpdate()->first();
            ReservationRevision::assertMatches($locked, $payment, $expectedRevision);
            $allowed = $this->canTransition($locked, $payment, $newStatus);

            if (! $allowed) {
                throw new DomainException("Reservation cannot transition from {$locked->status->value} to {$newStatus->value}.");
            }

            $before = $this->snapshot($locked);
            $locked->forceFill([
                'status' => $newStatus,
                'completed_at' => $newStatus === ReservationStatus::Completed ? now() : $locked->completed_at,
                'cancelled_at' => $newStatus === ReservationStatus::Cancelled ? now() : $locked->cancelled_at,
                'cancelled_by' => $newStatus === ReservationStatus::Cancelled ? $actor->id : $locked->cancelled_by,
                'expired_at' => $newStatus === ReservationStatus::Expired ? now() : $locked->expired_at,
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'admin.reservation.status_overridden',
                subject: $locked,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($locked),
                reason: $reason,
            );

            return $locked->fresh();
        });
    }

    public function canTransition(Reservation $reservation, ?Payment $payment, ReservationStatus $target): bool
    {
        return (bool) match ($target) {
            ReservationStatus::Confirmed => $reservation->status === ReservationStatus::Pending
                && $reservation->hold_expires_at?->isFuture()
                && $payment?->status === PaymentSummaryStatus::Paid
                && $payment->successful_attempt_id !== null,
            ReservationStatus::Completed => $reservation->status === ReservationStatus::Confirmed
                && ! $reservation->starts_at?->isFuture(),
            ReservationStatus::Cancelled => ! in_array($reservation->status, [
                ReservationStatus::Completed, ReservationStatus::Cancelled, ReservationStatus::Expired,
            ], true),
            ReservationStatus::Expired => $reservation->status === ReservationStatus::Pending
                && ! $reservation->hold_expires_at?->isFuture(),
            default => false,
        };
    }

    /** @return array<string, mixed> */
    private function snapshot(Reservation $reservation): array
    {
        return [
            'status' => $reservation->status->value,
            'completed_at' => $reservation->completed_at?->toISOString(),
            'cancelled_at' => $reservation->cancelled_at?->toISOString(),
            'expired_at' => $reservation->expired_at?->toISOString(),
        ];
    }
}
