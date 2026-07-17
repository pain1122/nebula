<?php

namespace Database\Factories;

use App\Models\SettingDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;

class SettingValueFactory extends Factory
{
    public function definition(): array
    {
        return [
            'setting_definition_id' => SettingDefinition::factory(),
            'scope_type' => 'global',
            'scope_key' => 'factory',
            'value' => 'fixture',
        ];
    }
}
