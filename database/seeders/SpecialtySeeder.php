<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Specialty;

class SpecialtySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $cardio = Specialty::updateOrCreate(['slug' => 'cardio'], ['name' => 'قلب و عروق', 'parent_id' => null, 'level' => 0]);
        Specialty::updateOrCreate(['slug' => 'cardio-general'], ['name' => 'قلب و عروق عمومی', 'parent_id' => $cardio->id, 'level' => 1]);
        Specialty::updateOrCreate(['slug' => 'electrophysiology'], ['name' => 'الکتروفیزیولوژی', 'parent_id' => $cardio->id, 'level' => 1]);
    }
}
