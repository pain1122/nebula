<?php

namespace App\Services;

use App\Enums\PaymentAdjustmentStatus;
use App\Enums\PaymentAdjustmentType;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAdjustment;
use App\Models\User;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class PaymentAdjustmentService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function request(
        Request $request,
        User $actor,
        Payment $payment,
        PaymentAdjustmentType $type,
        int $amount,
        string $reason,
    ): PaymentAdjustment {
        Gate::forUser($actor)->authorize('requestAdjustment', $payment);
        $reason = trim($reason);

        if ($amount <= 0 || $reason === '') {
            throw new InvalidArgumentException('A positive amount and reason are required.');
        }

        return DB::transaction(function () use ($request, $actor, $payment, $type, $amount, $reason): PaymentAdjustment {
            $lockedPayment = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());

            if ($lockedPayment->status !== PaymentSummaryStatus::Paid
                || $lockedPayment->successful_attempt_id === null) {
                throw new DomainException('Only a verified paid payment can be adjusted.');
            }

            $reservedAmount = PaymentAdjustment::query()
                ->where('payment_summary_id', $lockedPayment->id)
                ->whereIn('status', [
                    PaymentAdjustmentStatus::Pending->value,
                    PaymentAdjustmentStatus::Succeeded->value,
                ])
                ->sum('amount');
            $remainingAmount = $lockedPayment->amount - $reservedAmount;

            if ($amount > $remainingAmount
                || ($type === PaymentAdjustmentType::Void && $amount !== $remainingAmount)) {
                throw new DomainException('Adjustment exceeds the unadjusted payment amount.');
            }

            $adjustment = new PaymentAdjustment;
            $adjustment->forceFill([
                'payment_summary_id' => $lockedPayment->id,
                'payment_attempt_id' => $lockedPayment->successful_attempt_id,
                'actor_id' => $actor->id,
                'type' => $type,
                'amount' => $amount,
                'currency' => $lockedPayment->currency,
                'status' => PaymentAdjustmentStatus::Pending,
                'reason' => $reason,
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'admin.payment.adjustment_requested',
                subject: $adjustment,
                riskLevel: 'critical',
                before: null,
                after: [
                    'payment_public_id' => $lockedPayment->public_id,
                    'type' => $type->value,
                    'amount' => $amount,
                    'currency' => $lockedPayment->currency,
                    'status' => PaymentAdjustmentStatus::Pending->value,
                ],
                reason: $reason,
            );

            return $adjustment;
        });
    }
}
