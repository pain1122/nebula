<?php

namespace Database\Factories;

use App\Models\Reservation;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'reservation_id' => Reservation::factory(),
            'provider' => 'sandbox',
            'provider_ref' => null,
            'amount' => 5_000_000,
            'currency' => 'IRR',
            'status' => 'unpaid',
        ];
    }
}
