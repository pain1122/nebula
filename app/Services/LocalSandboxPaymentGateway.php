<?php

namespace App\Services;

use App\Contracts\Integrations\PaymentGateway;
use DomainException;

class LocalSandboxPaymentGateway implements PaymentGateway
{
    public static function enabled(): bool
    {
        return app()->environment(['local', 'testing'])
            && (bool) config('demo.sandbox_payments_enabled', false)
            && (string) config('app.key') !== '';
    }

    public function createAttempt(array $request): array
    {
        $this->requireEnabled();

        return ['provider_ref' => 'sandbox:'.$request['attempt_public_id']];
    }

    public function signCallback(array $callback): string
    {
        $this->requireEnabled();
        ksort($callback);

        $key = hash_hmac('sha256', 'checkupino.local-payment-sandbox', (string) config('app.key'), true);

        return hash_hmac('sha256', json_encode($callback, JSON_THROW_ON_ERROR), $key);
    }

    public function verifyCallback(array $callback, string $signature): bool
    {
        return self::enabled() && hash_equals($this->signCallback($callback), $signature);
    }

    private function requireEnabled(): void
    {
        if (! self::enabled()) {
            throw new DomainException('Local sandbox payment is unavailable.');
        }
    }
}
