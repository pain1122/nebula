<?php

namespace Tests\Feature\Database;

use App\Enums\AccountState;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationIdentitySchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketplace_identity_schema_has_the_new_authentication_contract(): void
    {
        $this->assertTrue(Schema::hasColumns('users', [
            'id',
            'public_id',
            'name',
            'email',
            'phone',
            'patient_status',
            'account_state',
            'account_state_changed_at',
            'account_state_changed_by',
            'account_state_reason',
            'closed_at',
        ]));

        $this->assertFalse(Schema::hasColumn('users', 'role'));
        $this->assertFalse(Schema::hasColumn('users', 'tenant_id'));

        $user = User::factory()->create();

        $this->assertNotNull($user->public_id);
        $this->assertSame(26, strlen($user->public_id));
        $this->assertSame(AccountState::Active, $user->account_state);
        $this->assertTrue($user->permitsAuthentication());
    }

    public function test_non_patient_identity_fields_can_be_absent(): void
    {
        $user = User::query()->create([
            'name' => 'Foundation Admin',
            'email' => 'foundation-admin@example.test',
            'password' => 'password',
        ]);

        $this->assertNull($user->phone);
        $this->assertNull($user->birth_date);
        $this->assertNull($user->NID);
        $this->assertNull($user->patient_status);
    }

    public function test_auth_framework_and_authorization_tables_are_present(): void
    {
        foreach ([
            'password_reset_tokens',
            'sessions',
            'personal_access_tokens',
            'cache',
            'cache_locks',
            'jobs',
            'job_batches',
            'failed_jobs',
            'permissions',
            'roles',
            'model_has_permissions',
            'model_has_roles',
            'role_has_permissions',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Expected the {$table} table to exist.");
        }
    }
}
