<?php

namespace App\Contracts\Integrations;

interface MessageTransport
{
    /** @param array<string, scalar|null> $variables */
    public function sendTemplate(string $recipientReference, string $templateKey, array $variables): void;
}
