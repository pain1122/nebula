<?php

namespace Database\Factories;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\ReservationStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ReservationFactory extends Factory
{
    public function configure(): static
    {
        return $this->afterCreating(function ($reservation): void {
            $reservation->workplace()->update(['doctor_profile_id' => $reservation->doctor_profile_id]);
            $reservation->workplace->checkups()->syncWithoutDetaching([
                $reservation->checkup_id => ['is_active' => true],
            ]);
        });
    }

    public function definition(): array
    {
        $startsAt = now()->addDays(fake()->numberBetween(2, 20))->startOfHour();

        return [
            'user_id' => User::factory()->patient(),
            'doctor_profile_id' => DoctorProfile::factory(),
            'doctor_workplace_id' => DoctorWorkplace::factory(),
            'checkup_id' => Checkup::factory(),
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addMinutes(30),
            'duration_minutes' => 30,
            'timezone' => 'Asia/Tehran',
            'status' => ReservationStatus::Pending->value,
            'hold_expires_at' => now()->addHour(),
            'booking_idempotency_key' => 'factory-'.Str::ulid(),
            'hospital_name_snapshot' => 'Factory Hospital',
            'doctor_name_snapshot' => 'Factory Doctor',
            'checkup_title_snapshot' => 'Factory Checkup',
            'category_name_snapshot' => 'Factory Category',
            'price_snapshot' => 5_000_000,
            'currency_snapshot' => 'IRR',
        ];
    }
}
