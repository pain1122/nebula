<?php

namespace Database\Factories;

use App\Models\Specialty;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DoctorProfileFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->doctor(),
            'specialty_id' => Specialty::factory(),
            'phone' => fake()->unique()->numerify('09#########'),
            'experience_years' => fake()->numberBetween(1, 30),
            'fee' => fake()->numberBetween(5_000_000, 30_000_000),
            'bio' => fake()->paragraph(),
            'verified' => true,
            'verified_at' => now(),
        ];
    }
}
