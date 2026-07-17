<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class MarketplaceHospitalFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company().' Hospital';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(100, 999),
            'timezone' => 'Asia/Tehran',
            'country_code' => 'IR',
            'province' => 'Tehran',
            'city' => 'Tehran',
            'address' => fake()->address(),
            'contact_phone' => fake()->numerify('021########'),
            'profile' => fake()->sentence(),
            'filter_metadata' => ['ownership' => 'private'],
            'is_active' => true,
        ];
    }
}
