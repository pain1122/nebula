<?php

namespace Database\Factories;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PaymentAttemptFactory extends Factory
{
    public function definition(): array
    {
        return [
            'payment_summary_id' => Payment::factory(),
            'reservation_id' => fn (array $attributes) => Payment::findOrFail($attributes['payment_summary_id'])->reservation_id,
            'provider' => 'sandbox',
            'provider_ref' => null,
            'idempotency_key' => 'factory-'.Str::ulid(),
            'amount' => 5_000_000,
            'currency' => 'IRR',
            'status' => 'initiated',
            'initiated_at' => now(),
            'metadata' => ['fixture' => true],
        ];
    }
}
