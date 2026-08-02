<?php

namespace App\Services;

use App\Contracts\Integrations\PaymentGateway;
use App\Enums\OutboxEventType;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentLifecycleService
{
    public function __construct(
        private readonly OutboxPublisher $outboxPublisher,
    ) {}

    public function createAttempt(Payment $payment, string $provider, string $idempotencyKey): PaymentAttempt
    {
        if (! preg_match('/^[a-z0-9][a-z0-9._-]{1,59}$/', $provider)
            || ! preg_match('/^[A-Za-z0-9._:-]{8,100}$/', $idempotencyKey)) {
            throw ValidationException::withMessages(['payment' => ['invalid_attempt_identity']]);
        }

        $existing = PaymentAttempt::query()
            ->where('provider', $provider)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($existing !== null) {
            if ($existing->payment_summary_id !== $payment->id) {
                throw new DomainException('Payment attempt idempotency key belongs to another payment.');
            }

            return $existing;
        }

        return DB::transaction(function () use ($payment, $provider, $idempotencyKey): PaymentAttempt {
            $summary = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());
            $reservation = Reservation::query()->lockForUpdate()->findOrFail($summary->reservation_id);

            if ($summary->status !== PaymentSummaryStatus::Unpaid
                || $reservation->status !== ReservationStatus::Pending
                || $reservation->hold_expires_at === null
                || ! $reservation->hold_expires_at->isFuture()) {
                throw new DomainException('Payment attempt cannot be created for an inactive reservation hold.');
            }

            $attempt = new PaymentAttempt;
            $attempt->forceFill([
                'payment_summary_id' => $summary->id,
                'reservation_id' => $reservation->id,
                'provider' => $provider,
                'idempotency_key' => $idempotencyKey,
                'amount' => $summary->amount,
                'currency' => $summary->currency,
                'status' => PaymentAttemptStatus::Initiated,
                'initiated_at' => now(),
                'expires_at' => $reservation->hold_expires_at,
            ])->save();

            $this->outboxPublisher->marketplace(
                $attempt,
                OutboxEventType::PaymentAttemptRequested,
                [
                    'reservation_public_id' => (string) $reservation->public_id,
                    'payment_attempt_public_id' => (string) $attempt->public_id,
                    'amount' => (int) $attempt->amount,
                    'currency' => $attempt->currency,
                ],
            );

            return $attempt;
        });
    }

    /** @param array<string, mixed> $payload */
    public function processCallback(
        PaymentGateway $gateway,
        PaymentAttempt $attempt,
        string $externalEventId,
        string $eventType,
        array $payload,
        string $signature,
        bool $succeeded,
    ): PaymentAttempt {
        if (! $gateway->verifyCallback($payload, $signature)) {
            throw new DomainException('Payment callback signature verification failed.');
        }

        $allowedPayload = array_intersect_key($payload, array_flip(['result_code', 'provider_ref']));

        return DB::transaction(function () use ($attempt, $externalEventId, $eventType, $allowedPayload, $succeeded): PaymentAttempt {
            $existingEvent = DB::table('payment_provider_events')
                ->where('provider', $attempt->provider)
                ->where('external_event_id', $externalEventId)
                ->first();

            if ($existingEvent !== null) {
                return PaymentAttempt::query()->findOrFail($existingEvent->payment_attempt_id);
            }

            $summary = Payment::query()->lockForUpdate()->findOrFail($attempt->payment_summary_id);
            $reservation = Reservation::query()->lockForUpdate()->findOrFail($summary->reservation_id);
            $lockedAttempt = PaymentAttempt::query()->lockForUpdate()->findOrFail($attempt->getKey());

            DB::table('payment_provider_events')->insert([
                'public_id' => (string) Str::ulid(),
                'payment_attempt_id' => $lockedAttempt->id,
                'provider' => $lockedAttempt->provider,
                'external_event_id' => $externalEventId,
                'event_type' => $eventType,
                'signature_verified' => true,
                'received_at' => now(),
                'sanitized_payload' => json_encode($allowedPayload, JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if (! $succeeded) {
                $lockedAttempt->forceFill([
                    'status' => PaymentAttemptStatus::Failed,
                    'failure_code' => $allowedPayload['result_code'] ?? 'provider_failed',
                    'completed_at' => now(),
                ])->save();
            } elseif ($summary->successful_attempt_id !== null && $summary->successful_attempt_id !== $lockedAttempt->id) {
                $lockedAttempt->forceFill([
                    'status' => PaymentAttemptStatus::Reconciliation,
                    'completed_at' => now(),
                ])->save();
            } elseif ($reservation->status !== ReservationStatus::Pending
                || $reservation->hold_expires_at === null
                || ! $reservation->hold_expires_at->isFuture()) {
                $lockedAttempt->forceFill([
                    'status' => PaymentAttemptStatus::Reconciliation,
                    'completed_at' => now(),
                ])->save();
                $summary->forceFill(['status' => PaymentSummaryStatus::Reconciliation])->save();

                if ($reservation->status === ReservationStatus::Pending) {
                    $reservation->forceFill([
                        'status' => ReservationStatus::Expired,
                        'expired_at' => now(),
                    ])->save();
                }
            } else {
                $lockedAttempt->forceFill([
                    'status' => PaymentAttemptStatus::Succeeded,
                    'provider_ref' => $allowedPayload['provider_ref'] ?? $lockedAttempt->provider_ref,
                    'completed_at' => now(),
                ])->save();
                $summary->forceFill([
                    'status' => PaymentSummaryStatus::Paid,
                    'successful_attempt_id' => $lockedAttempt->id,
                    'provider' => $lockedAttempt->provider,
                    'provider_ref' => $lockedAttempt->provider_ref,
                    'paid_at' => now(),
                ])->save();
                $reservation->forceFill(['status' => ReservationStatus::Confirmed])->save();
            }

            DB::table('payment_provider_events')
                ->where('provider', $lockedAttempt->provider)
                ->where('external_event_id', $externalEventId)
                ->update(['processed_at' => now(), 'updated_at' => now()]);

            return $lockedAttempt->fresh();
        });
    }
}
