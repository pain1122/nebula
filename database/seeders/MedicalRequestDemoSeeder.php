<?php

namespace Database\Seeders;

use App\Models\Reservation;
use App\Services\ReservationMedicalRequestService;
use Database\Seeders\Support\DemoFixtureContext;
use Illuminate\Database\Seeder;

class MedicalRequestDemoSeeder extends Seeder
{
    public function run(): void
    {
        DemoFixtureContext::guard();
        foreach (['demo-confirmed-paid', 'demo-doctor2-confirmed'] as $key) {
            $reservation = Reservation::where('booking_idempotency_key', $key)->with('doctor.user')->firstOrFail();
            foreach (['demo_lab_results' => 'Synthetic demo: laboratory document', 'demo_follow_up' => 'Synthetic demo: follow-up document'] as $type => $title) {
                if ($reservation->medicalRequests()->where('request_type', $type)->exists()) {
                    continue;
                }
                $doctor = $reservation->doctor->user;
                app(ReservationMedicalRequestService::class)->create(
                    DemoFixtureContext::request($doctor, '/api/doctor/medical-requests', 'POST'), $doctor, $reservation,
                    $type, $title, 'Synthetic demonstration only. Attach a generated PDF; do not use real patient information.',
                    attachmentRules: ['allowed_mime_types' => ['application/pdf']],
                );
            }
        }
    }
}
