<?php

namespace Tests\Feature\Services;

use App\Enums\PaymentAdjustmentStatus;
use App\Enums\PaymentAdjustmentType;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\AuditEvent;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\PaymentAdjustmentService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class PaymentAdjustmentServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_admin_reserves_refund_and_void_amounts_with_server_owned_money(): void
    {
        [$payment] = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $service = app(PaymentAdjustmentService::class);

        $refund = $service->request(
            $this->requestAs($root),
            $root,
            $payment,
            PaymentAdjustmentType::Refund,
            2_000_000,
            'Patient-approved partial refund',
        );
        $void = $service->request(
            $this->requestAs($root),
            $root,
            $payment,
            PaymentAdjustmentType::Void,
            3_000_000,
            'Void the remaining captured amount',
        );

        $this->assertSame(PaymentAdjustmentStatus::Pending, $refund->status);
        $this->assertSame('IRR', $refund->currency);
        $this->assertSame(PaymentAdjustmentType::Void, $void->type);
        $this->assertDatabaseCount('payment_adjustments', 2);
        $this->assertDatabaseCount('audit_events', 2);
        $event = AuditEvent::query()->firstOrFail();
        $this->assertSame('admin.payment.adjustment_requested', $event->action);
        $this->assertSame(2_000_000, $event->after['amount']);
        $this->assertArrayNotHasKey('provider_ref', $event->after);
    }

    public function test_adjustment_rejects_non_root_unverified_payment_and_over_reservation(): void
    {
        [$payment] = $this->paidPayment();
        $admin = User::factory()->admin()->create();
        $service = app(PaymentAdjustmentService::class);

        try {
            $service->request(
                $this->requestAs($admin),
                $admin,
                $payment,
                PaymentAdjustmentType::Refund,
                1,
                'Unauthorized',
            );
            $this->fail('Normal admin must not request payment adjustments.');
        } catch (AuthorizationException) {
            $this->assertDatabaseCount('payment_adjustments', 0);
        }

        $root = User::factory()->rootAdmin()->create();
        $this->expectException(DomainException::class);
        $service->request(
            $this->requestAs($root),
            $root,
            $payment,
            PaymentAdjustmentType::Refund,
            $payment->amount + 1,
            'Amount exceeds payment',
        );
    }

    public function test_audit_failure_rolls_back_adjustment_request(): void
    {
        [$payment] = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(PaymentAdjustmentService::class)->request(
                $this->requestAs($root),
                $root,
                $payment,
                PaymentAdjustmentType::Refund,
                1_000_000,
                'Must roll back',
            );
            $this->fail('Audit failure must escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertDatabaseCount('payment_adjustments', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    /** @return array{0: Payment, 1: PaymentAttempt} */
    private function paidPayment(): array
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
            'provider_ref' => 'paid-reference',
            'idempotency_key' => 'paid-attempt-key',
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'status' => PaymentAttemptStatus::Succeeded,
            'initiated_at' => now()->subMinute(),
            'completed_at' => now(),
        ])->save();
        $payment->forceFill([
            'status' => PaymentSummaryStatus::Paid,
            'successful_attempt_id' => $attempt->id,
            'provider' => 'sandbox',
            'provider_ref' => 'paid-reference',
            'paid_at' => now(),
        ])->save();

        return [$payment->fresh(), $attempt];
    }

    private function requestAs(User $user): Request
    {
        $request = Request::create('/api/admin/payments/adjustments', 'POST');
        $request->setUserResolver(fn (): User => $user);

        return $request;
    }
}
