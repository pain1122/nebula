<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class MarketplaceFoundationSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesSeeder::class,
            SpecialtySeeder::class,
            CheckupCategorySeeder::class,
            CheckupSeeder::class,
            PlatformPrimitiveSeeder::class,
        ]);
    }
}
