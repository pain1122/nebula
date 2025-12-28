<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $u = User::firstOrCreate(
            ['email'=>'admin@checkupino.local'],
            ['name'=>'Super Admin','password'=>Hash::make('password')]
        );
        $u->assignRole('admin');
    }
}
