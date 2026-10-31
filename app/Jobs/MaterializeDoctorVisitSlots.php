<?php

namespace App\Jobs;

use App\Services\SchedulingService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class MaterializeDoctorVisitSlots implements ShouldQueue
{
    use Queueable;

    public function handle(SchedulingService $schedulingService): void
    {
        $schedulingService->materializeActiveRules(
            now()->startOfDay(),
            now()->addDays((int) config('scheduling.materialization_days', 90))->endOfDay(),
        );
    }
}
