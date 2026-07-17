<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class OutboxEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'event_id' => (string) Str::uuid(),
            'event_type' => 'factory.created',
            'subject_type' => null,
            'subject_id' => null,
            'subject_public_id' => null,
            'payload' => ['fixture' => true],
            'status' => 'pending',
            'attempts' => 0,
            'available_at' => now(),
        ];
    }
}
