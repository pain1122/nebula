<?php

namespace Database\Seeders;

use App\Models\DoctorProfile;
use App\Models\Specialty;
use App\Models\User;
use Illuminate\Database\Seeder;

class DoctorProfileSeeder extends Seeder
{
    public function run(): void
    {
        $verifier = User::where('email', 'rootadmin@checkupino.test')->firstOrFail();
        $profiles = [
            'doctor@checkupino.test' => [
                'specialties' => ['general-cardiology', 'electrophysiology'],
                'primary' => 'general-cardiology',
                'phone' => '09120000001',
                'experience_years' => 7,
                'fee' => 8_500_000,
                'bio' => 'Demo cardiologist focused on preventive cardiac care.',
            ],
            'doctor2@checkupino.test' => [
                'specialties' => ['gastroenterology', 'internal-medicine'],
                'primary' => 'gastroenterology',
                'phone' => '09120000002',
                'experience_years' => 11,
                'fee' => 9_500_000,
                'bio' => 'Demo gastroenterologist and internal medicine specialist.',
            ],
        ];

        foreach ($profiles as $email => $data) {
            $user = User::where('email', $email)->firstOrFail();
            $specialties = Specialty::whereIn('slug', $data['specialties'])->get()->keyBy('slug');
            $primary = $specialties->get($data['primary']);

            $profile = DoctorProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'specialty_id' => $primary?->id,
                    'phone' => $data['phone'],
                    'experience_years' => $data['experience_years'],
                    'fee' => $data['fee'],
                    'bio' => $data['bio'],
                    'verified' => true,
                ]
            );
            $profile->forceFill(['verified_at' => now(), 'verified_by' => $verifier->id])->save();

            $profile->specialties()->sync(
                $specialties->mapWithKeys(fn (Specialty $specialty): array => [
                    $specialty->id => ['is_primary' => $specialty->slug === $data['primary']],
                ])->all()
            );
        }
    }
}
