<?php

namespace Database\Factories;

use App\Models\Reservation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReservationNoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'reservation_id' => Reservation::factory(),
            'user_id' => User::factory()->doctor(),
            'author_name_snapshot' => 'Factory Clinician',
            'type' => 'clinical',
            'visibility' => 'care_team',
            'body' => fake()->paragraph(),
        ];
    }
}
