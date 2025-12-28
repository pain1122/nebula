<?php

namespace App\Services;

use App\Models\Reservation;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class SchedulingService
{
    /**
     * $availability نمونه:
     * [
     *   ['day'=>'sat','slots'=>[['09:00','12:00'],['14:00','17:00']]],
     *   ['day'=>'mon','slots'=>[['10:00','13:00']]],
     * ]
     */
    public static function buildSlots(array $availability, Carbon $from, Carbon $to, int $slotMinutes = 30, int $bufferMinutes = 0): array
    {
        // Carbon: Sun=0 ... Sat=6
        $map = ['sun'=>0,'mon'=>1,'tue'=>2,'wed'=>3,'thu'=>4,'fri'=>5,'sat'=>6];

        // جمع‌آوری بازه‌های هر روز
        $daySlots = [];
        foreach ($availability as $item) {
            $d = strtolower($item['day'] ?? '');
            if (! isset($map[$d]) || empty($item['slots'])) continue;
            $daySlots[$map[$d]] = $item['slots']; // [["09:00","12:00"], ...]
        }

        $out = [];
        foreach (CarbonPeriod::create($from->copy()->startOfDay(), '1 day', $to->copy()->endOfDay()) as $date) {
            $dow = $date->dayOfWeek; // 0..6
            if (! isset($daySlots[$dow])) continue;

            foreach ($daySlots[$dow] as [$startStr, $endStr]) {
                $winStart = Carbon::parse($date->format('Y-m-d') . ' ' . $startStr);
                $winEnd   = Carbon::parse($date->format('Y-m-d') . ' ' . $endStr);

                for ($cursor = $winStart->copy(); $cursor->lt($winEnd); $cursor->addMinutes($slotMinutes + $bufferMinutes)) {
                    $slotStart = $cursor->copy();
                    $slotEnd   = $slotStart->copy()->addMinutes($slotMinutes);
                    if ($slotEnd->gt($winEnd)) break;
                    $out[] = [$slotStart->copy(), $slotEnd->copy()];
                }
            }
        }

        return $out; // آرایه‌ای از [Carbon $start, Carbon $end]
    }

    /** بررسی هم‌پوشانی بازه با رزروهای موجود پزشک */
    public static function hasConflict(int $doctorProfileId, Carbon $start, Carbon $end): bool
    {
        return Reservation::where('doctor_profile_id', $doctorProfileId)
            ->where(function($q) use ($start,$end){
                $q->whereBetween('starts_at', [$start, $end->copy()->subSecond()])
                  ->orWhereBetween('ends_at',   [$start->copy()->addSecond(), $end])
                  ->orWhere(function($q) use ($start,$end){
                      $q->where('starts_at','<=',$start)->where('ends_at','>=',$end);
                  });
            })->exists();
    }

    /** فیلترکردن اسلات‌ها بر اساس تداخل */
    public static function availableSlots(int $doctorProfileId, array $slots): array
    {
        $ok = [];
        foreach ($slots as [$s,$e]) {
            if (! self::hasConflict($doctorProfileId, $s, $e)) $ok[] = [$s,$e];
        }
        return $ok;
    }
}
