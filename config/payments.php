<?php

return [
    'hold_minutes' => (int) env('PAYMENT_HOLD_MINUTES', 60),
    'max_active_holds_per_user' => (int) env('PAYMENT_MAX_ACTIVE_HOLDS_PER_USER', 3),
    'hold_requests_per_minute_per_user' => (int) env('PAYMENT_HOLD_REQUESTS_PER_MINUTE_PER_USER', 10),
    'hold_requests_per_minute_per_device' => (int) env('PAYMENT_HOLD_REQUESTS_PER_MINUTE_PER_DEVICE', 10),
    'hold_requests_per_minute_per_ip' => (int) env('PAYMENT_HOLD_REQUESTS_PER_MINUTE_PER_IP', 30),
];
