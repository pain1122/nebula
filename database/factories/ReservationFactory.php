<?php

namespace Database\Factories;

use App\Models\DoctorVisitSlot;
use App\Models\ReservationStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ReservationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->patient(),
            'doctor_visit_slot_id' => DoctorVisitSlot::factory(),
            'doctor_profile_id' => fn (array $attributes): int => DoctorVisitSlot::query()
                ->findOrFail($attributes['doctor_visit_slot_id'])
                ->workplace
                ->doctor_profile_id,
            'doctor_workplace_id' => fn (array $attributes): int => DoctorVisitSlot::query()
                ->findOrFail($attributes['doctor_visit_slot_id'])
                ->doctor_workplace_id,
            'checkup_id' => fn (array $attributes): int => DoctorVisitSlot::query()
                ->findOrFail($attributes['doctor_visit_slot_id'])
                ->checkup_id,
            'starts_at' => fn (array $attributes) => DoctorVisitSlot::query()
                ->findOrFail($attributes['doctor_visit_slot_id'])
                ->starts_at,
            'ends_at' => fn (array $attributes) => DoctorVisitSlot::query()
                ->findOrFail($attributes['doctor_visit_slot_id'])
                ->ends_at,
            'duration_minutes' => fn (array $attributes): int => (int) DoctorVisitSlot::query()
                ->findOrFail($attributes['doctor_visit_slot_id'])
                ->starts_at
                ->diffInMinutes(DoctorVisitSlot::query()->findOrFail($attributes['doctor_visit_slot_id'])->ends_at),
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
