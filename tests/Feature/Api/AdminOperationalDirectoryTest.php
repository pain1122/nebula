<?php

namespace Tests\Feature\Api;

use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\Specialty;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOperationalDirectoryTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated directory acceptance only.');
        }
        parent::setUp();
    }

    private function user(string $role = 'patient', array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $user->syncRoles([$role]);

        return $user;
    }

    private function actor(string $role = 'admin'): static
    {
        return $this->actingAs($this->user($role))->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }

    public function test_composed_doctor_filters_return_safe_metadata_and_no_audit_write(): void
    {
        $doctor = $this->user('doctor', ['name' => 'Synthetic Doctor', 'email' => 'private@example.test']);
        $specialty = Specialty::factory()->create();
        $profile = DoctorProfile::factory()->create(['user_id' => $doctor->id, 'verified' => true,
            'specialty_id' => $specialty->id, 'bio' => 'SECRET BIO', 'phone' => 'SECRET PHONE']);
        $workplace = DoctorWorkplace::factory()->create(['doctor_profile_id' => $profile->id]);
        DoctorWorkplace::factory()->create(['doctor_profile_id' => $profile->id, 'is_active' => false]);
        DoctorProfile::factory()->create(['user_id' => $this->user('doctor')->id, 'verified' => false]);
        $this->user('patient', ['name' => 'Synthetic Patient']);
        $query = http_build_query(['role' => 'doctor', 'q' => 'Synthetic', 'account_state' => 'active',
            'verification' => 'verified', 'specialty_id' => $specialty->id, 'workplace_id' => $workplace->id]);
        $response = $this->actor()->getJson('/api/admin/users?'.$query)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('meta.pagination.total', 1);
        $row = $response->json('data.users.0');
        $this->assertSame($doctor->public_id, $row['public_id']);
        $this->assertSame(['id' => $profile->id, 'verified' => true, 'specialty' => $specialty->name,
            'active_workplaces_count' => 1], $row['doctor_profile']);
        foreach (['email', 'phone', 'birth_date', 'NID', 'bio', 'city', 'country', 'zip_code'] as $field) {
            $this->assertNull($row[$field]);
        }
        foreach (['SECRET BIO', 'SECRET PHONE', 'private@example.test'] as $secret) {
            $this->assertStringNotContainsString($secret, $response->getContent());
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_missing_deleted_unverified_and_secondary_specialty_are_distinct(): void
    {
        $missing = $this->user('doctor');
        $deleted = $this->user('doctor');
        DoctorProfile::factory()->create(['user_id' => $deleted->id])->delete();
        $unverified = $this->user('doctor');
        $profile = DoctorProfile::factory()->create(['user_id' => $unverified->id, 'verified' => false]);
        $secondary = Specialty::factory()->create();
        $profile->specialties()->attach($secondary->id);
        $this->actor()->getJson('/api/admin/users?role=doctor&verification=missing')->assertOk()
            ->assertJsonPath('meta.pagination.total', 2);
        $rows = $this->getJson('/api/admin/users?role=doctor&verification=missing')->json('data.users');
        $this->assertEqualsCanonicalizing([$missing->public_id, $deleted->public_id], array_column($rows, 'public_id'));
        $this->getJson('/api/admin/users?role=doctor&verification=unverified&specialty_id='.$secondary->id)
            ->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.users.0.id', $unverified->id);
    }

    public function test_account_state_scope_and_privileged_role_exclusion_are_preserved(): void
    {
        $patient = $this->user('patient', ['account_state' => 'suspended']);
        $this->user('doctor', ['account_state' => 'suspended']);
        $root = $this->user('root-admin');
        $root->assignRole('patient');
        $privileged = $this->user('admin');
        $privileged->assignRole('patient');
        $this->actor()->getJson('/api/admin/users?role=patient&account_state=suspended')->assertOk()
            ->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.users.0.id', $patient->id);
        $this->getJson('/api/admin/users?role=admin')->assertForbidden();
        $this->getJson('/api/admin/users?role=root-admin')->assertForbidden();
        $normal = $this->getJson('/api/admin/users?role=patient')->json('data.users');
        $this->assertNotContains($privileged->id, array_column($normal, 'id'));
        $this->actor('root-admin')->getJson('/api/admin/users?role=admin')->assertOk();
        $this->getJson('/api/admin/users?role=root-admin')->assertForbidden();
        $this->actor('patient')->getJson('/api/admin/users')->assertForbidden();
        $this->actor('doctor')->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_invalid_filter_shapes_bounds_and_private_sorts_are_rejected(): void
    {
        $this->actor();
        foreach (['role[]=doctor', 'range[]=week', 'account_state[]=active', 'verification[]=verified',
            'specialty_id=0', 'workplace_id=-1', 'page=0', 'page=1001', 'per_page=101',
            'role=unknown', 'range=unknown', 'account_state=unknown', 'role=doctor&verification=unknown',
            'role=patient&verification=verified', 'specialty_id=1', 'sort_by=email', 'sort_by=phone', 'q[]=private'] as $query) {
            $this->getJson('/api/admin/users?'.$query)->assertUnprocessable();
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_tied_sort_is_stable_and_public_id_search_has_no_contact_search(): void
    {
        $first = $this->user('patient', ['name' => 'Tied', 'email' => 'hidden-lookup@example.test']);
        $second = $this->user('patient', ['name' => 'Tied']);
        $this->actor()->getJson('/api/admin/users?role=patient&sort_by=name&sort_dir=asc&per_page=1')
            ->assertOk()->assertJsonPath('data.users.0.id', $second->id);
        $this->getJson('/api/admin/users?role=patient&sort_by=name&sort_dir=asc&per_page=1&page=2')
            ->assertOk()->assertJsonPath('data.users.0.id', $first->id);
        $this->getJson('/api/admin/users?role=patient&q='.$first->public_id)->assertOk()
            ->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/users?role=patient&q=hidden-lookup')->assertOk()
            ->assertJsonPath('meta.pagination.total', 0);
    }
}
