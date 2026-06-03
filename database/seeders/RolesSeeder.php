<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Enums\UserRole;
use Spatie\Permission\Models\Role;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        foreach (UserRole::values() as $name) {
            Role::firstOrCreate(['name' => $name, 'guard_name' => 'sanctum']);
        }
    }
}
