<?php

namespace Database\Factories;

use App\Models\Checkup;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use Illuminate\Database\Eloquent\Factories\Factory;

class DoctorWorkingWindowFactory extends Factory
{
    public function configure(): static
    {
        return $this->afterMaking(function (DoctorWorkingWindow $slot): void {
            $slot->workplace->checkups()->syncWithoutDetaching([
                $slot->checkup_id => ['is_active' => true],
            ]);
        });
    }

    public function definition(): array
    {
        return [
            'doctor_workplace_id' => DoctorWorkplace::factory(),
            'checkup_id' => Checkup::factory(),
            'weekday' => fake()->numberBetween(0, 6),
            'starts_at' => '09:00:00',
            'ends_at' => '12:00:00',
            'visit_duration_minutes' => 30,
            'is_active' => true,
        ];
    }
}
