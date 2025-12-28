<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\DoctorProfile;
use App\Models\Specialty;

class DoctorProfileSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::where('email','doc@checkupino.local')->first();
        if (!$user) return;

        // یک تخصص مناسب انتخاب کنیم (ترجیحاً فرزندِ قلب)
        $spec = Specialty::whereIn('slug', ['cardio-general','electrophysiology','cardio'])->orderBy('level','desc')->first();

        $profile = DoctorProfile::firstOrCreate(
            ['user_id' => $user->id],
            [
                'specialty_id'     => $spec?->id,
                'phone'            => '09120000000',
                'experience_years' => 7,
                'fee'              => 850000,
                'bio'              => 'پزشک قلب با تمرکز بر پیشگیری و غربالگری.',
                'availability'     => [
                    ['day'=>'sat','slots'=>[['09:00','12:00'],['14:00','17:00']]],
                    ['day'=>'mon','slots'=>[['10:00','13:00']]],
                    ['day'=>'wed','slots'=>[['15:00','18:00']]],
                ],
                'verified'         => true,
            ]
        );

        // اگر قبلاً ساخته بود و specialty خالی بود، پرش کنیم
        if (!$profile->specialty_id && $spec) {
            $profile->update(['specialty_id' => $spec->id]);
        }
    }
}
