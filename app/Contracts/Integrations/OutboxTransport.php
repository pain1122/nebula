<?php

namespace App\Contracts\Integrations;

interface OutboxTransport
{
    /** @param array<string, mixed> $payload */
    public function dispatch(string $eventId, string $eventType, array $payload): void;
}
