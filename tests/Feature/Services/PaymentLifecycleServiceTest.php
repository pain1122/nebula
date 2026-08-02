<?php

namespace Tests\Feature\Services;

use App\Contracts\Integrations\PaymentGateway;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Services\PaymentLifecycleService;
use App\Services\ReservationHoldService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentLifecycleServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_attempt_creation_is_idempotent_and_does_not_extend_hold(): void
    {
        [$reservation, $payment] = $this->payment();
        $service = app(PaymentLifecycleService::class);
        $attempt = $service->createAttempt($payment, 'sandbox', 'attempt:key:0001');
        $duplicate = $service->createAttempt($payment, 'sandbox', 'attempt:key:0001');

        $this->assertSame($attempt->id, $duplicate->id);
        $this->assertSame(PaymentAttemptStatus::Initiated, $attempt->status);
        $this->assertTrue($attempt->expires_at->equalTo($reservation->hold_expires_at));
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertDatabaseCount('outbox_events', 1);
        $this->assertDatabaseHas('outbox_events', [
            'event_type' => 'payment.attempt.requested',
            'subject_id' => $attempt->id,
            'status' => 'pending',
        ]);
    }

    public function test_verified_success_selects_one_canonical_attempt_and_duplicate_event_is_idempotent(): void
    {
        [$reservation, $payment] = $this->payment();
        $service = app(PaymentLifecycleService::class);
        $first = $service->createAttempt($payment, 'sandbox', 'attempt:key:0001');
        $second = $service->createAttempt($payment, 'sandbox', 'attempt:key:0002');
        $gateway = $this->gateway(true);
        $payload = ['result_code' => 'ok', 'provider_ref' => 'provider-ref-1', 'raw_secret' => 'discarded'];

        $succeeded = $service->processCallback($gateway, $first, 'event-1', 'payment.succeeded', $payload, 'valid', true);
        $duplicate = $service->processCallback($gateway, $first, 'event-1', 'payment.succeeded', $payload, 'valid', true);
        $reconciled = $service->processCallback($gateway, $second, 'event-2', 'payment.succeeded', $payload, 'valid', true);

        $this->assertSame(PaymentAttemptStatus::Succeeded, $succeeded->status);
        $this->assertSame($succeeded->id, $duplicate->id);
        $this->assertSame(PaymentAttemptStatus::Reconciliation, $reconciled->status);
        $this->assertSame(PaymentSummaryStatus::Paid, $payment->fresh()->status);
        $this->assertSame($first->id, $payment->fresh()->successful_attempt_id);
        $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
        $this->assertDatabaseCount('payment_provider_events', 2);
        $this->assertDatabaseMissing('payment_provider_events', [
            'sanitized_payload' => json_encode($payload),
        ]);
    }

    public function test_invalid_signature_and_late_success_fail_closed_into_reconciliation(): void
    {
        [$reservation, $payment] = $this->payment();
        $service = app(PaymentLifecycleService::class);
        $attempt = $service->createAttempt($payment, 'sandbox', 'attempt:key:0001');

        try {
            $service->processCallback($this->gateway(false), $attempt, 'event-invalid', 'payment.succeeded', [], 'bad', true);
            $this->fail('Invalid callback signature must fail.');
        } catch (DomainException) {
            $this->assertDatabaseCount('payment_provider_events', 0);
        }

        $this->travelTo($reservation->hold_expires_at->copy()->addSecond());
        $late = $service->processCallback(
            $this->gateway(true),
            $attempt,
            'event-late',
            'payment.succeeded',
            ['result_code' => 'ok', 'provider_ref' => 'late-ref'],
            'valid',
            true,
        );

        $this->assertSame(PaymentAttemptStatus::Reconciliation, $late->status);
        $this->assertSame(PaymentSummaryStatus::Reconciliation, $payment->fresh()->status);
        $this->assertSame(ReservationStatus::Expired, $reservation->fresh()->status);
    }

    public function test_overdue_expiration_is_idempotent_and_expires_open_attempts(): void
    {
        [$reservation, $payment] = $this->payment();
        $attempt = app(PaymentLifecycleService::class)->createAttempt($payment, 'sandbox', 'attempt:key:0001');
        $this->travelTo($reservation->hold_expires_at->copy()->addSecond());
        $service = app(ReservationHoldService::class);

        $this->assertSame(1, $service->expireOverdue());
        $this->assertSame(0, $service->expireOverdue());
        $this->assertSame(ReservationStatus::Expired, $reservation->fresh()->status);
        $this->assertSame(PaymentAttemptStatus::Expired, $attempt->fresh()->status);
    }

    /** @return array{0: Reservation, 1: Payment} */
    private function payment(): array
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Pending,
            'hold_expires_at' => now()->addHour(),
        ]);
        $payment = Payment::query()->create([
            'reservation_id' => $reservation->id,
            'amount' => $reservation->price_snapshot,
            'currency' => $reservation->currency_snapshot,
            'status' => PaymentSummaryStatus::Unpaid,
        ]);

        return [$reservation, $payment];
    }

    private function gateway(bool $valid): PaymentGateway
    {
        return new class($valid) implements PaymentGateway
        {
            public function __construct(private readonly bool $valid) {}

            public function createAttempt(array $request): array
            {
                return [];
            }

            public function verifyCallback(array $callback, string $signature): bool
            {
                return $this->valid;
            }
        };
    }
}
