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

        $rootAdmin = User::firstOrCreate(
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
        $admin = User::firstOrCreate(
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

        $doctor = User::firstOrCreate(
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

        $patient = User::firstOrCreate(
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

        $secondDoctor = User::firstOrCreate(
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

        $secondPatient = User::firstOrCreate(
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

        foreach ([[$rootAdmin, UserRole::RootAdmin], [$admin, UserRole::Admin], [$doctor, UserRole::Doctor],
            [$patient, UserRole::Patient], [$secondDoctor, UserRole::Doctor], [$secondPatient, UserRole::Patient]] as [$user, $role]) {
            if (! $user->wasRecentlyCreated) {
                continue;
            }
            $user->syncRoles([$role->value]);
            $user->forceFill([
                'account_state' => AccountState::Active->value,
                'account_state_changed_at' => null,
                'closed_at' => null,
            ])->save();
        }
    }
}
