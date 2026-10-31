<?php

namespace App\Services;

use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use DomainException;
use Illuminate\Support\Facades\DB;

class LocalSandboxPaymentService
{
    public function __construct(
        private readonly PaymentLifecycleService $lifecycle,
        private readonly LocalSandboxPaymentGateway $gateway,
    ) {}

    public static function available(Reservation $reservation): bool
    {
        return LocalSandboxPaymentGateway::enabled()
            && $reservation->status === ReservationStatus::Pending
            && $reservation->hold_expires_at?->isFuture()
            && $reservation->payment?->status === PaymentSummaryStatus::Unpaid;
    }

    public function start(Reservation $reservation, string $idempotencyKey): PaymentAttempt
    {
        abort_unless(LocalSandboxPaymentGateway::enabled(), 404);

        return DB::transaction(function () use ($reservation, $idempotencyKey): PaymentAttempt {
            // Match the lifecycle's lock order and serialize retries before its identity lookup.
            $summary = Payment::query()->where('reservation_id', $reservation->id)->lockForUpdate()->firstOrFail();
            Reservation::query()->lockForUpdate()->findOrFail($reservation->id);

            $attempt = $this->lifecycle->createAttempt(
                $summary,
                'sandbox',
                'sandbox:'.hash('sha256', $reservation->public_id.':'.$idempotencyKey),
            );

            if ($attempt->provider_ref === null) {
                $provider = $this->gateway->createAttempt(['attempt_public_id' => $attempt->public_id]);
                $attempt->forceFill(['provider_ref' => $provider['provider_ref']])->save();
            }

            return $attempt;
        });
    }

    public function complete(Reservation $reservation, PaymentAttempt $attempt, string $outcome): PaymentAttempt
    {
        abort_unless(LocalSandboxPaymentGateway::enabled(), 404);
        if ($attempt->reservation_id !== $reservation->id || $attempt->provider !== 'sandbox'
            || ! in_array($outcome, ['success', 'failed'], true)) {
            throw new DomainException('Invalid sandbox payment result.');
        }

        return DB::transaction(function () use ($reservation, $attempt, $outcome): PaymentAttempt {
            Payment::query()->lockForUpdate()->findOrFail($attempt->payment_summary_id);
            Reservation::query()->lockForUpdate()->findOrFail($reservation->id);
            $lockedAttempt = PaymentAttempt::query()->lockForUpdate()->findOrFail($attempt->id);

            // A terminal attempt has one result; replay cannot downgrade a canonical success.
            if ($lockedAttempt->status !== PaymentAttemptStatus::Initiated) {
                return $lockedAttempt;
            }

            $provider = $this->gateway->createAttempt(['attempt_public_id' => $lockedAttempt->public_id]);
            $eventId = 'sandbox:'.$lockedAttempt->public_id;
            $payload = [
                'attempt_public_id' => $lockedAttempt->public_id,
                'reservation_public_id' => $reservation->public_id,
                'amount' => (int) $lockedAttempt->amount,
                'currency' => $lockedAttempt->currency,
                'external_event_id' => $eventId,
                'result_code' => $outcome === 'success' ? 'sandbox_ok' : 'sandbox_failed',
                'provider_ref' => $provider['provider_ref'],
            ];

            return $this->lifecycle->processCallback(
                $this->gateway,
                $lockedAttempt,
                $eventId,
                $outcome === 'success' ? 'payment.succeeded' : 'payment.failed',
                $payload,
                $this->gateway->signCallback($payload),
                $outcome === 'success',
            );
        });
    }
}
