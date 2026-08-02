<?php

namespace App\Services;

use App\Enums\PaymentAttemptStatus;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use Illuminate\Support\Facades\DB;

class ReservationHoldService
{
    public function expireOverdue(int $limit = 100): int
    {
        $ids = Reservation::query()
            ->where('status', ReservationStatus::Pending)
            ->where('hold_expires_at', '<=', now())
            ->orderBy('id')
            ->limit(max(1, min($limit, 1000)))
            ->pluck('id');
        $expired = 0;

        foreach ($ids as $id) {
            $expired += DB::transaction(function () use ($id): int {
                $reservation = Reservation::query()->lockForUpdate()->find($id);

                if ($reservation === null
                    || $reservation->status !== ReservationStatus::Pending
                    || $reservation->hold_expires_at?->isFuture()) {
                    return 0;
                }

                $reservation->forceFill([
                    'status' => ReservationStatus::Expired,
                    'expired_at' => now(),
                ])->save();
                PaymentAttempt::query()
                    ->where('reservation_id', $reservation->id)
                    ->where('status', PaymentAttemptStatus::Initiated)
                    ->update([
                        'status' => PaymentAttemptStatus::Expired->value,
                        'completed_at' => now(),
                        'updated_at' => now(),
                    ]);

                return 1;
            });
        }

        return $expired;
    }
}
