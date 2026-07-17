<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use LogicException;

class MarketplaceDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Marketplace demo data may only be seeded in local or testing environments.');
        }

        $this->call([
            LocalUsersSeeder::class,
            MarketplaceHospitalSeeder::class,
            DoctorProfileSeeder::class,
            DoctorServicesSeeder::class,
            QuestionnaireDemoSeeder::class,
            ReservationPaymentDemoSeeder::class,
        ]);
    }
}
