<?php

namespace App\Services;

use App\Enums\PaymentAdjustmentStatus;
use App\Enums\PaymentAdjustmentType;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Models\PaymentAdjustment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\User;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class PaymentAdjustmentService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function authorize(User $user, Payment $payment): User
    {
        $actor = $this->actor($user);
        Gate::forUser($actor)->authorize('requestAdjustment', $payment);

        return $actor;
    }

    public function context(Request $request, Payment $payment): array
    {
        $actor = $this->authorize($request->user(), $payment);
        if (array_diff(array_keys($request->query()), ['expires_at'])) {
            abort(422, 'Unsupported adjustment context fields.');
        }
        $input = validator($request->query(), ['expires_at' => ['sometimes', 'integer', 'min:1']])->validate();
        $expires = (int) ($input['expires_at'] ?? now()->addMinutes(5)->timestamp);
        abort_unless($expires > now()->timestamp && $expires <= now()->addMinutes(5)->timestamp, 409, 'Adjustment preview expired.');
        $state = $this->state($actor, $payment, false);
        $this->owners($actor, $state['reservation'], false);
        $this->sameAuthority($actor, $this->actor($request->user()));

        return ['payment_public_id' => (string) $state['payment']->public_id, 'revision' => $this->revision($state, $actor, $expires), 'expires_at' => $expires,
            'can_request' => $state['blocked'] === null, 'blocked' => $state['blocked'], 'amount' => (string) $state['payment']->amount,
            'currency' => $state['payment']->currency, 'remaining_amount' => (string) $state['remaining'], 'request_only' => true,
            'limits' => ['max_amount' => (string) PHP_INT_MAX, 'reason' => 1000]];
    }

    public function request(
        Request $request,
        User $actor,
        Payment $payment,
        PaymentAdjustmentType $type,
        int $amount,
        string $reason,
        ?string $expectedRevision = null,
        ?int $expiresAt = null,
    ): PaymentAdjustment {
        $initial = $this->authorize($actor, $payment);
        $reason = trim($reason);

        if ($amount <= 0 || $reason === '') {
            throw new InvalidArgumentException('A positive amount and reason are required.');
        }

        return DB::transaction(function () use ($request, $initial, $actor, $payment, $type, $amount, $reason, $expectedRevision, $expiresAt): PaymentAdjustment {
            $actor = $this->actor($actor, true);
            $this->sameAuthority($initial, $actor);
            Gate::forUser($actor)->authorize('requestAdjustment', $payment);
            $state = $this->state($actor, $payment, true);
            $lockedPayment = $state['payment'];
            if ($expectedRevision !== null) {
                abort_unless($expiresAt !== null && $expiresAt > now()->timestamp && $expiresAt <= now()->addMinutes(5)->timestamp
                    && hash_equals($this->revision($state, $actor, $expiresAt), $expectedRevision), 409, 'Payment changed or preview expired; refresh before requesting.');
            }
            if ($state['blocked'] !== null) {
                throw new DomainException('The recorded payment is not eligible for an adjustment request.');
            }
            $remainingAmount = $state['remaining'];

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
            $this->owners($actor, $state['reservation'], true);
            $this->sameAuthority($actor, $this->actor($actor, true));

            return $adjustment;
        }, 3);
    }

    private function state(User $actor, Payment $payment, bool $lock): array
    {
        $query = Payment::whereKey($payment->id);
        $summary = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        // Preserve the callback serialization order: summary -> reservation -> attempt.
        $query = Reservation::whereKey($summary->reservation_id);
        $reservation = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        $query = PaymentAttempt::whereKey($summary->successful_attempt_id);
        $attempt = ($lock ? $query->lockForUpdate() : $query)->first();
        $this->owners($actor, $reservation, $lock);
        $query = PaymentAdjustment::where('payment_summary_id', $summary->id)->orderBy('id')->limit(1001);
        $adjustments = ($lock ? $query->lockForUpdate() : $query)->get();
        abort_if($adjustments->count() > 1000, 503, 'Adjustment history exceeds the safe context bound.');
        $total = $this->integerAmount($summary->getRawOriginal('amount'));
        $blocked = null;
        if ($summary->status !== PaymentSummaryStatus::Paid) {
            $blocked = 'payment_not_paid';
        } elseif (! $attempt || $attempt->status !== PaymentAttemptStatus::Succeeded || $attempt->payment_summary_id !== $summary->id
            || $attempt->reservation_id !== $summary->reservation_id || $attempt->currency !== $summary->currency
            || (string) $attempt->amount !== (string) $summary->amount || $attempt->provider !== $summary->provider) {
            $blocked = 'canonical_inconsistent';
        } elseif ($total === null || $total <= 0 || preg_match('/\A[A-Z]{3}\z/', (string) $summary->currency) !== 1) {
            $blocked = 'amount_unavailable';
        }
        $reserved = 0;
        foreach ($adjustments as $row) {
            $status = PaymentAdjustmentStatus::tryFrom($row->getRawOriginal('status'));
            $value = $this->integerAmount($row->getRawOriginal('amount'));
            if ($status === null || $value === null || $value <= 0 || $row->currency !== $summary->currency
                || $row->payment_attempt_id !== $summary->successful_attempt_id || ! PaymentAdjustmentType::tryFrom($row->getRawOriginal('type'))
                || $status === PaymentAdjustmentStatus::Reconciliation) {
                $blocked ??= 'adjustment_history_inconsistent';

                continue;
            }
            if (in_array($status, [PaymentAdjustmentStatus::Pending, PaymentAdjustmentStatus::Succeeded], true)) {
                if ($total === null || $value > $total - $reserved) {
                    $blocked ??= 'adjustment_history_inconsistent';
                } else {
                    $reserved += $value;
                }
            }
        }
        $remaining = $total === null ? 0 : $total - $reserved;
        if ($remaining <= 0) {
            $blocked ??= 'nothing_remaining';
        }

        return ['payment' => $summary, 'reservation' => $reservation, 'attempt' => $attempt, 'adjustments' => $adjustments,
            'remaining' => max(0, $remaining), 'blocked' => $blocked];
    }

    private function integerAmount(mixed $value): ?int
    {
        if ((! is_int($value) && ! is_string($value)) || preg_match('/\A(?:0|[1-9][0-9]{0,18})\z/', (string) $value) !== 1) {
            return null;
        }
        $value = (string) $value;
        if (strlen($value) === strlen((string) PHP_INT_MAX) && strcmp($value, (string) PHP_INT_MAX) > 0) {
            return null;
        }

        return (int) $value;
    }

    private function owners(User $actor, Reservation $reservation, bool $lock): void
    {
        $query = DoctorProfile::withTrashed()->whereKey($reservation->doctor_profile_id);
        $doctor = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        foreach (array_unique([$reservation->user_id, $doctor->user_id]) as $id) {
            $query = User::whereKey($id);
            $owner = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
            if ($lock) {
                DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $id)->orderBy('role_id')->lockForUpdate()->get();
            }
            $roles = $owner->roles();
            $owner->setRelation('roles', $lock ? $roles->lockForUpdate()->get() : $roles->get());
            abort_if(! $owner->is($actor) && $owner->hasAnyRole(['admin', 'root-admin']), 404);
        }
    }

    private function actor(User $user, bool $lock = false): User
    {
        $query = User::whereKey($user->id);
        $actor = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        if ($lock) {
            DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $actor->id)->orderBy('role_id')->lockForUpdate()->get();
        }
        $roles = $actor->roles();
        $actor->setRelation('roles', $lock ? $roles->lockForUpdate()->get() : $roles->get());
        if (! $actor->permitsAuthentication() || ! $actor->isRootAdmin()) {
            throw new AuthorizationException;
        }

        return $actor;
    }

    private function sameAuthority(User $before, User $after): void
    {
        abort_unless($before->roles->pluck('name')->sort()->values()->all() === $after->roles->pluck('name')->sort()->values()->all(), 403);
    }

    private function revision(array $state, User $actor, int $expires): string
    {
        return hash_hmac('sha256', json_encode([$actor->id, $actor->roles->pluck('name')->sort()->values()->all(), $expires,
            $state['payment']->only(['id', 'public_id', 'reservation_id', 'amount', 'currency', 'status', 'provider', 'successful_attempt_id', 'paid_at', 'refunded_at', 'updated_at']),
            $state['reservation']->only(['id', 'user_id', 'doctor_profile_id', 'status', 'updated_at']),
            $state['attempt']?->only(['id', 'public_id', 'payment_summary_id', 'reservation_id', 'amount', 'currency', 'provider', 'status', 'updated_at']),
            $state['adjustments']->map(fn ($row) => $row->only(['id', 'public_id', 'payment_attempt_id', 'amount', 'currency', 'type', 'status', 'updated_at'])),
            $state['remaining'], $state['blocked'],
        ], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }
}
