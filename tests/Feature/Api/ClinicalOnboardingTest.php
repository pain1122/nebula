<?php

namespace Tests\Feature\Api;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\DoctorScheduleService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class ClinicalOnboardingTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $environment = getenv('LARAVEL_STORAGE_PATH');
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
            || getenv('DB_URL') || posix_geteuid() !== 33 || ! is_string($environment)
            || ! str_starts_with($environment, '/tmp/checkupino-doctor-panel-') || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || ! is_dir($environment) || file_exists($environment.'/config.php') || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')
            || ! is_file($environment.'/empty.environment') || filesize($environment.'/empty.environment') !== 0) {
            throw new RuntimeException('Doctor panel tests require explicit SQLite memory, UID33, empty isolated environment and no project cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment)->loadEnvironmentFrom('empty.environment');
        $app->make(Kernel::class)->bootstrap();
        // Public synthetic key for isolated stateful fixtures only; no project key is read or changed.
        config(['app.key' => 'base64:'.base64_encode(str_repeat('i', 32))]);
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:' || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective isolated database guard failed before schema setup.');
        }

        return $app;
    }

    public function test_hospital_creation_and_edit_require_guards_and_keep_price_out_of_the_organization(): void
    {
        $this->signIn(User::factory()->admin()->create());
        $revision = $this->getJson('/api/admin/hospitals/create-context')->assertOk()->json('data.revision');
        $data = ['name' => 'Synthetic clinic', 'slug' => 'synthetic-clinic', 'timezone' => 'Asia/Tehran', 'is_active' => true,
            'expected_revision' => $revision, 'confirmed' => true, 'reason' => 'Synthetic directory entry'];
        $this->postJson('/api/admin/hospitals', [...$data, 'price' => 100])->assertUnprocessable();
        $this->postJson('/api/admin/hospitals', [...$data, 'confirmed' => false])->assertUnprocessable();
        $created = $this->postJson('/api/admin/hospitals', $data)->assertOk()->json('data.hospital');
        $this->assertArrayNotHasKey('price', $created);
        $detail = $this->getJson('/api/admin/hospitals/'.$created['public_id'])->assertOk()->json('data');
        $next = [...$data, 'name' => 'Synthetic updated clinic', 'expected_revision' => $detail['revision']];
        $this->putJson('/api/admin/hospitals/'.$created['public_id'], $next)->assertOk();
        $this->putJson('/api/admin/hospitals/'.$created['public_id'], $next)->assertConflict();
        $this->getJson('/api/admin/hospitals?q=updated')->assertOk()->assertJsonPath('data.total', 1);
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_manual_clinical_creation_is_fixed_role_private_and_creates_a_verified_profile_only_when_requested(): void
    {
        $this->signIn(User::factory()->admin()->create());
        $specialty = Specialty::factory()->create();
        $revision = $this->getJson('/api/admin/clinical-accounts/create-context')->assertOk()->json('data.revision');
        $data = ['role' => 'doctor', 'first_name' => 'Synthetic', 'last_name' => 'Clinician', 'email' => 'synthetic-new@example.test',
            'phone' => '09000000123', 'NID' => '1234567890', 'birth_date' => '1990-01-01', 'password' => 'cedar lantern valley compass', 'password_confirmation' => 'cedar lantern valley compass',
            'specialty_id' => $specialty->id, 'experience_years' => 7, 'fee' => 450000, 'verified' => true,
            'expected_revision' => $revision, 'reason' => 'Synthetic guarded onboarding', 'confirmed' => true];
        $this->postJson('/api/admin/clinical-accounts', [...$data, 'role' => 'root-admin'])->assertUnprocessable();
        $result = $this->postJson('/api/admin/clinical-accounts', $data)->assertOk()->assertJsonPath('data.user.email', null)->assertJsonPath('data.user.NID', null);
        $user = User::findOrFail($result->json('data.user.id'));
        $this->assertTrue(Hash::check($data['password'], $user->password));
        $this->assertTrue($user->hasRole('doctor'));
        $this->assertTrue($user->doctorProfile->verified);
        $this->assertNotNull($user->doctorProfile->verified_by);
        $this->assertSame(450000, (int) $user->doctorProfile->fee);
        $this->assertSame($specialty->id, $user->doctorProfile->specialties()->first()->id);
        $this->assertStringNotContainsString($data['password'], $result->getContent());
        $this->assertStringNotContainsString($data['NID'], DB::table('audit_events')->get()->toJson());
        $patient = array_diff_key($data, array_flip(['specialty_id', 'experience_years', 'fee', 'verified']));
        $patient = [...$patient, 'role' => 'patient', 'email' => 'synthetic-patient@example.test', 'phone' => '09000000124', 'NID' => '1234567891',
            'expected_revision' => $this->getJson('/api/admin/clinical-accounts/create-context')->json('data.revision')];
        $id = $this->postJson('/api/admin/clinical-accounts', $patient)->assertOk()->json('data.user.id');
        $this->assertNull(User::findOrFail($id)->doctorProfile);
    }

    public function test_doctor_selects_two_hospitals_with_independent_days_and_doctor_owned_prices(): void
    {
        $actor = User::factory()->doctor()->create();
        $profile = DoctorProfile::factory()->create(['user_id' => $actor->id, 'fee' => 350000]);
        $a = MarketplaceHospital::factory()->create(['timezone' => 'Asia/Tehran']);
        $b = MarketplaceHospital::factory()->create(['timezone' => 'Asia/Tehran']);
        $service = Checkup::factory()->create(['price' => 999999]);
        $this->signIn($actor);
        foreach ([$a, $b] as $hospital) {
            $options = $this->getJson('/api/doctor/location-options')->assertOk()->json('data');
            $option = collect($options['hospitals'])->firstWhere('public_id', $hospital->public_id);
            $body = ['hospital_public_id' => $hospital->public_id, 'hospital_revision' => $option['revision'], 'expected_revision' => $options['revision'],
                'services' => [['id' => $service->id, 'price' => 450000, 'currency' => 'IRR']], 'reason' => 'Synthetic own location', 'confirmed' => true];
            $this->postJson('/api/doctor/locations', [...$body, 'doctor_profile_id' => 123])->assertUnprocessable();
            $this->postJson('/api/doctor/locations', $body)->assertOk();
            $this->postJson('/api/doctor/locations', $body)->assertConflict();
        }
        $places = $profile->workplaces()->orderBy('id')->get();
        config(['scheduling.materialization_days' => 7]);
        foreach ($places as $index => $place) {
            app(DoctorScheduleService::class)->replaceWeeklyRules($place, [['day' => $index ? 'mon' : 'sun', 'windows' => [['checkup_id' => $service->id, 'start' => '08:00', 'end' => '12:00', 'duration_minutes' => 30, 'breaks' => [['start' => '10:00', 'end' => '10:30']]]]]]);
            $this->assertSame($index ? 1 : 0, $place->workingWindows()->first()->weekday);
            $this->assertSame(450000, (int) $place->visitSlots()->firstOrFail()->price);
        }
        $places[0]->checkups()->updateExistingPivot($service->id, ['price_override' => null]);
        $existing = $places[0]->visitSlots()->firstOrFail();
        $stable = $existing->getAttributes();
        app(DoctorScheduleService::class)->replaceWeeklyRules($places[0], [['day' => 'tue', 'windows' => [['checkup_id' => $service->id, 'start' => '08:00', 'end' => '09:00', 'duration_minutes' => 30]]]]);
        $this->assertSame(350000, (int) $places[0]->visitSlots()->where('is_active', true)->orderByDesc('id')->firstOrFail()->price);
        $this->assertSame($stable['price'], $existing->fresh()->getAttributes()['price']);
    }

    public function test_audit_failure_rolls_back_hospital_and_clinical_onboarding(): void
    {
        $this->signIn(User::factory()->admin()->create());
        $revision = $this->getJson('/api/admin/hospitals/create-context')->json('data.revision');
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit refusal'));
        $this->postJson('/api/admin/hospitals', ['name' => 'Rollback clinic', 'slug' => 'rollback-clinic', 'timezone' => 'Asia/Tehran', 'is_active' => true,
            'expected_revision' => $revision, 'confirmed' => true, 'reason' => 'Synthetic atomicity'])->assertStatus(500);
        $this->assertDatabaseMissing('marketplace_hospitals', ['slug' => 'rollback-clinic']);
    }

    public function test_doctors_and_patients_cannot_manage_hospitals_or_create_identities_and_stale_authority_refuses(): void
    {
        foreach (['doctor', 'patient'] as $role) {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->signIn($actor);
            $this->getJson('/api/admin/hospitals')->assertForbidden();
            $this->getJson('/api/admin/clinical-accounts/create-context')->assertForbidden();
            $this->postJson('/api/admin/clinical-accounts', [])->assertForbidden();
        }
        $this->getJson('/api/doctor/location-options')->assertForbidden();
    }

    public function test_own_location_price_edits_preserve_published_slots_and_roll_back_on_audit_failure(): void
    {
        $actor = User::factory()->doctor()->create();
        $profile = DoctorProfile::factory()->create(['user_id' => $actor->id, 'fee' => 350000]);
        $hospital = MarketplaceHospital::factory()->create();
        $place = DoctorWorkplace::factory()->create(['doctor_profile_id' => $profile->id, 'marketplace_hospital_id' => $hospital->id]);
        $service = Checkup::factory()->create();
        $place->checkups()->attach($service->id, ['price_override' => 450000, 'currency_override' => 'IRR', 'is_active' => true]);
        config(['scheduling.materialization_days' => 7]);
        app(DoctorScheduleService::class)->replaceWeeklyRules($place, [['day' => 'mon', 'windows' => [['checkup_id' => $service->id, 'start' => '08:00', 'end' => '09:00', 'duration_minutes' => 30]]]]);
        $slots = DoctorVisitSlot::orderBy('id')->get()->toArray();
        $this->signIn($actor);
        $payload = ['expected_revision' => $this->getJson('/api/doctor/practice')->json('data.revision'), 'confirmed' => true, 'reason' => 'Synthetic own price update',
            'services' => [['id' => $service->id, 'price' => 600000, 'currency' => 'IRR']]];
        $path = '/api/doctor/locations/'.$place->id.'/services';
        $this->putJson($path, $payload)->assertOk();
        $this->assertSame(600000, (int) $place->checkups()->first()->pivot->price_override);
        $this->assertSame($slots, DoctorVisitSlot::orderBy('id')->get()->toArray());
        $audit = \App\Models\AuditEvent::where('action', 'doctor.location.prices.updated')->firstOrFail();
        $this->assertSame(450000, $audit->before['services'][0]['price']);
        $this->assertSame(600000, $audit->after['services'][0]['price']);
        $this->putJson($path, $payload)->assertConflict();
        $payload['expected_revision'] = $this->getJson('/api/doctor/practice')->json('data.revision');
        $this->putJson($path, $payload)->assertUnprocessable();
        $payload['services'][0]['price'] = 700000;
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic price audit failure'));
        $this->putJson($path, $payload)->assertStatus(500);
        $this->assertSame(600000, (int) $place->checkups()->first()->pivot->price_override);
        $other = User::factory()->doctor()->create();
        DoctorProfile::factory()->create(['user_id' => $other->id]);
        $this->signIn($other)->putJson($path, $payload)->assertNotFound();
    }

    public function test_location_add_refuses_changed_or_inactive_hospitals_and_rolls_back_after_audit_failure(): void
    {
        $actor = User::factory()->doctor()->create();
        $profile = DoctorProfile::factory()->create(['user_id' => $actor->id]);
        $hospital = MarketplaceHospital::factory()->create();
        $service = Checkup::factory()->create();
        $this->signIn($actor);
        $options = $this->getJson('/api/doctor/location-options')->assertOk()->json('data');
        $payload = ['hospital_public_id' => $hospital->public_id, 'hospital_revision' => $options['hospitals'][0]['revision'], 'expected_revision' => $options['revision'],
            'services' => [['id' => $service->id, 'price' => 450000, 'currency' => 'IRR']], 'reason' => 'Synthetic location refusal', 'confirmed' => true];
        $hospital->update(['name' => 'Changed hospital']);
        $this->postJson('/api/doctor/locations', $payload)->assertConflict();
        $hospital->is_active = false;
        $hospital->save();
        $this->postJson('/api/doctor/locations', $payload)->assertUnprocessable();
        $hospital->is_active = true;
        $hospital->save();
        $options = $this->getJson('/api/doctor/location-options')->json('data');
        $payload['hospital_revision'] = $options['hospitals'][0]['revision'];
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic location audit failure'));
        $this->postJson('/api/doctor/locations', $payload)->assertStatus(500);
        $this->assertDatabaseMissing('doctor_workplaces', ['doctor_profile_id' => $profile->id]);
        $this->assertDatabaseCount('doctor_workplace_checkup', 0);
    }

    public function test_step_up_and_locked_fresh_admin_authority_are_required_for_onboarding(): void
    {
        $actor = User::factory()->admin()->create();
        $this->signIn($actor)->withSession(['auth.password_confirmed_at' => 0]);
        $this->postJson('/api/admin/clinical-accounts', [])->assertStatus(423);
        $this->postJson('/api/admin/hospitals', [])->assertStatus(423);
        $actor->syncRoles(['patient']);
        $this->getJson('/api/admin/hospitals/create-context')->assertForbidden();
    }

    public function test_late_doctor_audit_failure_rolls_back_credentials_roles_and_profile(): void
    {
        $this->signIn(User::factory()->admin()->create());
        $specialty = Specialty::factory()->create();
        $revision = $this->getJson('/api/admin/clinical-accounts/create-context')->json('data.revision');
        $calls = 0;
        $this->mock(AuditLogger::class)->shouldReceive('log')->twice()->andReturnUsing(function () use (&$calls) {
            if (++$calls === 2) {
                throw new RuntimeException('Synthetic late onboarding failure');
            }

            return new \App\Models\AuditEvent;
        });
        $this->postJson('/api/admin/clinical-accounts', ['role' => 'doctor', 'first_name' => 'Synthetic', 'last_name' => 'Rollback', 'email' => 'rollback-onboarding@example.test',
            'phone' => '09000000123', 'NID' => '1234567890', 'birth_date' => '1990-01-01', 'password' => 'cedar lantern valley compass', 'password_confirmation' => 'cedar lantern valley compass',
            'specialty_id' => $specialty->id, 'experience_years' => 7, 'fee' => 450000, 'verified' => false,
            'expected_revision' => $revision, 'reason' => 'Synthetic rollback onboarding', 'confirmed' => true])->assertStatus(500);
        $this->assertDatabaseMissing('users', ['email' => 'rollback-onboarding@example.test']);
        $this->assertDatabaseCount('doctor_profiles', 0);
    }

    private function signIn(User $actor): static
    {
        return $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withHeader('Referer', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);
    }
}
