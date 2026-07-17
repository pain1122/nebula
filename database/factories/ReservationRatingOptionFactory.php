<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ReservationRatingOptionFactory extends Factory
{
    public function definition(): array
    {
        $label = fake()->unique()->words(2, true);

        return [
            'type' => fake()->randomElement(['pro', 'con']),
            'label' => Str::title($label),
            'slug' => Str::slug($label).'-'.fake()->unique()->numberBetween(100, 999),
            'description' => fake()->sentence(),
            'active' => true,
            'sort_order' => 10,
        ];
    }
}
