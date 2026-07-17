<?php

namespace App\Services;

use App\Models\DoctorWorkplace;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DoctorScheduleService
{
    private const WEEKDAYS = [
        'sun' => 0,
        'mon' => 1,
        'tue' => 2,
        'wed' => 3,
        'thu' => 4,
        'fri' => 5,
        'sat' => 6,
    ];

    /**
     * @param list<array{day: string, slots: list<array{0: string, 1: string}>}> $availability
     */
    public function replaceFromLegacyInput(DoctorWorkplace $workplace, array $availability): void
    {
        DB::transaction(function () use ($workplace, $availability): void {
            $workplace->workingWindows()->delete();

            foreach ($availability as $day) {
                $weekday = self::WEEKDAYS[strtolower($day['day'])] ?? null;

                if ($weekday === null) {
                    throw ValidationException::withMessages(['availability' => ['invalid_weekday']]);
                }

                foreach ($day['slots'] as $slot) {
                    if ($slot[0] >= $slot[1]) {
                        throw ValidationException::withMessages(['availability' => ['invalid_time_window']]);
                    }

                    $workplace->workingWindows()->create([
                        'weekday' => $weekday,
                        'starts_at' => $slot[0],
                        'ends_at' => $slot[1],
                        'slot_duration_minutes' => 30,
                        'buffer_minutes' => 0,
                    ]);
                }
            }
        });
    }
}
