<?php

namespace Database\Seeders;

use App\Models\Specialty;
use Illuminate\Database\Seeder;

class SpecialtySeeder extends Seeder
{
    public function run(): void
    {
        $cardiology = Specialty::updateOrCreate(
            ['slug' => 'cardiology'],
            ['name' => 'Cardiology', 'parent_id' => null, 'level' => 0]
        );
        Specialty::updateOrCreate(['slug' => 'general-cardiology'], ['name' => 'General Cardiology', 'parent_id' => $cardiology->id, 'level' => 1]);
        Specialty::updateOrCreate(['slug' => 'electrophysiology'], ['name' => 'Electrophysiology', 'parent_id' => $cardiology->id, 'level' => 1]);

        $internal = Specialty::updateOrCreate(
            ['slug' => 'internal-medicine'],
            ['name' => 'Internal Medicine', 'parent_id' => null, 'level' => 0]
        );
        Specialty::updateOrCreate(['slug' => 'gastroenterology'], ['name' => 'Gastroenterology', 'parent_id' => $internal->id, 'level' => 1]);
    }
}
