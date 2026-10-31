<?php

namespace Tests\Feature\Api;

use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\LocalSandboxPaymentGateway;
use App\Services\OutboxPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class LocalSandboxPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['demo.sandbox_payments_enabled' => true]);
    }

    public function test_checkout_and_verified_success_are_idempotent_and_keep_server_money(): void
    {
        [$reservation, $payment] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $this->getJson('/api/my/reservations')->assertOk()->assertJsonPath('data.data.0.can_sandbox_checkout', true);
        $first = $this->start($reservation)->assertOk()->assertJsonPath('data.amount', (int) $payment->amount)
            ->assertJsonPath('data.currency', $payment->currency)->assertJsonMissingPath('data.signature');
        $attemptId = $first->json('data.attempt_public_id');
        $this->start($reservation)->assertOk()->assertJsonPath('data.attempt_public_id', $attemptId);
        $this->finish($reservation, $attemptId, 'success')->assertOk()
            ->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.reservation_status', 'confirmed');
        $this->finish($reservation, $attemptId, 'failed')->assertOk()->assertJsonPath('data.attempt_status', 'succeeded');
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertDatabaseCount('payment_provider_events', 1);
        $this->assertDatabaseHas('payment_provider_events', ['signature_verified' => true, 'event_type' => 'payment.succeeded']);
        $this->assertSame(PaymentAttempt::query()->sole()->id, $payment->fresh()->successful_attempt_id);
        $this->assertTrue($reservation->fresh()->hold_expires_at->equalTo($reservation->hold_expires_at));
        $this->getJson('/api/my/reservations')->assertOk()->assertJsonPath('data.data.0.can_sandbox_checkout', false);
    }

    public function test_failed_checkout_can_retry_with_a_new_attempt_without_extending_hold(): void
    {
        [$reservation] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $first = $this->start($reservation)->assertOk()->json('data.attempt_public_id');
        $this->finish($reservation, $first, 'failed')->assertOk()->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.reservation_status', 'pending');
        $this->finish($reservation, $first, 'success')->assertOk()->assertJsonPath('data.attempt_status', 'failed');
        $second = $this->start($reservation, 'new-attempt-key')->assertOk()->json('data.attempt_public_id');
        $this->assertNotSame($first, $second);
        $this->finish($reservation, $second, 'success')->assertOk()->assertJsonPath('data.payment_status', 'paid');
        $this->assertDatabaseCount('payment_attempts', 2);
        $this->assertDatabaseCount('payment_provider_events', 2);
        $this->assertDatabaseCount('outbox_events', 2);
        $this->assertTrue($reservation->fresh()->hold_expires_at->equalTo($reservation->hold_expires_at));
    }

    public function test_patient_cannot_supply_trusted_payment_facts_or_an_invalid_key(): void
    {
        [$reservation] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $this->withHeader('Idempotency-Key', 'valid-attempt-key')->postJson($this->path($reservation), [
            'amount' => 1, 'currency' => 'USD', 'provider' => 'stripe', 'user_id' => 999,
            'hold_expires_at' => now()->addYear()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors(['amount', 'currency', 'provider', 'user_id', 'hold_expires_at']);
        $this->start($reservation, 'short')->assertUnprocessable();
        $this->assertDatabaseCount('payment_attempts', 0);
        $attempt = $this->start($reservation)->assertOk()->json('data.attempt_public_id');
        $this->postJson($this->path($reservation, $attempt), ['outcome' => 'success', 'signature' => 'forged'])
            ->assertUnprocessable()->assertJsonValidationErrors('signature');
        $this->finish($reservation, $attempt, 'paid')->assertUnprocessable();
        $this->assertDatabaseCount('payment_provider_events', 0);
    }

    public function test_guests_other_patients_doctors_and_admins_cannot_checkout(): void
    {
        [$reservation] = $this->fixture();
        $this->start($reservation)->assertUnauthorized();
        Sanctum::actingAs(User::factory()->patient()->create());
        $this->start($reservation)->assertNotFound();
        Sanctum::actingAs(User::factory()->doctor()->create());
        $this->start($reservation)->assertForbidden();
        Sanctum::actingAs(User::factory()->admin()->create());
        $this->start($reservation)->assertForbidden();
        $this->assertDatabaseCount('payment_attempts', 0);
    }

    public function test_an_attempt_from_another_reservation_is_not_accessible(): void
    {
        [$first] = $this->fixture();
        Sanctum::actingAs($first->user);
        $attempt = $this->start($first)->assertOk()->json('data.attempt_public_id');
        [$second] = $this->fixture();
        Sanctum::actingAs($second->user);
        $this->finish($second, $attempt, 'success')->assertNotFound();
        $this->finish($first, $attempt, 'success')->assertNotFound();
        $this->assertDatabaseCount('payment_provider_events', 0);
    }

    public function test_disabled_and_production_runtime_never_offer_sandbox_checkout(): void
    {
        [$reservation] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        config(['demo.sandbox_payments_enabled' => false]);
        $this->start($reservation)->assertNotFound();
        $this->getJson('/api/my/reservations')->assertOk()->assertJsonPath('data.data.0.can_sandbox_checkout', false);
        config(['demo.sandbox_payments_enabled' => true]);
        app()->instance('env', 'production');
        $this->start($reservation)->assertNotFound();
        $this->assertFalse(LocalSandboxPaymentGateway::enabled());
        $this->assertDatabaseCount('payment_attempts', 0);
    }

    public function test_expired_hold_rejects_new_checkout_and_late_success_is_reconciled(): void
    {
        [$reservation, $payment] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $attempt = $this->start($reservation)->assertOk()->json('data.attempt_public_id');
        $this->travelTo($reservation->hold_expires_at->copy()->addSecond());
        $this->start($reservation, 'late-new-attempt')->assertUnprocessable();
        $this->finish($reservation, $attempt, 'success')->assertOk()
            ->assertJsonPath('data.attempt_status', 'reconciliation')->assertJsonPath('data.reservation_status', 'expired');
        $this->assertSame(PaymentSummaryStatus::Reconciliation, $payment->fresh()->status);
        $this->assertNull($payment->fresh()->successful_attempt_id);
        $this->assertDatabaseCount('payment_attempts', 1);
    }

    public function test_signature_binds_attempt_amount_currency_and_outcome(): void
    {
        $gateway = app(LocalSandboxPaymentGateway::class);
        $payload = ['attempt_public_id' => 'attempt-a', 'amount' => 100, 'currency' => 'IRR', 'result_code' => 'sandbox_ok'];
        $signature = $gateway->signCallback($payload);
        $this->assertTrue($gateway->verifyCallback($payload, $signature));
        foreach (['amount' => 1, 'currency' => 'USD', 'attempt_public_id' => 'attempt-b', 'result_code' => 'sandbox_failed'] as $key => $value) {
            $this->assertFalse($gateway->verifyCallback([...$payload, $key => $value], $signature));
        }
        $this->assertFalse($gateway->verifyCallback($payload, 'invalid'));
    }

    public function test_failed_outbox_publication_rolls_back_checkout(): void
    {
        [$reservation] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $publisher = Mockery::mock(OutboxPublisher::class);
        $publisher->shouldReceive('marketplace')->once()->andThrow(new \RuntimeException('Publication failure'));
        $this->app->instance(OutboxPublisher::class, $publisher);
        $this->start($reservation)->assertStatus(500);
        $this->assertDatabaseCount('payment_attempts', 0);
        $this->assertSame(ReservationStatus::Pending, $reservation->fresh()->status);
    }

    public function test_signature_verification_failure_cannot_confirm_a_checkout(): void
    {
        [$reservation, $payment] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $attempt = $this->start($reservation)->assertOk()->json('data.attempt_public_id');
        $gateway = Mockery::mock(LocalSandboxPaymentGateway::class)->makePartial();
        $gateway->shouldReceive('verifyCallback')->once()->andReturnFalse();
        $this->app->instance(LocalSandboxPaymentGateway::class, $gateway);
        $this->finish($reservation, $attempt, 'success')->assertUnprocessable();
        $this->assertSame(PaymentSummaryStatus::Unpaid, $payment->fresh()->status);
        $this->assertNull($payment->fresh()->successful_attempt_id);
        $this->assertSame(ReservationStatus::Pending, $reservation->fresh()->status);
        $this->assertDatabaseCount('payment_provider_events', 0);
    }

    public function test_competing_success_keeps_one_canonical_payment_and_confirms_only_once(): void
    {
        [$reservation, $payment] = $this->fixture();
        Sanctum::actingAs($reservation->user);
        $first = $this->start($reservation)->assertOk()->json('data.attempt_public_id');
        $second = $this->start($reservation, 'competing-attempt')->assertOk()->json('data.attempt_public_id');
        $this->finish($reservation, $first, 'success')->assertOk();
        $this->finish($reservation, $second, 'success')->assertOk()
            ->assertJsonPath('data.attempt_status', 'reconciliation')->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.reservation_status', 'confirmed');
        $this->assertSame(PaymentAttempt::query()->where('public_id', $first)->sole()->id, $payment->fresh()->successful_attempt_id);
        $this->assertDatabaseCount('payment_provider_events', 2);
    }

    private function fixture(): array
    {
        $reservation = Reservation::factory()->create();
        $payment = Payment::query()->create([
            'reservation_id' => $reservation->id, 'amount' => $reservation->price_snapshot,
            'currency' => $reservation->currency_snapshot,
        ]);

        return [$reservation, $payment];
    }

    private function path(Reservation $reservation, ?string $attempt = null): string
    {
        return '/api/reservations/'.$reservation->public_id.'/sandbox/'
            .($attempt === null ? 'checkout' : 'attempts/'.$attempt.'/complete');
    }

    private function start(Reservation $reservation, string $key = 'stable-attempt-key')
    {
        return $this->withHeader('Idempotency-Key', $key)->postJson($this->path($reservation));
    }

    private function finish(Reservation $reservation, string $attempt, string $outcome)
    {
        return $this->postJson($this->path($reservation, $attempt), ['outcome' => $outcome]);
    }
}
