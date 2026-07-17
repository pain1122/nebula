<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class LeadFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'phone' => fake()->unique()->numerify('09#########'),
            'email' => fake()->safeEmail(),
            'source' => 'manual',
            'source_key' => '',
            'status' => 'new',
            'consent_granted' => true,
            'consent_recorded_at' => now(),
            'consent_source' => 'factory',
            'retention_until' => now()->addYear(),
            'meta' => ['fixture' => true],
        ];
    }
}
