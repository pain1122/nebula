<?php

namespace App\Contracts\Integrations;

interface PaymentGateway
{
    /** @param array<string, mixed> $request */
    public function createAttempt(array $request): array;

    /** @param array<string, mixed> $callback */
    public function verifyCallback(array $callback, string $signature): bool;
}
