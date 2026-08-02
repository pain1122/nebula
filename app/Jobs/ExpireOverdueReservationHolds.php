<?php

namespace App\Jobs;

use App\Services\ReservationHoldService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ExpireOverdueReservationHolds implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function handle(ReservationHoldService $holds): void
    {
        $expired = $holds->expireOverdue();

        Log::info('reservation_holds.expired', ['count' => $expired]);
    }
}
