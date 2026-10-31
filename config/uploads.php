<?php

return [
    // Operator capacity is separate from section/form limits. Transport and engine
    // configuration must be accepted before raising these deployment ceilings.
    'capacity_max_bytes' => env('UPLOAD_CAPACITY_MAX_BYTES', 10 * 1024 * 1024),
    'scanner_max_bytes' => env('MEDICAL_SCAN_MAX_BYTES', 10 * 1024 * 1024),
    'formats' => [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'application/zip' => 'zip',
    ],
    // Available formats above are not automatically allowed in any section.
    'sections' => [
        'medical' => [
            'max_bytes' => env('MEDICAL_UPLOAD_MAX_BYTES', 10 * 1024 * 1024),
            'allowed_mime_types' => ['application/pdf', 'image/jpeg', 'image/png'],
            'type_limits' => [],
        ],
        'public_media' => [
            'max_bytes' => env('PUBLIC_MEDIA_UPLOAD_MAX_BYTES', 5 * 1024 * 1024),
            'allowed_mime_types' => ['image/jpeg', 'image/png', 'image/webp'],
            'type_limits' => [],
        ],
    ],
];
