<?php

namespace Database\Factories;

use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use Illuminate\Database\Eloquent\Factories\Factory;

class DoctorVisitSlotFactory extends Factory
{
    protected $model = DoctorVisitSlot::class;

    public function definition(): array
    {
        $startsAt = now()->addDays(fake()->numberBetween(2, 20))->startOfHour();

        return [
            'doctor_working_window_id' => DoctorWorkingWindow::factory(),
            'doctor_workplace_id' => fn (array $attributes): int => DoctorWorkingWindow::query()
                ->findOrFail($attributes['doctor_working_window_id'])
                ->doctor_workplace_id,
            'checkup_id' => fn (array $attributes): int => DoctorWorkingWindow::query()
                ->findOrFail($attributes['doctor_working_window_id'])
                ->checkup_id,
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addMinutes(30),
            'price' => 5_000_000,
            'currency' => 'IRR',
            'is_active' => true,
        ];
    }
}
