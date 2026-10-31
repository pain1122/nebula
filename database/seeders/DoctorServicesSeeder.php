<?php

namespace Database\Seeders;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Services\SchedulingService;
use Carbon\Carbon;
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
                    'cardio-eval' => ['price_override' => 13_000_000],
                    'stress-test' => ['price_override' => null],
                    'basic-health-check' => ['price_override' => null],
                ],
                'slots' => [
                    ['cardio-eval', 6, '09:00', '09:45', 13_500_000],
                    ['stress-test', 6, '10:00', '10:45', null],
                    ['basic-health-check', 1, '14:00', '14:30', null],
                ],
            ],
            [
                'doctor' => 'doctor@checkupino.test',
                'hospital' => 'shafa-demo-clinic',
                'display_name' => 'Cardiology - Shafa Clinic',
                'services' => [
                    'cardio-eval' => ['price_override' => 11_500_000],
                    'stress-test' => ['price_override' => 8_500_000],
                ],
                'slots' => [
                    ['cardio-eval', 3, '10:00', '10:30', null],
                    ['stress-test', 3, '11:00', '11:45', 9_000_000],
                ],
            ],
            [
                'doctor' => 'doctor2@checkupino.test',
                'hospital' => 'pars-demo-medical-center',
                'display_name' => 'Digestive Health - Pars Center',
                'services' => [
                    'liver-panel' => ['price_override' => null],
                    'h-pylori-test' => ['price_override' => null],
                    'full-body-check' => ['price_override' => 16_000_000],
                ],
                'slots' => [
                    ['liver-panel', 0, '08:00', '08:30', null],
                    ['h-pylori-test', 0, '09:00', '09:20', null],
                    ['full-body-check', 2, '08:00', '09:00', null],
                ],
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

            foreach ($data['slots'] as [$slug, $weekday, $startsAt, $endsAt, $priceOverride]) {
                $checkup = Checkup::where('slug', $slug)->firstOrFail();
                DoctorWorkingWindow::updateOrCreate(
                    [
                        'doctor_workplace_id' => $workplace->id,
                        'checkup_id' => $checkup->id,
                        'weekday' => $weekday,
                        'starts_at' => $startsAt.':00',
                    ],
                    [
                        'ends_at' => $endsAt.':00',
                        'visit_duration_minutes' => (int) Carbon::parse($startsAt)->diffInMinutes(Carbon::parse($endsAt)),
                        'price_override' => $priceOverride,
                        'currency_override' => $priceOverride === null ? null : 'IRR',
                    ]
                );
            }
        }

        app(SchedulingService::class)->materializeActiveRules(
            now()->startOfDay(),
            now()->addDays((int) config('scheduling.materialization_days', 90))->endOfDay(),
        );
    }
}
