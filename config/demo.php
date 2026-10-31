<?php

return [
    /*
    | Local/testing fixtures are blocked by DatabaseSeeder outside these
    | environments even when this flag is accidentally enabled.
    */
    'seed_enabled' => env('SEED_DEMO_DATA', true),

    // Explicit fresh-demo stage: uses real scanner/parser and only its own exact encrypted jobs.
    'verified_media_seed_enabled' => env('DEMO_SEED_VERIFIED_MEDIA', false),

    // The adapter additionally requires local/testing; this flag cannot enable production checkout.
    'sandbox_payments_enabled' => env('DEMO_SANDBOX_PAYMENTS', true),

    'password' => env('DEMO_SEED_PASSWORD', 'Password123!'),
];
