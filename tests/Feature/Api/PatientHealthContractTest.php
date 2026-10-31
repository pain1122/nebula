<?php

namespace Tests\Feature\Api;

use App\Models\PatientBiometricObservation;
use App\Models\PatientHealthSnapshot;
use App\Models\User;
use App\Services\Health\HealthCatalog;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class PatientHealthContractTest extends TestCase
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
            throw new RuntimeException('Health contract tests require isolated SQLite memory, empty environment, UID33 and no project cache.');
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

    private function save(array $changes = [], array $measurements = []): void
    {
        $this->putJson('/api/my/health-profile', ['expected_revision' => $this->getJson('/api/my/health-profile')->assertOk()->json('data.revision'),
            'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true, 'changes' => $changes, 'measurements' => $measurements])->assertOk();
    }

    public function test_foreign_snapshot_ciphertext_is_not_accepted_under_another_owner(): void
    {
        $a = $this->signIn();
        $this->save(['gender' => 'female']);
        $this->signIn();
        $this->save(['gender' => 'male']);
        $rows = PatientHealthSnapshot::orderBy('id')->get();
        DB::table('patient_health_snapshots')->where('id', $rows[0]->id)->update(['payload' => $rows[1]->getRawOriginal('payload')]);
        $this->signIn($a);
        $this->getJson('/api/my/health-profile')->assertStatus(503)->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data', null);
        $this->assertDatabaseCount('patient_health_snapshots', 2);
    }

    public function test_foreign_observation_ciphertext_and_foreign_or_missing_references_fail_closed(): void
    {
        $a = $this->signIn();
        $this->save([], ['weight' => ['value' => '63', 'measured_on' => '2026-10-01']]);
        $this->signIn();
        $this->save([], ['weight' => ['value' => '65', 'measured_on' => '2026-10-02']]);
        $observations = PatientBiometricObservation::orderBy('id')->get();
        $ownCipher = $observations[0]->getRawOriginal('payload');
        DB::table('patient_biometric_observations')->where('id', $observations[0]->id)->update(['payload' => $observations[1]->getRawOriginal('payload')]);
        $this->signIn($a);
        $this->getJson('/api/my/health-profile')->assertStatus(503);
        DB::table('patient_biometric_observations')->where('id', $observations[0]->id)->update(['payload' => $ownCipher]);
        $snapshot = PatientHealthSnapshot::where('patient_id', $a->id)->firstOrFail();
        foreach ([$observations[1]->public_id, strtolower((string) Str::ulid())] as $invalid) {
            $payload = $snapshot->payload;
            $payload['observations']['weight'] = $invalid;
            $cipher = app('encrypter')->encryptString(json_encode($payload, JSON_THROW_ON_ERROR));
            DB::table('patient_health_snapshots')->where('id', $snapshot->id)->update(['payload' => $cipher]);
            $this->getJson('/api/my/health-profile')->assertStatus(503)->assertJsonPath('data', null);
        }
        $this->assertDatabaseCount('patient_biometric_observations', 2);
    }

    public function test_unsupported_versions_and_unreadable_key_do_not_fall_back_to_an_empty_profile(): void
    {
        $this->signIn();
        $this->save(['gender' => 'female']);
        $snapshot = PatientHealthSnapshot::firstOrFail();
        $cipher = $snapshot->getRawOriginal('payload');
        foreach ([['schema_version' => 2], ['catalog_version' => 'unaccepted-future-catalog']] as $invalid) {
            DB::table('patient_health_snapshots')->where('id', $snapshot->id)->update($invalid);
            $this->getJson('/api/my/health-profile')->assertStatus(503)->assertJsonPath('data', null);
            DB::table('patient_health_snapshots')->where('id', $snapshot->id)->update(['schema_version' => 1, 'catalog_version' => HealthCatalog::VERSION]);
        }
        // Only this isolated application/container key changes; project environment is never loaded.
        config(['app.key' => 'base64:'.base64_encode(str_repeat('j', 32))]);
        app()->forgetInstance('encrypter');
        \Illuminate\Support\Facades\Crypt::clearResolvedInstance('encrypter');
        $this->assertSame(str_repeat('j', 32), PatientHealthSnapshot::currentEncrypter()->getKey());
        $this->getJson('/api/my/health-profile')->assertStatus(503)->assertJsonPath('data', null);
        $this->assertSame($cipher, DB::table('patient_health_snapshots')->value('payload'));
    }

    public function test_dates_and_age_use_the_tehran_calendar_day_across_utc_midnight_boundary(): void
    {
        $this->travelTo(new \DateTimeImmutable('2026-10-22T20:29:00Z'));
        $this->signIn();
        $this->save(['birth_date' => '2000-10-23']);
        $this->getJson('/api/my/health-profile')->assertJsonPath('data.age', 25);
        $body = ['expected_revision' => $this->getJson('/api/my/health-profile')->json('data.revision'), 'catalog_version' => HealthCatalog::VERSION,
            'confirmed' => true, 'changes' => [], 'measurements' => ['weight' => ['value' => '63', 'measured_on' => '2026-10-23']]];
        $this->putJson('/api/my/health-profile', $body)->assertUnprocessable();
        $this->travelTo(new \DateTimeImmutable('2026-10-22T20:31:00Z'));
        $this->putJson('/api/my/health-profile', $body)->assertOk()->assertJsonPath('data.age', 26)
            ->assertJsonPath('data.measurements.weight.measured_on', '2026-10-23');
    }

    public function test_history_is_bounded_without_changing_the_selected_measurement_and_payloads_do_not_serialize(): void
    {
        $actor = $this->signIn();
        $this->save([], ['weight' => ['value' => '63', 'measured_on' => '2026-10-01']]);
        for ($index = 0; $index < 21; $index++) {
            $row = new PatientBiometricObservation(['patient_id' => $actor->id, 'actor_id' => $actor->id, 'metric' => 'weight', 'source' => 'self_report',
                'schema_version' => 1, 'recorded_at' => now()]);
            $row->public_id = strtolower((string) Str::ulid());
            $row->payload = ['owner_id' => $actor->public_id, 'public_id' => $row->public_id, 'metric' => 'weight', 'hundredths' => 6400, 'unit' => 'kg', 'measured_on' => '2026-10-02'];
            $row->save();
        }
        $response = $this->getJson('/api/my/health-profile')->assertOk()->assertJsonPath('data.history_truncated.weight', true)
            ->assertJsonPath('data.measurements.weight.value', '63.00');
        $this->assertCount(20, $response->json('data.history.weight'));
        $this->assertDatabaseCount('patient_biometric_observations', 22);
        $this->assertArrayNotHasKey('payload', PatientHealthSnapshot::firstOrFail()->toArray());
        $this->assertArrayNotHasKey('payload', PatientBiometricObservation::firstOrFail()->toArray());
        $this->expectException(\LogicException::class);
        PatientBiometricObservation::firstOrFail()->forceFill(['source' => 'forged'])->save();
    }

    public function test_encrypted_health_backup_restores_the_exact_history_with_the_retained_key(): void
    {
        $this->travelTo(new \DateTimeImmutable('2026-10-22T08:00:00Z'));
        $this->signIn();
        $this->save(['birth_date' => '2000-01-01', 'gender' => 'female'], ['weight' => ['value' => '63', 'measured_on' => '2026-10-01'],
            'height' => ['value' => '172', 'measured_on' => '2026-10-01']]);
        $first = PatientBiometricObservation::where('metric', 'weight')->firstOrFail();
        $this->save([], ['weight' => ['value' => '64', 'measured_on' => '2026-10-02', 'correction_of' => $first->public_id]]);
        $expected = $this->getJson('/api/my/health-profile')->assertOk()->json('data');
        $tables = ['patient_biometric_observations', 'patient_health_snapshots'];
        $rows = [];
        foreach ($tables as $table) {
            $rows[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        }
        $backup = json_encode($rows, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('2000-01-01', $backup);
        $this->assertStringNotContainsString('female', $backup);
        // Disaster-restore rehearsal in this guarded SQLite-memory fixture only.
        // Not an ordinary application update/delete path or a live reset command.
        DB::table('patient_health_snapshots')->delete();
        foreach (DB::table('patient_biometric_observations')->orderByDesc('id')->pluck('id') as $id) {
            DB::table('patient_biometric_observations')->where('id', $id)->delete();
        }
        $this->assertDatabaseCount('patient_health_snapshots', 0);
        $restored = json_decode($backup, true, flags: JSON_THROW_ON_ERROR);
        foreach ($tables as $table) {
            foreach ($restored[$table] as $row) {
                DB::table($table)->insert($row);
            }
            $this->assertSame($rows[$table], DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all());
        }
        $this->assertSame($expected, $this->getJson('/api/my/health-profile')->assertOk()->json('data'));
        $this->assertDatabaseCount('patient_biometric_observations', 3);
        $this->assertDatabaseCount('patient_health_snapshots', 2);
        $this->assertDatabaseCount('audit_events', 2);
    }
}
