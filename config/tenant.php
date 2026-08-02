<?php

$publicKeys = json_decode((string) env('TENANT_ENTITLEMENT_PUBLIC_KEYS', '{}'), true);

return [
    'entitlements' => [
        'algorithm' => 'ed25519',
        'clock_skew_seconds' => (int) env('TENANT_ENTITLEMENT_CLOCK_SKEW_SECONDS', 300),
        'public_keys' => is_array($publicKeys) ? $publicKeys : [],
        'signing_key_id' => env('TENANT_ENTITLEMENT_SIGNING_KEY_ID'),
        'signing_seed' => env('TENANT_ENTITLEMENT_SIGNING_SEED'),
    ],
];
