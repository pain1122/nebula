<?php

namespace App\Services;

use App\Models\DoctorWorkplace;
use App\Models\Reservation;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class SchedulingService
{
    /**
     * @return list<array{0: Carbon, 1: Carbon}>
     */
    public static function buildWorkplaceSlots(
        DoctorWorkplace $workplace,
        Carbon $from,
        Carbon $to,
        int $durationMinutes
    ): array {
        $windows = $workplace->workingWindows()
            ->where('is_active', true)
            ->orderBy('weekday')
            ->orderBy('starts_at')
            ->get();

        $slots = [];

        foreach (CarbonPeriod::create($from->copy()->startOfDay(), '1 day', $to->copy()->endOfDay()) as $date) {
            foreach ($windows->where('weekday', $date->dayOfWeek) as $window) {
                if ($window->effective_from && $date->lt($window->effective_from->startOfDay())) {
                    continue;
                }

                if ($window->effective_until && $date->gt($window->effective_until->endOfDay())) {
                    continue;
                }

                $windowStart = Carbon::parse($date->format('Y-m-d').' '.$window->starts_at);
                $windowEnd = Carbon::parse($date->format('Y-m-d').' '.$window->ends_at);
                $step = $durationMinutes + $window->buffer_minutes;

                for ($cursor = $windowStart->copy(); $cursor->lt($windowEnd); $cursor->addMinutes($step)) {
                    $slotStart = $cursor->copy();
                    $slotEnd = $slotStart->copy()->addMinutes($durationMinutes);

                    if ($slotEnd->gt($windowEnd)) {
                        break;
                    }

                    $slots[] = [$slotStart, $slotEnd];
                }
            }
        }

        return $slots;
    }

    public static function hasConflict(int $doctorProfileId, Carbon $start, Carbon $end): bool
    {
        return Reservation::query()
            ->blocking()
            ->where('doctor_profile_id', $doctorProfileId)
            ->where('starts_at', '<', $end)
            ->where('ends_at', '>', $start)
            ->exists();
    }

    /**
     * @param list<array{0: Carbon, 1: Carbon}> $slots
     * @return list<array{0: Carbon, 1: Carbon}>
     */
    public static function availableSlots(int $doctorProfileId, array $slots): array
    {
        return array_values(array_filter(
            $slots,
            fn (array $slot): bool => ! self::hasConflict($doctorProfileId, $slot[0], $slot[1])
        ));
    }
}
