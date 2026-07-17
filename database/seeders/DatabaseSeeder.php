<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(MarketplaceFoundationSeeder::class);

        if (app()->environment(['local', 'testing']) && config('demo.seed_enabled')) {
            $this->call(MarketplaceDemoSeeder::class);
        }
    }
}
