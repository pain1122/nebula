<?php

return [
    // Deployment policy; confirm the legally required period for each operating jurisdiction.
    'records_retention_days' => (int) env('MEDICAL_RECORDS_RETENTION_DAYS', 365),
    // Enable only after the dedicated worker and local scanner pass acceptance.
    'scanner' => [
        'enabled' => env('MEDICAL_SCAN_ENABLED', false),
        'socket' => env('MEDICAL_SCAN_SOCKET', '/run/medical-scan/clamd.sock'),
        'timeout_seconds' => (int) env('MEDICAL_SCAN_TIMEOUT_SECONDS', 45),
    ],
];
