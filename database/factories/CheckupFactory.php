<?php

namespace Database\Factories;

use App\Models\CheckupCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CheckupFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->unique()->words(3, true);

        return [
            'checkup_category_id' => CheckupCategory::factory(),
            'title' => Str::title($title),
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(100, 999),
            'description' => fake()->sentence(),
            'price' => fake()->numberBetween(3_000_000, 20_000_000),
            'currency' => 'IRR',
            'default_duration_minutes' => fake()->randomElement([20, 30, 45, 60]),
            'is_active' => true,
        ];
    }
}
