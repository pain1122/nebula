<?php

namespace Tests\Feature\Services;

use App\Enums\OutboxEventType;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\AuditEvent;
use App\Models\OutboxEvent;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OutboxPublisher;
use App\Services\ReservationLifecycleService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ReservationLifecycleServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigned_doctor_completes_a_confirmed_started_canonically_paid_reservation(): void
    {
        [$reservation, $payment, $attempt] = $this->paidReservation();
        $doctor = $reservation->doctor->user;

        $completed = app(ReservationLifecycleService::class)->complete(
            $this->requestAs($doctor, '/api/doctor/reservations/'.$reservation->id.'/complete'),
            $doctor,
            $reservation,
        );

        $this->assertSame(ReservationStatus::Completed, $completed->status);
        $this->assertNotNull($completed->completed_at);
        $this->assertSame(PaymentSummaryStatus::Paid, $payment->fresh()->status);
        $this->assertSame($attempt->id, $payment->fresh()->successful_attempt_id);
        $this->assertDatabaseHas('audit_events', [
            'action' => 'reservation.completed',
            'subject_id' => $reservation->id,
        ]);
        $this->assertDatabaseHas('outbox_events', [
            'event_type' => OutboxEventType::ReservationCompleted->value,
            'subject_id' => $reservation->id,
        ]);
        $this->assertDatabaseHas('outbox_events', [
            'event_type' => OutboxEventType::RatingRequested->value,
            'subject_id' => $reservation->id,
        ]);

        $ratingPayload = OutboxEvent::query()
            ->where('event_type', OutboxEventType::RatingRequested->value)
            ->firstOrFail()
            ->payload;
        $this->assertEqualsCanonicalizing([
            'reservation_public_id',
            'patient_public_id',
            'occurred_at',
        ], array_keys($ratingPayload));
    }

    public function test_wrong_doctor_patient_and_admin_cannot_complete_an_ordinary_reservation(): void
    {
        [$reservation] = $this->paidReservation();
        $actors = [
            User::factory()->doctor()->create(),
            $reservation->user,
            User::factory()->admin()->create(),
        ];

        foreach ($actors as $actor) {
            try {
                app(ReservationLifecycleService::class)->complete(
                    $this->requestAs($actor),
                    $actor,
                    $reservation,
                );
                $this->fail('An unassigned actor completed an ordinary reservation.');
            } catch (AuthorizationException) {
                $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
            }
        }

        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_completion_rejects_early_unpaid_noncanonical_and_terminal_reservations(): void
    {
        [$early] = $this->paidReservation(['starts_at' => now()->addMinute()]);
        $this->assertCompletionRejected($early);

        $unpaid = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
            'starts_at' => now()->subMinute(),
        ]);
        Payment::query()->create([
            'reservation_id' => $unpaid->id,
            'amount' => $unpaid->price_snapshot,
            'currency' => $unpaid->currency_snapshot,
            'status' => PaymentSummaryStatus::Unpaid,
        ]);
        $this->assertCompletionRejected($unpaid);

        [$noncanonical, $payment, $attempt] = $this->paidReservation();
        $attempt->forceFill(['status' => PaymentAttemptStatus::Failed])->save();
        $this->assertCompletionRejected($noncanonical);
        $this->assertSame($attempt->id, $payment->fresh()->successful_attempt_id);

        foreach ([ReservationStatus::Pending, ReservationStatus::Cancelled, ReservationStatus::Expired] as $status) {
            [$terminal] = $this->paidReservation(['status' => $status]);
            $this->assertCompletionRejected($terminal);
        }

        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_completion_is_idempotent_and_publishes_exactly_one_rating_request(): void
    {
        [$reservation] = $this->paidReservation();
        $doctor = $reservation->doctor->user;
        $service = app(ReservationLifecycleService::class);

        $first = $service->complete($this->requestAs($doctor), $doctor, $reservation);
        $second = $service->complete($this->requestAs($doctor), $doctor, $reservation->fresh());

        $this->assertSame($first->completed_at->toISOString(), $second->completed_at->toISOString());
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation.completed')->count());
        $this->assertSame(1, OutboxEvent::query()->where('event_type', OutboxEventType::ReservationCompleted->value)->count());
        $this->assertSame(1, OutboxEvent::query()->where('event_type', OutboxEventType::RatingRequested->value)->count());
    }

    public function test_audit_failure_rolls_back_completion(): void
    {
        [$reservation] = $this->paidReservation();
        $doctor = $reservation->doctor->user;
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(ReservationLifecycleService::class)->complete(
                $this->requestAs($doctor),
                $doctor,
                $reservation,
            );
            $this->fail('Audit failure must escape the lifecycle transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
        $this->assertNull($reservation->fresh()->completed_at);
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_outbox_failure_rolls_back_completion_and_audit(): void
    {
        [$reservation] = $this->paidReservation();
        $doctor = $reservation->doctor->user;
        $this->mock(OutboxPublisher::class, function (MockInterface $mock): void {
            $mock->shouldReceive('marketplace')->once()->andThrow(new RuntimeException('outbox failed'));
        });

        try {
            app(ReservationLifecycleService::class)->complete(
                $this->requestAs($doctor),
                $doctor,
                $reservation,
            );
            $this->fail('Outbox failure must escape the lifecycle transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('outbox failed', $exception->getMessage());
        }

        $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
        $this->assertNull($reservation->fresh()->completed_at);
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_patient_cancellation_is_authorized_stateful_idempotent_and_payment_separate(): void
    {
        [$reservation, $payment, $attempt] = $this->paidReservation([
            'starts_at' => now()->addHour(),
        ]);
        $patient = $reservation->user;
        $service = app(ReservationLifecycleService::class);

        $cancelled = $service->cancel(
            $this->requestAs($patient, '/api/reservations/'.$reservation->id.'/cancel'),
            $patient,
            $reservation,
            'Patient can no longer attend',
        );
        $again = $service->cancel(
            $this->requestAs($patient),
            $patient,
            $cancelled,
            'Repeated request',
        );

        $this->assertSame(ReservationStatus::Cancelled, $again->status);
        $this->assertSame('Patient can no longer attend', $again->cancellation_reason);
        $this->assertSame(PaymentSummaryStatus::Paid, $payment->fresh()->status);
        $this->assertSame($attempt->id, $payment->fresh()->successful_attempt_id);
        $this->assertDatabaseCount('payment_adjustments', 0);
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation.cancelled')->count());

        $attacker = User::factory()->patient()->create();
        $this->expectException(AuthorizationException::class);
        $service->cancel($this->requestAs($attacker), $attacker, $reservation, 'Unauthorized');
    }

    /** @param array<string, mixed> $reservationOverrides
     * @return array{0: Reservation, 1: Payment, 2: PaymentAttempt}
     */
    protected function paidReservation(array $reservationOverrides = []): array
    {
        $reservation = Reservation::factory()->create(array_merge([
            'status' => ReservationStatus::Confirmed,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
        ], $reservationOverrides));
        $payment = Payment::query()->create([
            'reservation_id' => $reservation->id,
            'amount' => $reservation->price_snapshot,
            'currency' => $reservation->currency_snapshot,
            'status' => PaymentSummaryStatus::Unpaid,
        ]);
        $attempt = new PaymentAttempt;
        $attempt->forceFill([
            'payment_summary_id' => $payment->id,
            'reservation_id' => $reservation->id,
            'provider' => 'sandbox',
            'provider_ref' => 'success-'.$reservation->id,
            'idempotency_key' => 'success-attempt-'.$reservation->id,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'status' => PaymentAttemptStatus::Succeeded,
            'initiated_at' => now()->subMinutes(2),
            'completed_at' => now()->subMinute(),
        ])->save();
        $payment->forceFill([
            'status' => PaymentSummaryStatus::Paid,
            'successful_attempt_id' => $attempt->id,
            'provider' => $attempt->provider,
            'provider_ref' => $attempt->provider_ref,
            'paid_at' => now()->subMinute(),
        ])->save();

        return [$reservation->fresh(), $payment->fresh(), $attempt->fresh()];
    }

    private function assertCompletionRejected(Reservation $reservation): void
    {
        try {
            app(ReservationLifecycleService::class)->complete(
                $this->requestAs($reservation->doctor->user),
                $reservation->doctor->user,
                $reservation,
            );
            $this->fail('Invalid reservation completion was accepted.');
        } catch (DomainException) {
            $this->assertNotSame(ReservationStatus::Completed, $reservation->fresh()->status);
        }
    }

    private function requestAs(User $user, string $path = '/api/doctor/reservations/1/complete'): Request
    {
        $request = Request::create($path, 'POST');
        $request->setUserResolver(fn (): User => $user);

        return $request;
    }
}
