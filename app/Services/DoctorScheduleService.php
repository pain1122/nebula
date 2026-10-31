<?php

namespace App\Services;

use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use Carbon\Carbon;
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

    public function __construct(private readonly SchedulingService $schedulingService) {}

    /**
     * @param  list<array{day: string, windows: list<array{checkup_id: int, start: string, end: string, duration_minutes: int, price_override?: int|null, currency_override?: string|null, effective_from?: string|null, effective_until?: string|null, breaks?: list<array{start: string, end: string}>}>}>  $availability
     */
    public function replaceWeeklyRules(DoctorWorkplace $workplace, array $availability): void
    {
        DB::transaction(function () use ($workplace, $availability): void {
            $lockedWorkplace = DoctorWorkplace::query()
                ->whereKey($workplace->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedWorkplace->is_active
                || ! $lockedWorkplace->hospital()
                    ->where('is_active', true)
                    ->whereNull('archived_at')
                    ->exists()) {
                throw ValidationException::withMessages(['availability' => ['workplace_not_active']]);
            }

            $offeredCheckupIds = $lockedWorkplace->checkups()
                ->wherePivot('is_active', true)
                ->pluck('checkups.id')
                ->map(fn ($id): int => (int) $id)
                ->all();
            $rules = $this->normalizeRules($availability, $offeredCheckupIds);

            $this->assertWorkingWindowsDoNotOverlap($rules);

            $existingRules = $lockedWorkplace->workingWindows()
                ->where('is_active', true)
                ->lockForUpdate()
                ->get();

            foreach ($existingRules as $existingRule) {
                $existingRule->forceFill([
                    'is_active' => false,
                ])->save();

                $existingRule->visitSlots()
                    ->where('starts_at', '>', now())
                    ->whereDoesntHave('reservations')
                    ->lockForUpdate()
                    ->get()
                    ->each->update(['is_active' => false]);
            }

            foreach ($rules as $ruleData) {
                $breaks = $ruleData['breaks'];
                unset($ruleData['breaks']);

                /** @var DoctorWorkingWindow $rule */
                $rule = $lockedWorkplace->workingWindows()->create($ruleData);
                $rule->breaks()->createMany($breaks);
                $this->schedulingService->materializeRule(
                    $rule->fresh(['breaks', 'workplace.hospital', 'checkup']),
                    Carbon::today(),
                    Carbon::today()->addDays((int) config('scheduling.materialization_days', 90)),
                );
            }
        });
    }

    /**
     * @param  list<array{day: string, windows: list<array<string, mixed>>}>  $availability
     * @param  list<int>  $offeredCheckupIds
     * @return list<array<string, mixed>>
     */
    private function normalizeRules(array $availability, array $offeredCheckupIds): array
    {
        $rules = [];

        foreach ($availability as $day) {
            $weekday = self::WEEKDAYS[strtolower($day['day'])] ?? null;

            if ($weekday === null) {
                throw ValidationException::withMessages(['availability' => ['invalid_weekday']]);
            }

            foreach ($day['windows'] as $window) {
                $checkupId = (int) $window['checkup_id'];
                $duration = (int) $window['duration_minutes'];
                $breaks = $window['breaks'] ?? [];

                if (! in_array($checkupId, $offeredCheckupIds, true)) {
                    throw ValidationException::withMessages(['availability' => ['checkup_not_offered_at_workplace']]);
                }

                if ($window['start'] >= $window['end']) {
                    throw ValidationException::withMessages(['availability' => ['invalid_working_window']]);
                }

                if ($duration < 5 || $duration > 720) {
                    throw ValidationException::withMessages(['availability' => ['invalid_visit_duration']]);
                }

                if (($window['currency_override'] ?? null) !== null && ($window['price_override'] ?? null) === null) {
                    throw ValidationException::withMessages(['availability' => ['schedule_currency_requires_price']]);
                }

                if (($window['effective_from'] ?? null) !== null
                    && ($window['effective_until'] ?? null) !== null
                    && $window['effective_from'] > $window['effective_until']) {
                    throw ValidationException::withMessages(['availability' => ['invalid_effective_range']]);
                }

                $this->assertBreaksAreValid($window['start'], $window['end'], $breaks);
                $rules[] = [
                    'weekday' => $weekday,
                    'checkup_id' => $checkupId,
                    'starts_at' => $window['start'],
                    'ends_at' => $window['end'],
                    'visit_duration_minutes' => $duration,
                    'price_override' => $window['price_override'] ?? null,
                    'currency_override' => isset($window['currency_override'])
                        ? strtoupper($window['currency_override'])
                        : null,
                    'effective_from' => $window['effective_from'] ?? null,
                    'effective_until' => $window['effective_until'] ?? null,
                    'breaks' => array_map(fn (array $break): array => [
                        'starts_at' => $break['start'],
                        'ends_at' => $break['end'],
                    ], $breaks),
                ];
            }
        }

        return $rules;
    }

    /** @param list<array{start: string, end: string}> $breaks */
    private function assertBreaksAreValid(string $windowStart, string $windowEnd, array $breaks): void
    {
        usort($breaks, fn (array $left, array $right): int => [$left['start'], $left['end']] <=> [$right['start'], $right['end']]);
        $previousEnd = null;

        foreach ($breaks as $break) {
            if ($break['start'] >= $break['end']
                || $break['start'] < $windowStart
                || $break['end'] > $windowEnd) {
                throw ValidationException::withMessages(['availability' => ['invalid_break_window']]);
            }

            if ($previousEnd !== null && $break['start'] < $previousEnd) {
                throw ValidationException::withMessages(['availability' => ['overlapping_breaks']]);
            }

            $previousEnd = $break['end'];
        }
    }

    /** @param list<array<string, mixed>> $rules */
    private function assertWorkingWindowsDoNotOverlap(array $rules): void
    {
        usort($rules, fn (array $left, array $right): int => [
            $left['weekday'],
            $left['starts_at'],
            $left['ends_at'],
        ] <=> [
            $right['weekday'],
            $right['starts_at'],
            $right['ends_at'],
        ]);
        $previous = null;

        foreach ($rules as $rule) {
            if ($previous !== null
                && $previous['weekday'] === $rule['weekday']
                && $rule['starts_at'] < $previous['ends_at']) {
                throw ValidationException::withMessages(['availability' => ['overlapping_working_windows']]);
            }

            $previous = $rule;
        }
    }
}
