<?php

namespace Database\Seeders;

use App\Enums\AccountState;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use LogicException;

class LocalUsersSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Known-credential demo users may only be seeded in local or testing environments.');
        }

        $password = (string) config('demo.password');

        $rootAdmin = User::updateOrCreate(
            ['email' => 'rootadmin@checkupino.test'],
            [
                'name' => 'Local Root Admin',
                'phone' => '09987654321',
                'birth_date' => '1999-01-01',
                'NID' => '0098765432',
                'password' => Hash::make($password),
                'first_name' => 'Local',
                'last_name' => 'Root Admin',
                'email_verified_at' => now(),
                'patient_status' => null,
            ]
        );
        $admin = User::updateOrCreate(
            ['email' => 'admin@checkupino.test'],
            [
                'name' => 'Local Admin',
                'phone' => '09123456789',
                'birth_date' => '1999-01-01',
                'NID' => '0023456789',
                'password' => Hash::make($password),
                'first_name' => 'Local',
                'last_name' => 'Admin',
                'email_verified_at' => now(),
                'patient_status' => null,
            ]
        );

        $doctor = User::updateOrCreate(
            ['email' => 'doctor@checkupino.test'],
            [
                'name' => 'Local Doctor',
                'phone' => '09123456780',
                'birth_date' => '1995-01-01',
                'NID' => '0023456780',
                'password' => Hash::make($password),
                'first_name' => 'Local',
                'last_name' => 'Doctor',
                'email_verified_at' => now(),
                'patient_status' => null,
            ]
        );

        $patient = User::updateOrCreate(
            ['email' => 'patient@checkupino.test'],
            [
                'name' => 'Local Patient',
                'phone' => '09123456781',
                'birth_date' => '2000-01-01',
                'NID' => '0023456781',
                'password' => Hash::make($password),
                'first_name' => 'Local',
                'last_name' => 'Patient',
                'email_verified_at' => now(),
                'patient_status' => 'free',
            ]
        );

        $secondDoctor = User::updateOrCreate(
            ['email' => 'doctor2@checkupino.test'],
            [
                'name' => 'Local Doctor Two',
                'phone' => '09123456782',
                'birth_date' => '1992-01-01',
                'NID' => '0023456782',
                'password' => Hash::make($password),
                'first_name' => 'Local',
                'last_name' => 'Doctor Two',
                'email_verified_at' => now(),
                'patient_status' => null,
            ]
        );

        $secondPatient = User::updateOrCreate(
            ['email' => 'patient2@checkupino.test'],
            [
                'name' => 'Local Patient Two',
                'phone' => '09123456783',
                'birth_date' => '2001-01-01',
                'NID' => '0023456783',
                'password' => Hash::make($password),
                'first_name' => 'Local',
                'last_name' => 'Patient Two',
                'email_verified_at' => now(),
                'patient_status' => 'free',
            ]
        );

        $rootAdmin->syncRoles([UserRole::RootAdmin->value]);
        $admin->syncRoles([UserRole::Admin->value]);
        $doctor->syncRoles([UserRole::Doctor->value]);
        $patient->syncRoles([UserRole::Patient->value]);
        $secondDoctor->syncRoles([UserRole::Doctor->value]);
        $secondPatient->syncRoles([UserRole::Patient->value]);

        foreach ([$rootAdmin, $admin, $doctor, $patient, $secondDoctor, $secondPatient] as $user) {
            $user->forceFill([
                'account_state' => AccountState::Active->value,
                'account_state_changed_at' => null,
                'closed_at' => null,
            ])->save();
        }
    }
}
