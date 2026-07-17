<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class SettingDefinitionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'key' => 'factory.'.Str::lower((string) fake()->unique()->word()),
            'group' => 'factory',
            'value_type' => 'string',
            'default_value' => 'default',
            'validation_rules' => ['string'],
            'sensitivity' => 'internal',
            'allowed_scopes' => ['global'],
            'description' => fake()->sentence(),
        ];
    }
}
