<?php

namespace App\Services;

use App\Models\Checkup;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\Reservation;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class SchedulingService
{
    /**
     * Persist every dated occurrence for one recurring rule. Existing occurrences
     * are deliberately preserved so manual price/active overrides are not reset.
     */
    public function materializeRule(DoctorWorkingWindow $rule, Carbon $from, Carbon $to): int
    {
        if (! $rule->is_active || $to->lt($from)) {
            return 0;
        }

        $rule->loadMissing(['breaks', 'workplace.hospital', 'checkup']);
        $service = $rule->workplace->checkups()
            ->whereKey($rule->checkup_id)
            ->wherePivot('is_active', true)
            ->first();

        if (! $service || ! $rule->workplace->is_active || ! $rule->workplace->hospital?->is_active) {
            return 0;
        }

        $runtime = app(GeneralMarketplaceRuntime::class);
        $timezone = $runtime->timezone($rule->workplace->hospital->timezone);
        $price = (int) ($rule->price_override ?? $service->pivot->price_override ?? $rule->workplace->doctorProfile->fee);
        $currency = $runtime->currency($rule->currency_override ?? $service->pivot->currency_override ?? $rule->checkup->currency);
        $created = 0;

        foreach (CarbonPeriod::create($from->copy()->startOfDay(), '1 day', $to->copy()->endOfDay()) as $date) {
            if ($date->dayOfWeek !== $rule->weekday
                || ($rule->effective_from && $date->toDateString() < $rule->effective_from->toDateString())
                || ($rule->effective_until && $date->toDateString() > $rule->effective_until->toDateString())) {
                continue;
            }

            $cursor = Carbon::parse($date->toDateString().' '.$rule->starts_at, $timezone);
            $windowEnd = Carbon::parse($date->toDateString().' '.$rule->ends_at, $timezone);
            $breaks = $rule->breaks
                ->map(fn ($break): array => [
                    'start' => Carbon::parse($date->toDateString().' '.$break->starts_at, $timezone),
                    'end' => Carbon::parse($date->toDateString().' '.$break->ends_at, $timezone),
                ])
                ->sortBy('start')
                ->values();

            while ($cursor->copy()->addMinutes($rule->visit_duration_minutes)->lte($windowEnd)) {
                $slotEnd = $cursor->copy()->addMinutes($rule->visit_duration_minutes);
                $overlappingBreak = $breaks->first(
                    fn (array $break): bool => $cursor->lt($break['end']) && $slotEnd->gt($break['start'])
                );

                if ($overlappingBreak !== null) {
                    $cursor = $overlappingBreak['end']->copy();

                    continue;
                }

                $slot = DoctorVisitSlot::query()->firstOrCreate(
                    [
                        'doctor_working_window_id' => $rule->getKey(),
                        'starts_at' => $cursor->copy()->utc(),
                    ],
                    [
                        'doctor_workplace_id' => $rule->doctor_workplace_id,
                        'checkup_id' => $rule->checkup_id,
                        'ends_at' => $slotEnd->copy()->utc(),
                        'price' => $price,
                        'currency' => $currency,
                        'is_active' => true,
                    ],
                );
                $created += $slot->wasRecentlyCreated ? 1 : 0;
                $cursor = $slotEnd;
            }
        }

        return $created;
    }

    public function materializeActiveRules(Carbon $from, Carbon $to): int
    {
        $created = 0;

        DoctorWorkingWindow::query()
            ->where('is_active', true)
            ->with(['breaks', 'workplace.hospital', 'checkup'])
            ->chunkById(100, function ($rules) use ($from, $to, &$created): void {
                foreach ($rules as $rule) {
                    $created += $this->materializeRule($rule, $from, $to);
                }
            });

        return $created;
    }

    /**
     * @return list<array{slot_id: int, slot_public_id: string, start: Carbon, end: Carbon, price: int, currency: string}>
     */
    public static function buildWorkplaceSlots(
        DoctorWorkplace $workplace,
        Checkup $checkup,
        Carbon $from,
        Carbon $to,
        bool $lockForUpdate = false,
    ): array {
        $query = DoctorVisitSlot::query()
            ->where('doctor_workplace_id', $workplace->getKey())
            ->where('checkup_id', $checkup->getKey())
            ->where('is_active', true)
            ->whereHas('workingWindow', fn ($rule) => $rule->where('is_active', true))
            ->where('starts_at', '>=', $from)
            ->where('starts_at', '<=', $to)
            ->orderBy('starts_at')
            ->orderBy('id');

        if ($lockForUpdate) {
            $query->lockForUpdate();
        }

        return $query->get()->map(fn (DoctorVisitSlot $slot): array => [
            'slot_id' => (int) $slot->getKey(),
            'slot_public_id' => (string) $slot->public_id,
            'start' => $slot->starts_at,
            'end' => $slot->ends_at,
            'price' => (int) $slot->price,
            'currency' => (string) $slot->currency,
        ])->all();
    }

    public static function hasConflict(
        int $doctorProfileId,
        Carbon $start,
        Carbon $end,
        ?int $exceptReservationId = null,
        bool $lockForUpdate = false,
    ): bool {
        $query = Reservation::query()
            ->blocking()
            ->where('doctor_profile_id', $doctorProfileId)
            ->where('starts_at', '<', $end)
            ->where('ends_at', '>', $start);

        if ($exceptReservationId !== null) {
            $query->whereKeyNot($exceptReservationId);
        }

        if ($lockForUpdate) {
            return $query->select('id')->lockForUpdate()->first() !== null;
        }

        return $query->exists();
    }

    /**
     * @param  list<array{slot_id: int, slot_public_id: string, start: Carbon, end: Carbon, price: int, currency: string}>  $slots
     * @return list<array{slot_id: int, slot_public_id: string, start: Carbon, end: Carbon, price: int, currency: string}>
     */
    public static function availableSlots(int $doctorProfileId, array $slots): array
    {
        return array_values(array_filter(
            $slots,
            fn (array $slot): bool => ! self::hasConflict($doctorProfileId, $slot['start'], $slot['end'])
        ));
    }
}
