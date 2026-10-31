<?php

namespace Database\Seeders;

use App\Models\Specialty;
use Illuminate\Database\Seeder;

class SpecialtySeeder extends Seeder
{
    public function run(): void
    {
        $cardiology = Specialty::firstOrCreate(
            ['slug' => 'cardiology'],
            ['name' => 'Cardiology', 'parent_id' => null, 'level' => 0]
        );
        Specialty::firstOrCreate(['slug' => 'general-cardiology'], ['name' => 'General Cardiology', 'parent_id' => $cardiology->id, 'level' => 1]);
        Specialty::firstOrCreate(['slug' => 'electrophysiology'], ['name' => 'Electrophysiology', 'parent_id' => $cardiology->id, 'level' => 1]);

        $internal = Specialty::firstOrCreate(
            ['slug' => 'internal-medicine'],
            ['name' => 'Internal Medicine', 'parent_id' => null, 'level' => 0]
        );
        Specialty::firstOrCreate(['slug' => 'gastroenterology'], ['name' => 'Gastroenterology', 'parent_id' => $internal->id, 'level' => 1]);
    }
}
