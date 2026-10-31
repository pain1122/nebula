<?php

namespace Tests\Feature\Api;

use App\Enums\OutboxEventType;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationLifecycleApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_cancellation_requires_a_reason_and_does_not_mutate_payment(): void
    {
        [$reservation, $payment, $attempt] = $this->paidReservation([
            'starts_at' => now()->addHour(),
            'ends_at' => now()->addHours(2),
        ]);
        $patient = $reservation->user;

        $this->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations/'.$reservation->id.'/cancel')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations/'.$reservation->id.'/cancel', [
                'reason' => 'I cannot attend this visit',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', ReservationStatus::Cancelled->value);

        $this->assertSame(PaymentSummaryStatus::Paid, $payment->fresh()->status);
        $this->assertSame($attempt->id, $payment->fresh()->successful_attempt_id);
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_assigned_doctor_completion_reaches_the_locked_lifecycle_service(): void
    {
        [$reservation] = $this->paidReservation();

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->id.'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', ReservationStatus::Completed->value);

        $this->assertDatabaseHas('outbox_events', [
            'event_type' => OutboxEventType::RatingRequested->value,
            'subject_id' => $reservation->id,
        ]);
    }

    public function test_unassigned_doctor_receives_not_found_and_cannot_complete(): void
    {
        [$reservation] = $this->paidReservation();
        $otherDoctor = User::factory()->doctor()->create();

        $this->actingAs($otherDoctor, 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->id.'/complete')
            ->assertNotFound();

        $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    /** @param array<string, mixed> $overrides
     * @return array{0: Reservation, 1: Payment, 2: PaymentAttempt}
     */
    private function paidReservation(array $overrides = []): array
    {
        $reservation = Reservation::factory()->create(array_merge([
            'status' => ReservationStatus::Confirmed,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
        ], $overrides));
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
            'provider_ref' => 'api-success-'.$reservation->id,
            'idempotency_key' => 'api-success-attempt-'.$reservation->id,
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
}
