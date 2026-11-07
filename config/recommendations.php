<?php

return [
    // Source delivery does not authorize clinical activation or a live migration.
    'authoring_enabled' => env('RECOMMENDATION_RULES_ENABLED', false),
    'enabled' => env('PATIENT_RECOMMENDATIONS_ENABLED', false),
];
