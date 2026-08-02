<?php

namespace App\Services;

use App\Enums\PaymentSummaryStatus;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use DomainException;
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
    ): Reservation {
        Gate::forUser($actor)->authorize('overrideStatus', $reservation);
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A reservation override reason is required.');
        }

        return DB::transaction(function () use ($request, $actor, $reservation, $newStatus, $reason): Reservation {
            $locked = Reservation::query()->lockForUpdate()->findOrFail($reservation->getKey());
            $payment = $locked->payment()->lockForUpdate()->first();
            $allowed = match ($newStatus) {
                ReservationStatus::Confirmed => $locked->status === ReservationStatus::Pending
                    && $locked->hold_expires_at?->isFuture()
                    && $payment?->status === PaymentSummaryStatus::Paid
                    && $payment->successful_attempt_id !== null,
                ReservationStatus::Completed => $locked->status === ReservationStatus::Confirmed
                    && ! $locked->starts_at?->isFuture(),
                ReservationStatus::Cancelled => ! in_array($locked->status, [
                    ReservationStatus::Completed,
                    ReservationStatus::Cancelled,
                    ReservationStatus::Expired,
                ], true),
                ReservationStatus::Expired => $locked->status === ReservationStatus::Pending
                    && ! $locked->hold_expires_at?->isFuture(),
                default => false,
            };

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
