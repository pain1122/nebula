<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class StaffDirectoryTest extends TestCase
{
    use IsolatedProfileApplication, RefreshDatabase;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated staff-directory acceptance only.');
        }
        parent::setUp();
    }

    private function actor(string $role = 'root-admin'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);
        $this->actingAs($user)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000']);

        return $user;
    }

    public function test_staff_list_requires_current_active_root_and_excludes_all_clinical_and_root_identities(): void
    {
        $this->getJson('/api/admin/staff')->assertUnauthorized();
        foreach (['admin', 'doctor', 'patient'] as $role) {
            $this->actor($role);
            $this->getJson('/api/admin/staff')->assertForbidden();
        }
        $mixed = User::factory()->create();
        $mixed->syncRoles(['admin', 'doctor']);
        $mixedPatient = User::factory()->create();
        $mixedPatient->syncRoles(['patient', 'admin']);
        $this->actor();
        $response = $this->getJson('/api/admin/staff')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.users.0.role', 'admin');
        $this->assertSame(['admin'], User::findOrFail($response->json('data.users.0.id'))->roles->pluck('name')->all());
        foreach (['email', 'phone', 'birth_date', 'NID', 'bio'] as $field) {
            $this->assertNull($response->json('data.users.0.'.$field));
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_root_staff_filters_cannot_select_or_search_clinical_users_or_bypass_bounds(): void
    {
        $patient = User::factory()->create(['name' => 'Clinical Secret']);
        $patient->syncRoles(['patient']);
        $this->actor('admin');
        $this->actor();
        $this->getJson('/api/admin/staff?q=Clinical')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        foreach (['role=patient', 'role=doctor', 'role=root-admin', 'role[]=admin', 'per_page=101', 'page=0', 'sort_by=email', 'verification=verified', 'q[]=private'] as $query) {
            $this->getJson('/api/admin/staff?'.$query)->assertUnprocessable();
        }
        $this->getJson('/api/admin/staff?role=admin&sort_by=name&account_state=active')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_cached_root_role_revocation_or_suspension_refuses_staff_read(): void
    {
        $actor = $this->actor();
        $actor->load('roles');
        User::findOrFail($actor->id)->syncRoles(['admin']);
        $this->getJson('/api/admin/staff')->assertForbidden();
        User::findOrFail($actor->id)->syncRoles(['root-admin']);
        User::whereKey($actor->id)->update(['account_state' => 'suspended']);
        $this->getJson('/api/admin/staff')->assertForbidden();
    }

    public function test_mid_read_root_revocation_refuses_response(): void
    {
        $actor = $this->actor();
        $changed = false;
        DB::listen(function ($query) use (&$changed, $actor): void {
            if (! $changed && str_contains($query->sql, 'count(*)') && str_contains($query->sql, 'users')) {
                $changed = true;
                User::findOrFail($actor->id)->syncRoles(['admin']);
            }
        });
        $this->getJson('/api/admin/staff')->assertForbidden();
        $this->assertTrue($changed);
    }

    public function test_admin_clinical_directories_and_metadata_support_profiles_remain_available(): void
    {
        $patient = User::factory()->create();
        $patient->syncRoles(['patient']);
        $doctor = User::factory()->create();
        $doctor->syncRoles(['doctor']);
        $this->actor('admin');
        foreach (['patient', 'doctor'] as $role) {
            $this->getJson('/api/admin/users?role='.$role)->assertOk()->assertJsonPath('meta.pagination.total', 1);
        }
        $this->getJson('/api/admin/users/'.$patient->public_id.'/support-profile')->assertOk();
        $this->assertDatabaseCount('audit_events', 0);
    }
}
