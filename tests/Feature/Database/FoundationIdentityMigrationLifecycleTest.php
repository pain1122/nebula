<?php

namespace Tests\Feature\Database;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationIdentityMigrationLifecycleTest extends TestCase
{
    /**
     * @var list<string>
     */
    private array $paths = [
        'database/migrations/0001_01_01_000000_create_users_table.php',
        'database/migrations/0001_01_01_000001_create_cache_table.php',
        'database/migrations/0001_01_01_000002_create_jobs_table.php',
        'database/migrations/2025_11_09_061807_create_permission_tables.php',
    ];

    protected function tearDown(): void
    {
        Artisan::call('migrate:fresh', ['--force' => true]);

        parent::tearDown();
    }

    public function test_identity_foundation_rolls_back_and_reapplies_as_a_group(): void
    {
        Artisan::call('migrate:fresh', [
            '--path' => $this->paths,
            '--force' => true,
        ]);

        $this->assertTrue(Schema::hasTable('users'));
        $this->assertTrue(Schema::hasTable('personal_access_tokens'));
        $this->assertTrue(Schema::hasTable('roles'));

        Artisan::call('migrate:rollback', [
            '--path' => $this->paths,
            '--force' => true,
        ]);

        $this->assertFalse(Schema::hasTable('users'));
        $this->assertFalse(Schema::hasTable('personal_access_tokens'));
        $this->assertFalse(Schema::hasTable('roles'));

        Artisan::call('migrate', [
            '--path' => $this->paths,
            '--force' => true,
        ]);

        $this->assertTrue(Schema::hasTable('users'));
        $this->assertTrue(Schema::hasTable('personal_access_tokens'));
        $this->assertTrue(Schema::hasTable('roles'));
    }
}
