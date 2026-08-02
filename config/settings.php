<?php

return [
    'scope_keys' => [
        'marketplace_platform' => 'marketplace',
        'marketplace_site' => 'marketplace',
        'tenant_hospital' => 'hospital',
    ],
    'marketplace' => [
        'booking.pending_hold_minutes' => [
            'group' => 'booking',
            'value_type' => 'integer',
            'default' => 60,
            'validation_rules' => ['integer', 'min:5', 'max:180'],
            'sensitivity' => 'public',
            'allowed_scopes' => ['platform', 'site'],
            'description' => 'Minutes a pending unpaid reservation blocks its slot.',
        ],
        'booking.default_timezone' => [
            'group' => 'booking',
            'value_type' => 'string',
            'default' => 'Asia/Tehran',
            'validation_rules' => ['string', 'timezone'],
            'sensitivity' => 'public',
            'allowed_scopes' => ['platform', 'site', 'user'],
            'description' => 'Fallback timezone for marketplace schedules.',
        ],
        'payments.default_currency' => [
            'group' => 'payments',
            'value_type' => 'string',
            'default' => 'IRR',
            'validation_rules' => ['string', 'size:3', 'uppercase'],
            'sensitivity' => 'public',
            'allowed_scopes' => ['platform', 'site'],
            'description' => 'Default marketplace payment currency.',
        ],
    ],
    'tenant' => [
        'booking.pending_hold_minutes' => [
            'group' => 'booking',
            'value_type' => 'integer',
            'default' => 60,
            'validation_rules' => ['integer', 'min:5', 'max:180'],
            'sensitivity' => 'internal',
            'allowed_scopes' => ['hospital'],
            'description' => 'Minutes a tenant reservation hold remains pending.',
        ],
        'booking.default_timezone' => [
            'group' => 'booking',
            'value_type' => 'string',
            'default' => 'Asia/Tehran',
            'validation_rules' => ['string', 'timezone'],
            'sensitivity' => 'public',
            'allowed_scopes' => ['hospital', 'user'],
            'description' => 'Tenant hospital timezone with an optional user preference.',
        ],
        'reports.enabled' => [
            'group' => 'reports',
            'value_type' => 'boolean',
            'default' => false,
            'validation_rules' => ['boolean'],
            'sensitivity' => 'internal',
            'allowed_scopes' => ['hospital'],
            'required_feature' => 'tenant.reports',
            'description' => 'Enables tenant-local reports only when marketplace entitlement permits them.',
        ],
    ],
];
