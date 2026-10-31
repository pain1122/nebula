<?php

namespace Database\Factories;

use App\Enums\ReservationReportStatus;
use App\Models\ReservationMedicalRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReservationReportFactory extends Factory
{
    public function definition(): array
    {
        return [
            'medical_request_id' => ReservationMedicalRequest::factory(),
            'reservation_id' => fn (array $attributes): int => ReservationMedicalRequest::query()
                ->findOrFail($attributes['medical_request_id'])
                ->reservation_id,
            'author_user_id' => fn (array $attributes): int => ReservationMedicalRequest::query()
                ->findOrFail($attributes['medical_request_id'])
                ->requested_by,
            'author_name_snapshot' => $this->faker->name(),
            'status' => ReservationReportStatus::Draft,
            'body' => 'Patient-visible medical outcome.',
            'published_at' => null,
            'retention_until' => now()->addYear(),
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => ReservationReportStatus::Published,
            'published_at' => now(),
        ]);
    }
}
