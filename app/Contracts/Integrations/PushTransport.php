<?php

namespace App\Contracts\Integrations;

interface PushTransport
{
    /** @param array<string, scalar|null> $data */
    public function send(string $deviceReference, string $title, string $body, array $data): void;
}
