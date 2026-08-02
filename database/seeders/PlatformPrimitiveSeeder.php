<?php

namespace Database\Seeders;

use App\Models\Feature;
use App\Models\ReservationRatingOption;
use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Services\SettingsRegistry;
use Illuminate\Database\Seeder;

class PlatformPrimitiveSeeder extends Seeder
{
    public function run(): void
    {
        $settings = app(SettingsRegistry::class)->definitions('marketplace');

        foreach ($settings as $key => $setting) {
            $definition = SettingDefinition::updateOrCreate(['key' => $key], [
                'group' => $setting['group'],
                'value_type' => $setting['value_type'],
                'default_value' => $setting['default'],
                'validation_rules' => $setting['validation_rules'],
                'sensitivity' => $setting['sensitivity'],
                'allowed_scopes' => $setting['allowed_scopes'],
                'description' => $setting['description'],
            ]);
            SettingValue::updateOrCreate(
                ['setting_definition_id' => $definition->id, 'scope_type' => 'platform', 'scope_key' => 'marketplace'],
                ['value' => $setting['default']]
            );
        }

        $features = [
            ['key' => 'marketplace.reservations', 'name' => 'Marketplace Reservations', 'description' => 'Marketplace booking and reservation lifecycle.'],
            ['key' => 'marketplace.questionnaires', 'name' => 'Health Questionnaires', 'description' => 'Versioned public health questionnaires.'],
            ['key' => 'marketplace.payments', 'name' => 'Marketplace Payments', 'description' => 'Payment summaries and retryable attempts.'],
            ['key' => 'tenant.foundation', 'name' => 'Tenant Foundation', 'description' => 'Minimal isolated hospital tenant foundation.'],
            ['key' => 'tenant.reports', 'name' => 'Tenant Reports', 'description' => 'Tenant-local reporting capability controlled by marketplace entitlement.'],
        ];

        foreach ($features as $feature) {
            Feature::updateOrCreate(['key' => $feature['key']], $feature);
        }

        $ratingOptions = [
            ['type' => 'pro', 'slug' => 'clear-explanation', 'label' => 'Clear explanation', 'sort_order' => 10],
            ['type' => 'pro', 'slug' => 'respectful-care', 'label' => 'Respectful care', 'sort_order' => 20],
            ['type' => 'con', 'slug' => 'long-wait', 'label' => 'Long wait', 'sort_order' => 10],
            ['type' => 'con', 'slug' => 'unclear-explanation', 'label' => 'Unclear explanation', 'sort_order' => 20],
        ];

        foreach ($ratingOptions as $option) {
            ReservationRatingOption::updateOrCreate(
                ['type' => $option['type'], 'slug' => $option['slug']],
                $option + ['active' => true]
            );
        }
    }
}
