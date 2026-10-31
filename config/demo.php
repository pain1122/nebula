<?php

return [
    /*
    | Local/testing fixtures are blocked by DatabaseSeeder outside these
    | environments even when this flag is accidentally enabled.
    */
    'seed_enabled' => env('SEED_DEMO_DATA', true),

    // The adapter additionally requires local/testing; this flag cannot enable production checkout.
    'sandbox_payments_enabled' => env('DEMO_SANDBOX_PAYMENTS', true),

    'password' => env('DEMO_SEED_PASSWORD', 'Password123!'),
];
