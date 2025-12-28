<?php 
namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DoctorUserSeeder extends Seeder
{
    public function run(): void
    {
        $u = User::firstOrCreate(
            ['email'=>'doc@checkupino.local'],
            ['name'=>'Demo Doctor','password'=>Hash::make('password')]
        );
        $u->assignRole('doctor');
    }
}
