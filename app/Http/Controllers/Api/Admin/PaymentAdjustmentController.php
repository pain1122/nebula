<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\PaymentAdjustmentType;
use App\Http\Controllers\Api\ApiController;
use App\Models\Payment;
use App\Services\PaymentAdjustmentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentAdjustmentController extends ApiController
{
    public function context(Request $request, Payment $payment, PaymentAdjustmentService $service)
    {
        return $this->successResponse(data: $service->context($request, $payment))->header('Cache-Control', 'no-store, private');
    }

    public function store(
        Request $request,
        Payment $payment,
        PaymentAdjustmentService $service,
    ) {
        $service->authorize($request->user(), $payment);
        abort_if($request->query(), 422);
        $rules = [
            'type' => ['required', Rule::enum(PaymentAdjustmentType::class)],
            'amount' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:1000'],
            'expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
            'expires_at' => ['required', 'integer', 'min:1'],
            'confirmed' => ['required', 'accepted'],
            'currency' => ['prohibited'],
            'status' => ['prohibited'],
            'provider' => ['prohibited'],
            'provider_ref' => ['prohibited'],
            'payment_attempt_id' => ['prohibited'],
            'reservation_id' => ['prohibited'],
        ];
        $input = $request->except(['_token', '_method']);
        if (array_diff(array_keys($input), array_keys($rules))) {
            throw \Illuminate\Validation\ValidationException::withMessages(['fields' => 'Unsupported adjustment fields.']);
        }
        $data = validator($input, $rules)->validate();

        try {
            $adjustment = $service->request(
                $request,
                $request->user(),
                $payment,
                PaymentAdjustmentType::from($data['type']),
                $data['amount'],
                $data['reason'],
                $data['expected_revision'],
                (int) $data['expires_at'],
            );
        } catch (\DomainException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['adjustment' => ['adjustment_rejected']],
            );
        }

        return $this->successResponse(
            data: [
                'public_id' => $adjustment->public_id,
                'payment_public_id' => $payment->public_id,
                'type' => $adjustment->type->value,
                'amount' => $adjustment->amount,
                'amount_exact' => (string) $adjustment->amount,
                'request_only' => true,
                'currency' => $adjustment->currency,
                'status' => $adjustment->status->value,
                'created_at' => $adjustment->created_at?->toISOString(),
            ],
            message: 'Payment adjustment requested.',
            status: 201,
        )->header('Cache-Control', 'no-store, private');
    }
}
