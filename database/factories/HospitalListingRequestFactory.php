<?php

namespace Database\Factories;

use App\Enums\HospitalListingRequestStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class HospitalListingRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'requesting_user_id' => User::factory()->doctor(),
            'proposed_name' => fake()->company().' Hospital',
            'proposed_city' => fake()->city(),
            'proposed_address' => fake()->address(),
            'proposed_phone' => fake()->numerify('021########'),
            'evidence_notes' => fake()->sentence(),
            'status' => HospitalListingRequestStatus::Pending->value,
        ];
    }
}
