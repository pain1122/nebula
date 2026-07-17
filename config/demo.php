<?php

return [
    /*
    | Local/testing fixtures are blocked by DatabaseSeeder outside these
    | environments even when this flag is accidentally enabled.
    */
    'seed_enabled' => env('SEED_DEMO_DATA', true),

    'password' => env('DEMO_SEED_PASSWORD', 'Password123!'),
];
