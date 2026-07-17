<?php

namespace Tests\Feature\Database;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationTenantMigrationLifecycleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('database.connections.tenant', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        DB::purge('tenant');
    }

    public function test_minimal_tenant_schema_is_isolated_and_reversible(): void
    {
        $arguments = [
            '--database' => 'tenant',
            '--path' => 'database/migrations/tenant',
            '--force' => true,
        ];

        Artisan::call('migrate:fresh', $arguments);

        $tenant = Schema::connection('tenant');

        foreach ([
            'tenant_installation',
            'hospital_profile',
            'users',
            'roles',
            'sessions',
            'setting_definitions',
            'setting_values',
            'feature_entitlements',
            'audit_events',
            'outbox_events',
        ] as $table) {
            $this->assertTrue($tenant->hasTable($table), "Expected tenant {$table} to exist.");
        }

        foreach ([
            'marketplace_hospitals',
            'doctor_workplaces',
            'reservations',
            'reservation_payment_summaries',
            'questionnaires',
            'questionnaire_submissions',
            'reservation_files',
        ] as $table) {
            $this->assertFalse($tenant->hasTable($table), "Tenant foundation must not contain {$table}.");
        }

        $this->assertFalse($tenant->hasColumn('users', 'tenant_id'));
        $this->assertFalse($tenant->hasColumn('users', 'role'));

        Artisan::call('migrate:rollback', $arguments);

        $this->assertFalse($tenant->hasTable('hospital_profile'));
        $this->assertFalse($tenant->hasTable('users'));
        $this->assertFalse($tenant->hasTable('outbox_events'));

        Artisan::call('migrate', $arguments);

        $this->assertTrue($tenant->hasTable('hospital_profile'));
        $this->assertTrue($tenant->hasTable('users'));
        $this->assertTrue($tenant->hasTable('outbox_events'));
    }
}
