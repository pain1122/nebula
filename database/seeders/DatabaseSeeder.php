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
        $demo = app()->environment(['local', 'testing']) && config('demo.seed_enabled');
        if ($demo) {
            \Database\Seeders\Support\DemoFixtureContext::guardOwnedDatabase();
        }
        $this->call(MarketplaceFoundationSeeder::class);

        if ($demo) {
            $this->call(MarketplaceDemoSeeder::class);
            if (config('demo.verified_media_seed_enabled')) {
                $this->call(VerifiedDemoMediaSeeder::class);
            }
        }
    }
}
