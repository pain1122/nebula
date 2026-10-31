<?php

namespace App\Services;

use App\Enums\OutboxEventType;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class ReservationLifecycleService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
        private readonly OutboxPublisher $outboxPublisher,
    ) {}

    public function cancel(
        Request $request,
        User $actor,
        Reservation $reservation,
        string $reason,
    ): Reservation {
        Gate::forUser($actor)->authorize('cancel', $reservation);
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A cancellation reason is required.');
        }

        return DB::transaction(function () use ($request, $actor, $reservation, $reason): Reservation {
            $locked = Reservation::query()->lockForUpdate()->findOrFail($reservation->getKey());

            if ($locked->status === ReservationStatus::Cancelled) {
                return $locked;
            }

            if (! in_array($locked->status, [ReservationStatus::Pending, ReservationStatus::Confirmed], true)) {
                throw new DomainException('Reservation is not in a cancellable state.');
            }

            if ($locked->starts_at?->isPast()) {
                throw new DomainException('Past reservations cannot be cancelled.');
            }

            $before = $this->snapshot($locked);
            $locked->forceFill([
                'status' => ReservationStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $reason,
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'reservation.cancelled',
                subject: $locked,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($locked),
                reason: $reason,
            );

            return $locked->fresh(['payment']);
        });
    }

    public function complete(
        Request $request,
        User $actor,
        Reservation $reservation,
    ): Reservation {
        Gate::forUser($actor)->authorize('complete', $reservation);

        return DB::transaction(function () use ($request, $actor, $reservation): Reservation {
            $payment = Payment::query()
                ->where('reservation_id', $reservation->getKey())
                ->lockForUpdate()
                ->first();
            $locked = Reservation::query()->lockForUpdate()->findOrFail($reservation->getKey());

            if ($locked->status === ReservationStatus::Completed) {
                return $locked->load('payment');
            }

            $this->assertCompletionState($locked, $payment);

            $successfulAttempt = PaymentAttempt::query()
                ->lockForUpdate()
                ->find($payment->successful_attempt_id);

            if (! $this->isCanonicalSuccess($payment, $locked, $successfulAttempt)) {
                throw new DomainException('Reservation payment is not canonically paid.');
            }

            $before = $this->snapshot($locked);
            $locked->forceFill([
                'status' => ReservationStatus::Completed,
                'completed_at' => now(),
            ])->save();
            $occurredAt = $locked->completed_at->toISOString();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'reservation.completed',
                subject: $locked,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($locked),
            );

            $this->outboxPublisher->marketplace(
                $locked,
                OutboxEventType::ReservationCompleted,
                [
                    'reservation_public_id' => (string) $locked->public_id,
                    'actor_public_id' => (string) $actor->public_id,
                    'occurred_at' => $occurredAt,
                ],
            );
            $this->outboxPublisher->marketplace(
                $locked,
                OutboxEventType::RatingRequested,
                [
                    'reservation_public_id' => (string) $locked->public_id,
                    'patient_public_id' => (string) $locked->user()->value('public_id'),
                    'occurred_at' => $occurredAt,
                ],
            );

            return $locked->fresh(['payment']);
        });
    }

    private function isCanonicalSuccess(
        Payment $payment,
        Reservation $reservation,
        ?PaymentAttempt $attempt,
    ): bool {
        return $attempt !== null
            && $attempt->id === $payment->successful_attempt_id
            && $attempt->payment_summary_id === $payment->id
            && $attempt->reservation_id === $reservation->id
            && $attempt->status === PaymentAttemptStatus::Succeeded
            && (int) $attempt->amount === (int) $payment->amount
            && $attempt->currency === $payment->currency
            && $attempt->completed_at !== null;
    }

    public function canComplete(Reservation $reservation): bool
    {
        $reservation->loadMissing('payment.successfulAttempt');
        $payment = $reservation->payment;
        try {
            $this->assertCompletionState($reservation, $payment);
        } catch (DomainException) {
            return false;
        }

        return $this->isCanonicalSuccess($payment, $reservation, $payment->successfulAttempt);
    }

    private function assertCompletionState(Reservation $reservation, ?Payment $payment): void
    {
        if ($reservation->status !== ReservationStatus::Confirmed) {
            throw new DomainException('Only a confirmed reservation can be completed.');
        }
        if ($reservation->starts_at === null || $reservation->starts_at->isFuture()) {
            throw new DomainException('The appointment start time has not been reached.');
        }
        if ($payment === null || $payment->status !== PaymentSummaryStatus::Paid
            || $payment->successful_attempt_id === null) {
            throw new DomainException('Reservation payment is not canonically paid.');
        }
    }

    /** @return array<string, mixed> */
    private function snapshot(Reservation $reservation): array
    {
        return [
            'status' => $reservation->status->value,
            'completed_at' => $reservation->completed_at?->toISOString(),
            'cancelled_at' => $reservation->cancelled_at?->toISOString(),
        ];
    }
}
