<?php

namespace Tests\Feature\Database;

use Database\Seeders\TenantFoundationSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TenantFoundationSeederTest extends TestCase
{
    public function test_tenant_seed_is_minimal_isolated_and_idempotent(): void
    {
        config([
            'database.connections.tenant' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('tenant');

        $exitCode = Artisan::call('migrate:fresh', [
            '--database' => 'tenant',
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
            '--force' => true,
        ]);
        $this->assertSame(0, $exitCode, Artisan::output());

        $this->seed(TenantFoundationSeeder::class);
        $this->seed(TenantFoundationSeeder::class);

        $db = DB::connection('tenant');
        $this->assertSame(1, $db->table('tenant_installation')->count());
        $this->assertSame(1, $db->table('hospital_profile')->count());
        $this->assertSame(1, $db->table('users')->count());
        $this->assertSame(1, $db->table('roles')->count());
        $this->assertSame(1, $db->table('model_has_roles')->count());
        $this->assertSame(1, $db->table('feature_entitlements')->count());
        $this->assertSame('admin', $db->table('roles')->value('name'));
        $this->assertFalse(Schema::connection('tenant')->hasTable('marketplace_hospitals'));
        $this->assertFalse(Schema::connection('tenant')->hasTable('reservations'));
        $this->assertFalse(Schema::connection('tenant')->hasTable('payments'));
    }
}
