<?php

namespace Database\Factories;

use App\Enums\ReservationMedicalRequestStatus;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Services\MedicalAttachmentPolicy;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;

class ReservationMedicalRequestFactory extends Factory
{
    /** Explicit issued fixture; default factories remain distinguishable legacy records. */
    public function withAttachmentPolicy(array $rules = []): static
    {
        return $this->afterMaking(function (ReservationMedicalRequest $request) use ($rules): void {
            $issued = DB::transaction(fn () => app(MedicalAttachmentPolicy::class)->issue($rules));
            $request->forceFill([
                'attachment_policy' => $issued['snapshot'],
                'attachment_policy_revision' => $issued['revision'],
            ]);
        });
    }

    public function definition(): array
    {
        return [
            'reservation_id' => Reservation::factory(),
            'requested_by' => fn (array $attributes): int => Reservation::query()
                ->findOrFail($attributes['reservation_id'])
                ->doctor
                ->user_id,
            'request_type' => 'lab_result',
            'title' => 'Requested laboratory result',
            'instructions' => 'Upload one complete PDF or image.',
            'status' => ReservationMedicalRequestStatus::Open,
            'due_at' => now()->addWeek(),
            'retention_until' => now()->addYear(),
        ];
    }
}
