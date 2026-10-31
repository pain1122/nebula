<?php

namespace App\Services;

final class GeneralMarketplaceRuntime
{
    public function __construct(private readonly GeneralMarketplaceSettings $settings) {}

    /** Existing holds and idempotent booking replays never consult this default. */
    public function holdMinutes(): int
    {
        $row = $this->settings->capture('site', onlyKey: 'booking.pending_hold_minutes')['settings'][0];

        return $row['effective_source'] === 'default'
            ? max(1, (int) config('payments.hold_minutes', 60)) : $row['effective_value'];
    }

    /** Explicit hospital timezone wins; invalid explicit data fails instead of being reinterpreted. */
    public function timezone(?string $explicit): string
    {
        return $this->settings->valid('booking.default_timezone', $explicit === null || $explicit === ''
            ? $this->settings->capture('site', onlyKey: 'booking.default_timezone')['settings'][0]['effective_value'] : $explicit);
    }

    /** Only missing currency on NEW schedule occurrences; never convert or relabel stored money. */
    public function currency(?string $explicit): string
    {
        return $this->settings->valid('payments.default_currency', $explicit === null || $explicit === ''
            ? $this->settings->capture('site', onlyKey: 'payments.default_currency')['settings'][0]['effective_value'] : $explicit);
    }
}
