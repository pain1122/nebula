<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\DoctorProfile;
use App\Models\Checkup;

class DoctorServicesSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::where('email','doc@checkupino.local')->first();
        if (!$user) return;

        $profile = DoctorProfile::where('user_id',$user->id)->first();
        if (!$profile) return;

        $slugs = ['cardio-eval','stress-test','basic-health-check']; // هرچی دوست داری
        $ids   = Checkup::whereIn('slug',$slugs)->pluck('id')->all();

        $profile->checkups()->syncWithoutDetaching($ids);
    }
}
