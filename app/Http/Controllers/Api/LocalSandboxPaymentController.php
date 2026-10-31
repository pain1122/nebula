<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentAttemptStatus;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Services\LocalSandboxPaymentGateway;
use App\Services\LocalSandboxPaymentService;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LocalSandboxPaymentController extends ApiController
{
    public function start(Request $request, Reservation $reservation, LocalSandboxPaymentService $service)
    {
        $this->authorizeOwner($request, $reservation);
        $request->validate($this->prohibitedFacts());
        $key = (string) $request->header('Idempotency-Key');
        if (! preg_match('/^[A-Za-z0-9._:-]{8,100}$/', $key)) {
            throw ValidationException::withMessages(['payment' => ['invalid_attempt_identity']]);
        }

        try {
            $attempt = $service->start($reservation, $key);
        } catch (DomainException $exception) {
            return $this->errorResponse($exception->getMessage(), 422, ['payment' => ['checkout_rejected']]);
        }

        return $this->successResponse($this->checkout($reservation, $attempt));
    }

    public function complete(Request $request, Reservation $reservation, PaymentAttempt $attempt, LocalSandboxPaymentService $service)
    {
        $this->authorizeOwner($request, $reservation);
        abort_unless($attempt->reservation_id === $reservation->id && $attempt->provider === 'sandbox', 404);
        $data = $request->validate([
            ...$this->prohibitedFacts(),
            'outcome' => ['required', Rule::in(['success', 'failed'])],
        ]);

        try {
            $attempt = $service->complete($reservation, $attempt, $data['outcome']);
        } catch (DomainException $exception) {
            return $this->errorResponse($exception->getMessage(), 422, ['payment' => ['callback_rejected']]);
        }

        return $this->successResponse($this->checkout($reservation, $attempt));
    }

    private function authorizeOwner(Request $request, Reservation $reservation): void
    {
        abort_unless(LocalSandboxPaymentGateway::enabled(), 404);
        abort_unless($reservation->user_id === $request->user()->id, 404);
    }

    private function prohibitedFacts(): array
    {
        return array_fill_keys([
            'amount', 'currency', 'provider', 'provider_ref', 'signature', 'external_event_id',
            'status', 'user_id', 'payment_summary_id', 'succeeded',
            'hold_expires_at', 'expires_at', 'reservation_id', 'paid_at', 'idempotency_key',
        ], ['prohibited']);
    }

    private function checkout(Reservation $reservation, PaymentAttempt $attempt): array
    {
        $reservation->refresh()->load('payment');

        return [
            'reservation_public_id' => $reservation->public_id,
            'reservation_status' => $reservation->status->value,
            'payment_status' => $reservation->payment->status->value,
            'attempt_public_id' => $attempt->public_id,
            'attempt_status' => $attempt->status->value,
            'amount' => (int) $attempt->amount,
            'currency' => $attempt->currency,
            'hold_expires_at' => $attempt->expires_at?->toIso8601String(),
            'can_complete' => $attempt->status === PaymentAttemptStatus::Initiated
                && LocalSandboxPaymentService::available($reservation),
        ];
    }
}
