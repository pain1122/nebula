<?php

namespace Database\Seeders;

use App\Models\Feature;
use App\Models\ReservationRatingOption;
use App\Models\SettingDefinition;
use App\Models\SettingValue;
use Illuminate\Database\Seeder;

class PlatformPrimitiveSeeder extends Seeder
{
    public function run(): void
    {
        $settings = [
            [
                'key' => 'booking.pending_hold_minutes',
                'group' => 'booking',
                'value_type' => 'integer',
                'default_value' => 60,
                'validation_rules' => ['integer', 'min:5', 'max:180'],
                'sensitivity' => 'public',
                'allowed_scopes' => ['global'],
                'description' => 'Minutes a pending unpaid reservation blocks its slot.',
            ],
            [
                'key' => 'booking.default_timezone',
                'group' => 'booking',
                'value_type' => 'string',
                'default_value' => 'Asia/Tehran',
                'validation_rules' => ['timezone'],
                'sensitivity' => 'public',
                'allowed_scopes' => ['global'],
                'description' => 'Fallback timezone for marketplace schedules.',
            ],
            [
                'key' => 'payments.default_currency',
                'group' => 'payments',
                'value_type' => 'string',
                'default_value' => 'IRR',
                'validation_rules' => ['string', 'size:3'],
                'sensitivity' => 'public',
                'allowed_scopes' => ['global'],
                'description' => 'Default marketplace payment currency.',
            ],
        ];

        foreach ($settings as $setting) {
            $definition = SettingDefinition::updateOrCreate(['key' => $setting['key']], $setting);
            SettingValue::updateOrCreate(
                ['setting_definition_id' => $definition->id, 'scope_type' => 'global', 'scope_key' => 'marketplace'],
                ['value' => $setting['default_value']]
            );
        }

        $features = [
            ['key' => 'marketplace.reservations', 'name' => 'Marketplace Reservations', 'description' => 'Marketplace booking and reservation lifecycle.'],
            ['key' => 'marketplace.questionnaires', 'name' => 'Health Questionnaires', 'description' => 'Versioned public health questionnaires.'],
            ['key' => 'marketplace.payments', 'name' => 'Marketplace Payments', 'description' => 'Payment summaries and retryable attempts.'],
            ['key' => 'tenant.foundation', 'name' => 'Tenant Foundation', 'description' => 'Minimal isolated hospital tenant foundation.'],
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
