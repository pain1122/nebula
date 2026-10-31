<?php

namespace Tests\Feature\Api;

use App\Enums\PaymentAdjustmentStatus;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentAdjustmentApiTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    public function test_root_admin_with_recent_password_requests_a_server_owned_adjustment(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();

        $preview = $this->statefulAs($root)->getJson('/api/admin/payments/'.$payment->public_id.'/adjustment-context')->assertOk()->json('data');

        $this->statefulAs($root)
            ->withSession($this->recentPassword())
            ->postJson('/api/admin/payments/'.$payment->public_id.'/adjustments', [
                'type' => 'refund',
                'amount' => 1_000_000,
                'reason' => 'Approved partial refund request',
                'expected_revision' => $preview['revision'],
                'expires_at' => $preview['expires_at'],
                'confirmed' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.payment_public_id', $payment->public_id)
            ->assertJsonPath('data.type', 'refund')
            ->assertJsonPath('data.amount', 1_000_000)
            ->assertJsonPath('data.currency', $payment->currency)
            ->assertJsonPath('data.status', PaymentAdjustmentStatus::Pending->value)
            ->assertJsonMissingPath('data.provider_ref')
            ->assertJsonMissingPath('data.payment_attempt_id');

        $this->assertDatabaseHas('payment_adjustments', [
            'payment_summary_id' => $payment->id,
            'amount' => 1_000_000,
            'currency' => $payment->currency,
            'status' => PaymentAdjustmentStatus::Pending->value,
        ]);
        $this->assertSame(PaymentSummaryStatus::Paid, $payment->fresh()->status);
    }

    public function test_normal_admin_cannot_request_an_adjustment(): void
    {
        $payment = $this->paidPayment();
        $admin = User::factory()->admin()->create();

        $this->statefulAs($admin)
            ->withSession($this->recentPassword())
            ->postJson('/api/admin/payments/'.$payment->public_id.'/adjustments', [
                'type' => 'refund',
                'amount' => 1,
                'reason' => 'Normal admins must be denied',
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_adjustment_requires_recent_password_confirmation(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();

        $this->statefulAs($root)
            ->postJson('/api/admin/payments/'.$payment->public_id.'/adjustments', [
                'type' => 'refund',
                'amount' => 1,
                'reason' => 'No recent password',
            ])
            ->assertStatus(423)
            ->assertJsonPath('errors.password_confirmation.0', 'required');

        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_adjustment_requires_reason_and_rejects_client_owned_financial_facts(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $url = '/api/admin/payments/'.$payment->public_id.'/adjustments';

        $this->statefulAs($root)
            ->withSession($this->recentPassword())
            ->postJson($url, [
                'type' => 'refund',
                'amount' => 1,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->statefulAs($root)
            ->withSession($this->recentPassword())
            ->postJson($url, [
                'type' => 'executed-refund',
                'amount' => 0,
                'reason' => 'Invalid type and amount',
                'currency' => 'USD',
                'status' => 'succeeded',
                'provider_ref' => 'client-controlled',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type', 'amount', 'currency', 'status', 'provider_ref']);

        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    protected function paidPayment(): Payment
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $payment = Payment::query()->create([
            'reservation_id' => $reservation->id,
            'amount' => 5_000_000,
            'currency' => 'IRR',
            'status' => PaymentSummaryStatus::Unpaid,
        ]);
        $attempt = new PaymentAttempt;
        $attempt->forceFill([
            'payment_summary_id' => $payment->id,
            'reservation_id' => $reservation->id,
            'provider' => 'sandbox',
            'provider_ref' => 'adjustment-api-success-'.$reservation->id,
            'idempotency_key' => 'adjustment-api-attempt-'.$reservation->id,
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

        return $payment->fresh();
    }

    /** @return array{auth.password_confirmed_at: int} */
    private function recentPassword(): array
    {
        return ['auth.password_confirmed_at' => time()];
    }

    protected function statefulAs(User $user): static
    {
        return $this->actingAs($user)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }
}
