<?php

namespace Database\Factories;

use App\Models\DoctorWorkplace;
use Illuminate\Database\Eloquent\Factories\Factory;

class DoctorWorkingWindowFactory extends Factory
{
    public function definition(): array
    {
        return [
            'doctor_workplace_id' => DoctorWorkplace::factory(),
            'weekday' => fake()->numberBetween(0, 6),
            'starts_at' => '09:00:00',
            'ends_at' => '13:00:00',
            'slot_duration_minutes' => 30,
            'buffer_minutes' => 0,
            'is_active' => true,
        ];
    }
}
