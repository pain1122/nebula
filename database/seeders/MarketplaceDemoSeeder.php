<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use LogicException;

class MarketplaceDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Marketplace demo data may only be seeded in local or testing environments.');
        }
        \Database\Seeders\Support\DemoFixtureContext::guardOwnedDatabase();

        DB::transaction(fn () => $this->call([
            LocalUsersSeeder::class,
            MarketplaceHospitalSeeder::class,
            DoctorProfileSeeder::class,
            DoctorServicesSeeder::class,
            QuestionnaireDemoSeeder::class,
            ReservationPaymentDemoSeeder::class,
            PatientExperienceDemoSeeder::class,
            ArticleDemoSeeder::class,
            MedicalRequestDemoSeeder::class,
        ]));
    }
}
