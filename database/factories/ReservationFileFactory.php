<?php

namespace Database\Factories;

use App\Models\Reservation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ReservationFileFactory extends Factory
{
    public function definition(): array
    {
        $name = Str::ulid().'.pdf';

        return [
            'reservation_id' => Reservation::factory(),
            'uploaded_by' => User::factory()->patient(),
            'disk' => 'private',
            'path' => 'fixtures/'.$name,
            'original_filename' => 'medical-document.pdf',
            'safe_filename' => $name,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => hash('sha256', $name),
            'classification' => 'medical',
            'scan_status' => 'clean',
            'scanned_at' => now(),
            'retention_until' => now()->addYear(),
        ];
    }
}
