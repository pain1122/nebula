<?php

return [
    'max_attempts' => (int) env('OUTBOX_MAX_ATTEMPTS', 5),
    'base_backoff_seconds' => (int) env('OUTBOX_BASE_BACKOFF_SECONDS', 30),
    'processing_lease_seconds' => (int) env('OUTBOX_PROCESSING_LEASE_SECONDS', 300),
    'events' => [
        'reservation.created' => ['reservation_public_id', 'actor_public_id', 'occurred_at'],
        'payment.attempt.requested' => [
            'reservation_public_id',
            'payment_attempt_public_id',
            'amount',
            'currency',
        ],
        'notification.requested' => ['recipient_public_id', 'channel', 'template_key', 'locale'],
        'tenant.entitlement.changed' => ['tenant_public_id', 'feature_key', 'enabled', 'expires_at'],
    ],
];
