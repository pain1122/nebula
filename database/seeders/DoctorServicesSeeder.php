<?php

namespace Database\Seeders;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use Illuminate\Database\Seeder;

class DoctorServicesSeeder extends Seeder
{
    public function run(): void
    {
        $workplaces = [
            [
                'doctor' => 'doctor@checkupino.test',
                'hospital' => 'mehr-demo-hospital',
                'display_name' => 'Cardiology - Mehr Hospital',
                'services' => [
                    'cardio-eval' => ['price_override' => 13_000_000, 'duration_override_minutes' => 45],
                    'stress-test' => ['price_override' => null, 'duration_override_minutes' => 45],
                    'basic-health-check' => ['price_override' => null, 'duration_override_minutes' => 30],
                ],
                'windows' => [[6, '09:00', '13:00', 30], [1, '14:00', '18:00', 30]],
            ],
            [
                'doctor' => 'doctor@checkupino.test',
                'hospital' => 'shafa-demo-clinic',
                'display_name' => 'Cardiology - Shafa Clinic',
                'services' => [
                    'cardio-eval' => ['price_override' => 11_500_000, 'duration_override_minutes' => 30],
                    'stress-test' => ['price_override' => 8_500_000, 'duration_override_minutes' => 45],
                ],
                'windows' => [[3, '10:00', '14:00', 30]],
            ],
            [
                'doctor' => 'doctor2@checkupino.test',
                'hospital' => 'pars-demo-medical-center',
                'display_name' => 'Digestive Health - Pars Center',
                'services' => [
                    'liver-panel' => ['price_override' => null, 'duration_override_minutes' => 30],
                    'h-pylori-test' => ['price_override' => null, 'duration_override_minutes' => 20],
                    'full-body-check' => ['price_override' => 16_000_000, 'duration_override_minutes' => 60],
                ],
                'windows' => [[0, '08:00', '12:00', 20], [2, '08:00', '12:00', 20]],
            ],
        ];

        foreach ($workplaces as $data) {
            $profile = DoctorProfile::whereHas('user', fn ($query) => $query->where('email', $data['doctor']))->firstOrFail();
            $hospital = MarketplaceHospital::where('slug', $data['hospital'])->firstOrFail();
            $workplace = DoctorWorkplace::updateOrCreate(
                ['doctor_profile_id' => $profile->id, 'marketplace_hospital_id' => $hospital->id],
                ['display_name' => $data['display_name'], 'booking_notes' => 'Demo bookings use the hospital local time.']
            );

            $servicePivots = [];
            foreach ($data['services'] as $slug => $override) {
                $servicePivots[Checkup::where('slug', $slug)->firstOrFail()->id] = $override + [
                    'currency_override' => $override['price_override'] === null ? null : 'IRR',
                    'is_active' => true,
                ];
            }
            $workplace->checkups()->sync($servicePivots);

            foreach ($data['windows'] as [$weekday, $startsAt, $endsAt, $duration]) {
                DoctorWorkingWindow::updateOrCreate(
                    ['doctor_workplace_id' => $workplace->id, 'weekday' => $weekday, 'starts_at' => $startsAt.':00'],
                    ['ends_at' => $endsAt.':00', 'slot_duration_minutes' => $duration, 'buffer_minutes' => 0]
                );
            }
        }
    }
}
