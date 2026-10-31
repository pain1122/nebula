<?php

return [
    // Capacity admission is separate from per-file/issued attachment policy.
    'account_max_files' => env('MEDICAL_UPLOAD_ACCOUNT_MAX_FILES', 100),
    'account_max_bytes' => env('MEDICAL_UPLOAD_ACCOUNT_MAX_BYTES', 100 * 1024 * 1024),
    'request_max_files' => env('MEDICAL_UPLOAD_REQUEST_MAX_FILES', 10),
    'request_max_bytes' => env('MEDICAL_UPLOAD_REQUEST_MAX_BYTES', 25 * 1024 * 1024),
    'requests_per_user_per_minute' => env('MEDICAL_UPLOAD_REQUESTS_PER_USER_PER_MINUTE', 10),
    'requests_per_ip_per_minute' => env('MEDICAL_UPLOAD_REQUESTS_PER_IP_PER_MINUTE', 30),
    'concurrent_uploads' => env('MEDICAL_UPLOAD_CONCURRENT_UPLOADS', 4),
    'lease_seconds' => env('MEDICAL_UPLOAD_LEASE_SECONDS', 120),
    // Shared database locks already exist. Never silently fall back to local locks.
    'cache_store' => env('MEDICAL_UPLOAD_GUARD_CACHE_STORE', 'database'),
];
