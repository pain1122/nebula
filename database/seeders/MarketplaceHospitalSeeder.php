<?php

namespace Database\Seeders;

use App\Models\MarketplaceHospital;
use Illuminate\Database\Seeder;

class MarketplaceHospitalSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = [
            [
                'name' => 'Mehr Demo Hospital',
                'slug' => 'mehr-demo-hospital',
                'province' => 'Tehran',
                'city' => 'Tehran',
                'address' => 'Valiasr Street, Tehran',
                'contact_phone' => '02188000001',
                'profile' => 'A multi-specialty marketplace directory fixture.',
                'filter_metadata' => ['ownership' => 'private', 'emergency' => true],
            ],
            [
                'name' => 'Shafa Demo Clinic',
                'slug' => 'shafa-demo-clinic',
                'province' => 'Tehran',
                'city' => 'Tehran',
                'address' => 'Mirdamad Boulevard, Tehran',
                'contact_phone' => '02188000002',
                'profile' => 'An outpatient marketplace directory fixture.',
                'filter_metadata' => ['ownership' => 'private', 'emergency' => false],
            ],
            [
                'name' => 'Pars Demo Medical Center',
                'slug' => 'pars-demo-medical-center',
                'province' => 'Alborz',
                'city' => 'Karaj',
                'address' => 'Azadi Square, Karaj',
                'contact_phone' => '02632000003',
                'profile' => 'A regional marketplace directory fixture.',
                'filter_metadata' => ['ownership' => 'public', 'emergency' => true],
            ],
        ];

        foreach ($hospitals as $hospital) {
            MarketplaceHospital::updateOrCreate(
                ['slug' => $hospital['slug']],
                $hospital + ['timezone' => 'Asia/Tehran', 'country_code' => 'IR']
            );
        }
    }
}
