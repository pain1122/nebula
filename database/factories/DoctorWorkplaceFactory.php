<?php

namespace Database\Factories;

use App\Models\DoctorProfile;
use App\Models\MarketplaceHospital;
use Illuminate\Database\Eloquent\Factories\Factory;

class DoctorWorkplaceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'doctor_profile_id' => DoctorProfile::factory(),
            'marketplace_hospital_id' => MarketplaceHospital::factory(),
            'display_name' => fake()->optional()->company(),
            'booking_notes' => fake()->optional()->sentence(),
            'is_active' => true,
        ];
    }
}
