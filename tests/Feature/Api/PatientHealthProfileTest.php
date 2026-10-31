<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\PatientBiometricObservation;
use App\Models\PatientHealthSnapshot;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Health\HealthCatalog;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class PatientHealthProfileTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $environment = getenv('LARAVEL_STORAGE_PATH');
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
            || getenv('DB_URL') || posix_geteuid() !== 33 || ! is_string($environment)
            || ! str_starts_with($environment, '/tmp/checkupino-health-') || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || ! is_dir($environment) || file_exists($environment.'/config.php') || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')
            || ! is_file($environment.'/empty.environment') || filesize($environment.'/empty.environment') !== 0) {
            throw new RuntimeException('Health tests require isolated SQLite memory, empty environment, UID33 and no project cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment)->loadEnvironmentFrom('empty.environment');
        $app->make(Kernel::class)->bootstrap();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('i', 32)), 'patient_health.enabled' => true]);
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:' || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective isolated database guard failed.');
        }

        return $app;
    }

    private function signIn(?User $actor = null): User
    {
        $actor ??= User::factory()->patient()->create();
        $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function body(array $changes = [], array $measurements = []): array
    {
        return ['expected_revision' => $this->getJson('/api/my/health-profile')->assertOk()->json('data.revision'),
            'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true, 'changes' => $changes, 'measurements' => $measurements];
    }

    private function measurement(string $value = '63', string $day = '2026-10-01'): array
    {
        return ['value' => $value, 'measured_on' => $day];
    }

    public function test_fresh_profile_does_not_import_identity_birth_date_or_legacy_notes_and_is_owner_bound(): void
    {
        $actor = $this->signIn();
        $actor->profile()->create(['allergies' => 'PRIVATE legacy penicillin', 'chronic_diseases' => 'PRIVATE diabetes']);
        $response = $this->getJson('/api/my/health-profile')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->assertSame([], $response->json('data.facts'));
        $this->assertNull($response->json('data.age'));
        $this->assertNull($response->json('data.bmi'));
        $this->assertSame($actor->public_id, $response->json('data.owner_id'));
        $response->assertDontSee('PRIVATE');
        $this->getJson('/api/my/health-profile?patient_id=1')->assertUnprocessable();
    }

    public function test_taxonomies_are_canonical_bilingual_and_reject_unknown_wrong_kind_duplicates_and_free_text(): void
    {
        $this->signIn();
        $base = $this->body();
        foreach ([['status' => 'yes', 'codes' => ['diabtes']], ['status' => 'yes', 'codes' => ['allergy.latex']],
            ['status' => 'no', 'codes' => ['condition.diabetes']], ['status' => 'yes', 'codes' => ['condition.diabetes', 'condition.diabetes']],
            ['status' => 'yes', 'codes' => ['condition.diabetes'], 'note' => 'free text'], 'diabetes'] as $invalid) {
            $this->putJson('/api/my/health-profile', [...$base, 'changes' => ['conditions' => $invalid]])->assertUnprocessable();
        }
        $this->putJson('/api/my/health-profile', [...$base, 'changes' => ['conditions' => ['status' => 'yes', 'codes' => ['condition.diabetes']], 'allergies' => ['status' => 'unknown', 'codes' => []]]])
            ->assertOk()->assertJsonPath('data.facts.conditions.codes.0', 'condition.diabetes')->assertJsonPath('data.facts.allergies.status', 'unknown');
        $term = $this->getJson('/api/my/health-profile')->json('data.catalog.terms.0');
        $this->assertNotEmpty($term['labels']['fa']);
        $this->assertNotEmpty($term['labels']['en']);
    }

    public function test_append_only_measurements_age_bmi_encryption_and_redacted_audit(): void
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-22 12:00:00', 'Asia/Tehran'));
        $actor = $this->signIn();
        $originalBirth = $actor->getRawOriginal('birth_date');
        $response = $this->putJson('/api/my/health-profile', $this->body(['birth_date' => '2000-10-23', 'gender' => 'female', 'smoking' => 'declined'],
            ['weight' => $this->measurement('۶۳٫۵'), 'height' => $this->measurement('۱۷۲')]))->assertUnprocessable();
        // Digits normalize; decimal separator is explicitly a period, never guessed.
        $response = $this->putJson('/api/my/health-profile', $this->body(['birth_date' => '2000-10-23', 'gender' => 'female', 'smoking' => 'declined'],
            ['weight' => $this->measurement('۶۳.۵'), 'height' => $this->measurement('۱۷۲')]))->assertOk();
        $response->assertJsonPath('data.age', 25)->assertJsonPath('data.bmi', 21.46)->assertJsonPath('data.measurements.weight.value', '63.50');
        $this->assertSame($originalBirth, $actor->fresh()->getRawOriginal('birth_date'));
        $raw = DB::table('patient_health_snapshots')->value('payload');
        foreach (['2000-10-23', 'female', 'declined'] as $secret) {
            $this->assertStringNotContainsString($secret, $raw);
        }
        $audit = AuditEvent::latest('id')->firstOrFail();
        $this->assertSame(['snapshot_id', 'version', 'schema_version', 'changed_count', 'observation_count'], array_keys($audit->after));
        $this->assertNull($audit->reason);
        $before = PatientBiometricObservation::firstOrFail()->getRawOriginal('payload');
        $this->putJson('/api/my/health-profile', $this->body(['stress' => 'no']))->assertOk()->assertJsonPath('data.measurements.weight.measured_on', '2026-10-01');
        $this->assertSame($before, PatientBiometricObservation::firstOrFail()->getRawOriginal('payload'));
        $this->assertDatabaseCount('patient_biometric_observations', 2);
        $this->assertDatabaseCount('patient_health_snapshots', 2);
    }

    public function test_stale_duplicate_noop_and_client_override_refusal(): void
    {
        $this->signIn();
        $body = $this->body(['gender' => 'male']);
        $this->putJson('/api/my/health-profile', [...$body, 'bmi' => 20])->assertUnprocessable();
        $this->putJson('/api/my/health-profile', [...$body, 'confirmed' => false])->assertUnprocessable();
        $this->putJson('/api/my/health-profile', [...$body, 'catalog_version' => 'unknown'])->assertUnprocessable();
        $this->putJson('/api/my/health-profile', $body)->assertOk();
        $this->putJson('/api/my/health-profile', $body)->assertConflict();
        $this->putJson('/api/my/health-profile', $this->body(['gender' => 'male']))->assertUnprocessable();
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_missing_none_unknown_declined_and_explicit_clear_retain_history(): void
    {
        $this->signIn();
        foreach (['yes', 'no', 'unknown', 'declined', null] as $status) {
            $this->putJson('/api/my/health-profile', $this->body(['family_history' => $status]))->assertOk()->assertJsonPath('data.facts.family_history', $status);
        }
        $this->assertDatabaseCount('patient_health_snapshots', 5);
        $this->assertSame('yes', PatientHealthSnapshot::orderBy('id')->firstOrFail()->payload['facts']['family_history']['value']);
    }

    public function test_dates_quantity_units_and_child_bmi_have_no_clinical_classification(): void
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-22 12:00:00', 'Asia/Tehran'));
        $this->signIn();
        $base = $this->body();
        foreach (['2025-02-29', '2026-10-23', '1400/01/01', '1899-12-31'] as $date) {
            $this->putJson('/api/my/health-profile', [...$base, 'changes' => ['birth_date' => $date]])->assertUnprocessable();
        }
        foreach (['0', '-1', '1e2', '1,000', 'NaN', '1000.01', '1.123'] as $value) {
            $this->travel(61)->seconds();
            $this->putJson('/api/my/health-profile', [...$base, 'measurements' => ['weight' => $this->measurement($value)]])->assertUnprocessable();
        }
        $this->putJson('/api/my/health-profile', [...$base, 'measurements' => ['weight' => [...$this->measurement(), 'unit' => 'lb']]])->assertUnprocessable();
        $this->putJson('/api/my/health-profile', [...$base, 'changes' => ['birth_date' => '2020-02-29'], 'measurements' => ['height' => $this->measurement('110'), 'weight' => $this->measurement('20')]])
            ->assertOk()->assertJsonPath('data.age', 6)->assertJsonMissingPath('data.bmi_category');
    }

    public function test_corrections_are_same_owner_same_metric_and_history_is_immutable(): void
    {
        $a = $this->signIn();
        $first = $this->putJson('/api/my/health-profile', $this->body([], ['weight' => $this->measurement()]))->assertOk()->json('data.measurements.weight.id');
        $this->putJson('/api/my/health-profile', $this->body([], ['height' => [...$this->measurement('172'), 'correction_of' => $first]]))->assertUnprocessable();
        $b = $this->signIn();
        $this->putJson('/api/my/health-profile', $this->body([], ['weight' => [...$this->measurement('64'), 'correction_of' => $first]]))->assertUnprocessable();
        $this->signIn($a);
        $this->putJson('/api/my/health-profile', $this->body([], ['weight' => [...$this->measurement('64'), 'correction_of' => $first]]))->assertOk();
        $this->assertSame(1, PatientBiometricObservation::latest('id')->firstOrFail()->corrects_id);
        $this->putJson('/api/my/health-profile', $this->body([], ['weight' => null]))->assertOk()->assertJsonMissingPath('data.measurements.weight');
        $this->assertDatabaseCount('patient_biometric_observations', 2);
        $this->signIn($b);
        $this->getJson('/api/my/health-profile')->assertJsonPath('data.history.weight', []);
        $this->expectException(\LogicException::class);
        PatientHealthSnapshot::firstOrFail()->delete();
    }

    public function test_audit_failure_rolls_back_observations_and_snapshot(): void
    {
        $this->signIn();
        $body = $this->body(['gender' => 'female'], ['weight' => $this->measurement()]);
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit failure'));
        $this->putJson('/api/my/health-profile', $body)->assertStatus(503);
        $this->assertDatabaseCount('patient_health_snapshots', 0);
        $this->assertDatabaseCount('patient_biometric_observations', 0);
    }

    public function test_other_roles_stale_authority_recent_password_and_activation_gate(): void
    {
        $this->getJson('/api/my/health-profile')->assertUnauthorized();
        foreach (['doctor', 'admin', 'root-admin'] as $role) {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->signIn($actor);
            $this->getJson('/api/my/health-profile')->assertForbidden();
            $this->putJson('/api/my/health-profile', [])->assertForbidden();
        }
        $actor = $this->signIn();
        $body = $this->body(['gender' => 'female']);
        $this->withSession(['auth.password_confirmed_at' => 0])->putJson('/api/my/health-profile', $body)->assertStatus(423);
        $this->signIn($actor);
        $actor->assignRole('admin');
        $this->getJson('/api/my/health-profile')->assertForbidden();
        $actor->removeRole('admin');
        $actor->forceFill(['account_state' => 'suspended'])->save();
        $this->getJson('/api/my/health-profile')->assertForbidden();
        $actor->forceFill(['account_state' => 'active'])->save();
        config(['patient_health.enabled' => false]);
        $this->getJson('/api/my/health-profile')->assertStatus(503);
    }

    public function test_unreadable_and_future_schema_history_never_becomes_an_empty_profile_or_overwrite(): void
    {
        $this->signIn();
        $this->putJson('/api/my/health-profile', $this->body(['gender' => 'male']))->assertOk();
        $body = $this->body(['stress' => 'yes']);
        DB::table('patient_health_snapshots')->update(['payload' => 'synthetic-invalid-ciphertext']);
        $this->getJson('/api/my/health-profile')->assertStatus(503)->assertDontSee('synthetic-invalid');
        $this->putJson('/api/my/health-profile', $body)->assertConflict();
        $this->assertDatabaseCount('patient_health_snapshots', 1);
    }

    public function test_empty_migration_down_up_and_nonempty_rollback_retention(): void
    {
        $migration = require database_path('migrations/2026_10_22_000001_create_patient_health_foundation_tables.php');
        $migration->down();
        $migration->up();
        $this->signIn();
        $this->putJson('/api/my/health-profile', $this->body(['gender' => 'female']))->assertOk();
        try {
            $migration->down();
            $this->fail('Populated rollback must refuse.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('retain', $error->getMessage());
        }
        $this->assertDatabaseCount('patient_health_snapshots', 1);
        $this->assertDatabaseCount('patient_biometric_observations', 0);
    }
}
