<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class LocalUsersSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@checkupino.test'],
            [
                'name'       => 'Local Admin',
                'phone'      => '09123456789',
                'birth_date' => '1999-01-01',
                'NID'        => '0023456789',
                'password'   => Hash::make('Password123!'),
                'first_name' => 'Local',
                'last_name'  => 'Admin',
            ]
        );

        $doctor = User::updateOrCreate(
            ['email' => 'doctor@checkupino.test'],
            [
                'name'       => 'Local Doctor',
                'phone'      => '09123456780',
                'birth_date' => '1995-01-01',
                'NID'        => '0023456780',
                'password'   => Hash::make('Password123!'),
                'first_name' => 'Local',
                'last_name'  => 'Doctor',
            ]
        );

        $patient = User::updateOrCreate(
            ['email' => 'patient@checkupino.test'],
            [
                'name'       => 'Local Patient',
                'phone'      => '09123456781',
                'birth_date' => '2000-01-01',
                'NID'        => '0023456781',
                'password'   => Hash::make('Password123!'),
                'first_name' => 'Local',
                'last_name'  => 'Patient',
            ]
        );

        // اگر Spatie Roles دارید:
        if (method_exists($admin, 'assignRole')) {
            $admin->assignRole('admin');
            $doctor->assignRole('doctor');
            $patient->assignRole('patient');
        }
    }
}
