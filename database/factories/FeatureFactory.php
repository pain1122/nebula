<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class FeatureFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'key' => 'factory.'.Str::slug($name),
            'name' => Str::title($name),
            'description' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
