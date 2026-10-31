<?php

// Real health service saves; only the admitted empty disposable MySQL is allowed.
use App\Models\AuditEvent;
use App\Models\PatientBiometricObservation;
use App\Models\PatientHealthSnapshot;
use App\Models\User;
use App\Services\Health\HealthCatalog;
use App\Services\Health\PatientHealthService;
use Carbon\Carbon;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\Process\Process;

class HealthMysqlAssertion extends RuntimeException {}
class HealthAuditRefusal extends RuntimeException {}

function healthEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new HealthMysqlAssertion($message);
    }
}

$stage = 'configuration';
$failure = function (Throwable $error) use (&$stage): void {
    fwrite(STDERR, json_encode(['health_mysql_failure' => true, 'stage' => $stage, 'class' => $error::class,
        'line' => $error->getLine(), 'file' => str_replace('/var/www/', '', $error->getFile()),
        'mysql_code' => $error instanceof QueryException ? ($error->errorInfo[1] ?? null) : null,
        'assertion' => $error instanceof HealthMysqlAssertion ? $error->getMessage() : null], JSON_THROW_ON_ERROR)."\n");
    exit(1);
};
set_exception_handler($failure);
$mode = $argv[1] ?? '';
$root = '/tmp/checkupino-health-mysql';
healthEnsure(in_array($mode, ['parent', 'child', 'inspect-lock'], true) && getenv('CHECKUPINO_HEALTH_MYSQL') === 'true'
    && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'mysql' && posix_geteuid() === 33
    && getenv('DB_HOST') === 'mysql-acceptance' && getenv('DB_PORT') === '3306'
    && getenv('DB_DATABASE') === 'checkupino_schedule_acceptance' && getenv('DB_USERNAME') === 'schedule_acceptance'
    && preg_match('/^[a-f0-9]{32}$/D', (string) getenv('DB_PASSWORD')) && ! getenv('DB_URL') && ! getenv('DB_SOCKET')
    && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    && getenv('LARAVEL_STORAGE_PATH') === $root && getenv('APP_CONFIG_CACHE') === $root.'/config.php'
    && getenv('APP_ROUTES_CACHE') === $root.'/routes.php' && getenv('MEDICAL_SCAN_ENABLED') === 'false',
    'Explicit isolated configuration is required before boot.');
umask(0077);
if ($mode !== 'child') {
    healthEnsure(count($argv) === 2 && ! file_exists($root), 'A fresh process and temporary storage are required.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
    file_put_contents($root.'/empty.environment', '');
}
$stat = lstat($root);
healthEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
    && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing') && ! file_exists($root.'/config.php')
    && is_file($root.'/empty.environment') && filesize($root.'/empty.environment') === 0, 'Owned empty isolated environment is required.');
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root)->loadEnvironmentFrom('empty.environment');
$stage = 'boot';
$app->make(Kernel::class)->bootstrap();
set_exception_handler($failure);
healthEnsure(config('database.default') === 'mysql' && config('database.connections.mysql.host') === 'mysql-acceptance'
    && config('database.connections.mysql.database') === 'checkupino_schedule_acceptance' && ! config('database.connections.mysql.url')
    && config('queue.default') === 'database' && config('cache.default') === 'array' && ! config('medical.scanner.enabled')
    && DB::selectOne('SELECT DATABASE() AS name')->name === 'checkupino_schedule_acceptance', 'Effective isolated configuration is required.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 8');
Carbon::setTestNow(Carbon::parse('2026-10-22 08:00:00', 'UTC'));
$matrix = json_decode(file_get_contents('/var/www/scripts/health/mysql-cases.json'), true, flags: JSON_THROW_ON_ERROR);
healthEnsure(count($matrix) === 8, 'The exact eight-case matrix is required.');

function healthWait(string $path): void
{
    $until = microtime(true) + 8;
    do {
        clearstatcache(true, $path);
        if (is_file($path)) {
            return;
        }
        usleep(10000);
    } while (microtime(true) < $until);
    throw new HealthMysqlAssertion('The transaction barrier timed out.');
}

function healthRequest(User $actor, array $body): Request
{
    // Resolve once before the transaction, exactly as cached authentication does.
    $request = Request::create('/api/my/health-profile', 'PUT', $body);
    app()->instance('request', $request);
    $request->setUserResolver(fn () => $actor);

    return $request;
}

function healthOperation(string $operation, User $actor, array $body): void
{
    if ($operation === 'lock_probe') {
        DB::transaction(fn () => User::query()->lockForUpdate()->findOrFail($actor->id));

        return;
    }
    if (in_array($operation, ['deactivate', 'revoke_role'], true)) {
        DB::transaction(function () use ($actor, $operation): void {
            $locked = User::query()->lockForUpdate()->findOrFail($actor->id);
            if ($operation === 'deactivate') {
                $locked->forceFill(['account_state' => 'suspended'])->save();
            } else {
                $locked->removeRole('patient');
            }
        });

        return;
    }
    app(PatientHealthService::class)->save(healthRequest($actor, $body), $actor, $body);
}

if ($mode === 'child') {
    [$token, $side] = [$argv[2] ?? '', $argv[3] ?? ''];
    healthEnsure(count($argv) === 4 && preg_match('/^[a-f0-9]{16}$/D', $token) && in_array($side, ['leader', 'follower'], true), 'Invalid child arguments.');
    $fixture = json_decode(file_get_contents($root.'/'.$token.'.json'), true, flags: JSON_THROW_ON_ERROR);
    $stage = $fixture['name'].'-'.$side;
    $actor = User::findOrFail($fixture['actor']);
    $connectionId = (int) DB::connection()->getPdo()->query('SELECT CONNECTION_ID()')->fetchColumn();
    file_put_contents($root.'/'.$token.'.'.$side.'.prepared', (string) $connectionId);
    healthWait($root.'/'.$token.'.go');
    $observed = false;
    $lockingUser = fn (string $sql) => str_contains(strtolower($sql), 'for update') && str_contains($sql, '`users`');
    if ($side === 'leader') {
        DB::listen(function ($query) use (&$observed, $lockingUser, $root, $token): void {
            if (! $observed && $lockingUser($query->sql)) {
                healthEnsure(DB::transactionLevel() === 1, 'The leader must own a real transaction lock.');
                $observed = true;
                file_put_contents($root.'/'.$token.'.locked', '1');
                healthWait($root.'/'.$token.'.release');
            }
        });
    } else {
        healthWait($root.'/'.$token.'.locked');
        DB::connection()->beforeExecuting(function ($sql) use (&$observed, $lockingUser, $root, $token): void {
            if (! $observed && $lockingUser($sql)) {
                healthEnsure(DB::transactionLevel() === 1, 'The contender must attempt the production user lock.');
                $observed = true;
                file_put_contents($root.'/'.$token.'.attempted', '1');
            }
        });
    }
    if ($side === 'leader' && ($fixture['audit_failure'] ?? false)) {
        AuditEvent::creating(function (AuditEvent $event): void {
            if ($event->action === 'patient.health.updated') {
                throw new HealthAuditRefusal('Synthetic late audit refusal.');
            }
        });
    }
    $started = hrtime(true);
    try {
        healthOperation($fixture[$side], $actor, $fixture[$side.'_body']);
        $outcome = in_array($fixture[$side], ['deactivate', 'revoke_role'], true) ? 'authority_changed' : 'committed';
    } catch (HealthAuditRefusal) {
        healthEnsure($side === 'leader' && ($fixture['audit_failure'] ?? false), 'Unexpected audit refusal.');
        $outcome = 'audit_rolled_back';
    } catch (HttpExceptionInterface $error) {
        healthEnsure(in_array($error->getStatusCode(), [403, 409], true), 'Unexpected HTTP refusal.');
        $outcome = $error->getStatusCode() === 403 ? 'forbidden' : 'conflict';
    }
    healthEnsure($observed && DB::transactionLevel() === 0, 'Every child must cross its barrier and close its transaction.');
    $result = ['outcome' => $outcome, 'barrier' => true, 'duration_ms' => round((hrtime(true) - $started) / 1000000, 1)];
    file_put_contents($root.'/'.$token.'.'.$side.'.done', '1');
    echo json_encode($result, JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

if ($mode === 'inspect-lock') {
    $stage = 'read_only_lock_diagnostic';
    $actor = User::orderBy('id')->firstOrFail();
    $tables = ['users', 'patient_health_snapshots', 'patient_biometric_observations', 'audit_events', 'jobs'];
    $beforeHashes = array_map(fn ($table) => healthHash($table), $tables);
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode(['name' => 'lock_probe', 'actor' => $actor->id, 'leader' => 'lock_probe', 'follower' => 'lock_probe',
        'leader_body' => [], 'follower_body' => []], JSON_THROW_ON_ERROR));
    $processes = [];
    try {
        foreach (['leader', 'follower'] as $side) {
            $processes[$side] = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', timeout: 20);
            $processes[$side]->start();
        }
        healthWait($root.'/'.$token.'.leader.prepared');
        healthWait($root.'/'.$token.'.follower.prepared');
        $id = (int) file_get_contents($root.'/'.$token.'.follower.prepared');
        file_put_contents($root.'/'.$token.'.go', '1');
        healthWait($root.'/'.$token.'.locked');
        healthWait($root.'/'.$token.'.attempted');
        $until = microtime(true) + 4;
        $observation = null;
        do {
            foreach (DB::select('SHOW FULL PROCESSLIST') as $thread) {
                $sql = strtolower((string) $thread->Info);
                if ((int) $thread->Id === $id && str_contains($sql, '`users`') && str_contains($sql, 'for update')) {
                    $observation = ['command' => in_array($thread->Command, ['Query', 'Execute'], true) ? $thread->Command : 'other',
                        'locking_user_query_observed' => true, 'original_query_only_predicate' => $thread->Command === 'Query'];
                    break;
                }
            }
            if (! $observation) {
                usleep(10000);
            }
        } while (! $observation && microtime(true) < $until);
        file_put_contents($root.'/'.$token.'.release', '1');
        foreach ($processes as $process) {
            $process->wait();
            healthEnsure($process->isSuccessful(), 'Read-only diagnostic child failed.');
        }
        healthEnsure($observation !== null, 'No locking thread observed by the diagnostic.');
        healthEnsure(array_map(fn ($table) => healthHash($table), $tables) === $beforeHashes, 'Diagnostic must preserve data.');
        $audit = AuditEvent::where('action', 'patient.health.updated')->orderBy('id')->first();
        $auditShape = null;
        if ($audit) {
            $keys = array_keys($audit->after);
            $expectedKeys = ['snapshot_id', 'version', 'schema_version', 'changed_count', 'observation_count'];
            $sameOrder = $keys === $expectedKeys;
            sort($keys);
            sort($expectedKeys);
            $snapshot = PatientHealthSnapshot::where('patient_id', $actor->id)->orderBy('version')->firstOrFail();
            $typedExpected = ['snapshot_id' => $snapshot->public_id, 'version' => $snapshot->version, 'schema_version' => 1,
                'changed_count' => count($snapshot->payload['facts']) + count($snapshot->payload['observations']),
                'observation_count' => count($snapshot->payload['observations'])];
            $typedActual = $audit->after;
            ksort($typedExpected);
            ksort($typedActual);
            $auditShape = ['safe_key_set_matches' => $keys === $expectedKeys, 'original_key_order_matches' => $sameOrder,
                'actor_matches' => $audit->actor_user_id === $actor->id, 'reason_is_null' => $audit->reason === null,
                'typed_metadata_matches' => $typedActual === $typedExpected];
        }
        echo json_encode(['acceptance' => 'read_only_lock_diagnostic_passed', 'business_writes' => 0, 'rows_unchanged' => true,
            'observation' => $observation, 'audit_shape' => $auditShape], JSON_THROW_ON_ERROR)."\n";
    } finally {
        foreach ($processes as $process) {
            if ($process->isRunning()) {
                $process->stop(1);
            }
        }
    }
    exit(0);
}

$stage = 'empty_schema';
healthEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0,
    'Refuse populated schema; no reset or replay is allowed.');
$version = DB::selectOne('SELECT VERSION() AS version')->version;
$isolation = DB::selectOne('SELECT @@transaction_isolation AS isolation_level')->isolation_level;
healthEnsure(str_starts_with($version, '8.0.46') && $isolation === 'REPEATABLE-READ', 'Pinned MySQL and repeatable-read are required.');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new HealthMysqlAssertion('The parent deadline expired.'));
pcntl_alarm(180);
healthEnsure(Artisan::call('migrate', ['--force' => true]) === 0, 'Disposable migration failed.');
healthEnsure(Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]) === 0, 'Disposable role fixture failed.');
DB::table('jobs')->insert(['queue' => 'default', 'payload' => 'synthetic-health-unconsumed-sentinel', 'attempts' => 0, 'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
$sentinel = (array) DB::table('jobs')->sole();

function healthHash(string $table, ?int $owner = null, bool $exclude = false): string
{
    $query = DB::table($table);
    if ($owner !== null) {
        $query->where('patient_id', $exclude ? '!=' : '=', $owner);
    }
    $rows = $query->orderBy('id')->get()->map(function ($row): array {
        $value = (array) $row;
        ksort($value);

        return $value;
    })->all();

    return hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
}

function healthBody(User $actor, string $operation, string $revision): array
{
    $changes = match ($operation) {
        'first' => ['conditions' => ['status' => 'yes', 'codes' => ['condition.diabetes']]],
        'fact' => ['stress' => 'yes'],
        'other_fact' => ['gender' => 'female'],
        default => [],
    };
    $measurements = match ($operation) {
        'first', 'measurement' => ['weight' => ['value' => '64', 'measured_on' => '2026-10-02']],
        'fact' => ['weight' => ['value' => '63.00', 'measured_on' => '2026-10-01']],
        default => [],
    };

    return ['changes' => $changes, 'measurements' => $measurements, 'expected_revision' => $revision, 'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true];
}

function healthPair(array $case): array
{
    global $root, $stage;
    $stage = $case['name'];
    $actor = User::factory()->patient()->create()->fresh();
    $service = app(PatientHealthService::class);
    if ($case['initialized']) {
        Carbon::setTestNow(Carbon::parse('2026-10-21 08:00:00', 'UTC'));
        $base = ['expected_revision' => $service->read($actor)['revision'], 'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true,
            'changes' => ['smoking' => 'unknown'], 'measurements' => ['weight' => ['value' => '63', 'measured_on' => '2026-10-01']]];
        $service->save(healthRequest($actor, $base), $actor, $base);
        Carbon::setTestNow(Carbon::parse('2026-10-22 08:00:00', 'UTC'));
    }
    $revision = $service->read($actor)['revision'];
    $fixture = [...$case, 'actor' => $actor->id, 'leader_body' => healthBody($actor, $case['leader'], $revision), 'follower_body' => healthBody($actor, $case['follower'], $revision)];
    $before = PatientHealthSnapshot::where('patient_id', $actor->id)->orderByDesc('version')->first();
    $observation = PatientBiometricObservation::where('patient_id', $actor->id)->first();
    $oldSnapshotHash = $before ? hash('sha256', $before->getRawOriginal('payload')) : null;
    $oldObservationHash = $observation ? hash('sha256', $observation->getRawOriginal('payload')) : null;
    $healthTables = ['patient_health_snapshots', 'patient_biometric_observations'];
    $otherPatients = array_map(fn ($table) => healthHash($table, $actor->id, true), $healthTables);
    $oldUser = $actor->getRawOriginal();
    $beforeAudit = AuditEvent::max('id') ?? 0;
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode($fixture, JSON_THROW_ON_ERROR));
    $env = array_fill_keys(array_unique(array_merge(array_keys(getenv()), array_keys($_ENV))), false);
    foreach (['CHECKUPINO_HEALTH_MYSQL', 'APP_ENV', 'APP_DEBUG', 'APP_KEY', 'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_URL', 'DB_SOCKET',
        'CACHE_STORE', 'SESSION_DRIVER', 'MAIL_MAILER', 'LOG_CHANNEL', 'QUEUE_CONNECTION', 'MEDICAL_SCAN_ENABLED', 'MEDICAL_STORAGE_DRIVER', 'MEDICAL_LOCAL_STORAGE_ROOT',
        'LARAVEL_STORAGE_PATH', 'APP_CONFIG_CACHE', 'APP_ROUTES_CACHE', 'VIEW_COMPILED_PATH', 'BCRYPT_ROUNDS'] as $key) {
        $env[$key] = getenv($key);
    }
    $env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
    $processes = [];
    try {
        foreach (['leader', 'follower'] as $side) {
            $processes[$side] = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', $env, timeout: 25);
            $processes[$side]->start();
        }
        healthWait($root.'/'.$token.'.leader.prepared');
        healthWait($root.'/'.$token.'.follower.prepared');
        $followerConnection = (int) file_get_contents($root.'/'.$token.'.follower.prepared');
        file_put_contents($root.'/'.$token.'.go', '1');
        healthWait($root.'/'.$token.'.locked');
        healthWait($root.'/'.$token.'.attempted');
        // Observe the contender's live locking statement while the leader still owns the row.
        // SHOW FULL PROCESSLIST only needs visibility of this test user's own connections.
        $until = microtime(true) + 4;
        $seen = false;
        do {
            foreach (DB::select('SHOW FULL PROCESSLIST') as $thread) {
                $sql = strtolower((string) $thread->Info);
                if ((int) $thread->Id === $followerConnection && in_array($thread->Command, ['Query', 'Execute'], true)
                    && str_contains($sql, '`users`') && str_contains($sql, 'for update')) {
                    $seen = true;
                    break;
                }
            }
            if (! $seen) {
                usleep(10000);
            }
        } while (! $seen && microtime(true) < $until);
        healthEnsure($seen && ! is_file($root.'/'.$token.'.follower.done'), 'The contender must be observed waiting on the held production row.');
        file_put_contents($root.'/'.$token.'.release', '1');
        $results = [];
        foreach ($processes as $side => $process) {
            $process->wait();
            if (! $process->isSuccessful()) {
                // Child output is already allowlisted JSON; parent runner filters it again.
                fwrite(STDERR, $process->getErrorOutput());
                throw new HealthMysqlAssertion('A child failed; no automatic retry.');
            }
            $results[$side] = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }
    } finally {
        foreach ($processes as $process) {
            if ($process->isRunning()) {
                $process->stop(1);
            }
        }
    }
    healthEnsure([$results['leader']['outcome'], $results['follower']['outcome']] === $case['expected'], 'Exact pair outcomes differ.');
    fwrite(STDERR, json_encode(['health_mysql_pair_observed' => ['name' => $case['name'], 'results' => $results, 'contender_lock_observed' => true]], JSON_THROW_ON_ERROR)."\n");
    $winner = $results['leader']['outcome'] === 'committed' ? 'leader' : ($results['follower']['outcome'] === 'committed' ? 'follower' : null);
    $added = (int) ($winner !== null);
    $addedObservation = $winner !== null && in_array($case[$winner], ['first', 'measurement'], true) ? 1 : 0;
    healthEnsure(PatientHealthSnapshot::where('patient_id', $actor->id)->count() === (int) $case['initialized'] + $added, 'Exact snapshot count is required.');
    healthEnsure(PatientBiometricObservation::where('patient_id', $actor->id)->count() === (int) $case['initialized'] + $addedObservation, 'Exact observation count is required.');
    $audits = AuditEvent::where('id', '>', $beforeAudit)->get();
    healthEnsure($audits->count() === $added, 'Exactly one atomic health audit per committed save is required.');
    if ($added) {
        $latest = PatientHealthSnapshot::where('patient_id', $actor->id)->orderByDesc('version')->firstOrFail();
        healthEnsure($latest->version === (int) $case['initialized'] + 1, 'Health versions must remain consecutive.');
        $expected = $before?->payload['facts'] ?? [];
        foreach ($fixture[$winner.'_body']['changes'] as $code => $value) {
            $expected[$code] = ['value' => $value, 'source' => 'self_report', 'asserted_at' => now()->toIso8601String()];
        }
        healthEnsure($latest->payload['facts'] === $expected, 'Exact fact values and unchanged assertion times are required.');
        $read = $service->read($actor);
        healthEnsure($read['measurements']->weight['value'] === ($addedObservation ? '64.00' : '63.00')
            && $read['measurements']->weight['measured_on'] === ($addedObservation ? '2026-10-02' : '2026-10-01'), 'Exact committed measurement and date are required.');
        $expectedAudit = ['snapshot_id' => $latest->public_id, 'version' => $latest->version, 'schema_version' => 1,
            'changed_count' => count($fixture[$winner.'_body']['changes']) + $addedObservation, 'observation_count' => $addedObservation];
        $actualAudit = $audits[0]->after;
        ksort($expectedAudit);
        ksort($actualAudit);
        healthEnsure($audits[0]->action === 'patient.health.updated' && $audits[0]->actor_user_id === $actor->id && $audits[0]->reason === null
            && $actualAudit === $expectedAudit, 'Health audit must contain exact typed safe metadata.');
    }
    if ($before) {
        healthEnsure(hash('sha256', $before->fresh()->getRawOriginal('payload')) === $oldSnapshotHash, 'Prior encrypted snapshot must remain exact.');
        healthEnsure(hash('sha256', $observation->fresh()->getRawOriginal('payload')) === $oldObservationHash, 'Prior encrypted measurement must remain exact.');
    }
    healthEnsure(array_map(fn ($table) => healthHash($table, $actor->id, true), $healthTables) === $otherPatients, 'Other patients health history must remain exact.');
    $freshActor = $actor->fresh();
    if ($case['leader'] === 'deactivate') {
        healthEnsure($freshActor->account_state->value === 'suspended', 'Synthetic deactivation must commit before refusal.');
    } elseif ($case['leader'] === 'revoke_role') {
        healthEnsure($freshActor->roles()->count() === 0, 'Synthetic role removal must commit before refusal.');
    } else {
        healthEnsure($freshActor->getRawOriginal() === $oldUser, 'A health save must not modify account fields.');
    }
    $result = ['name' => $case['name'], 'results' => $results, 'contender_lock_observed' => true, 'exact_atomic_history_audit_verified' => true];
    fwrite(STDERR, json_encode(['health_mysql_case' => $result], JSON_THROW_ON_ERROR)."\n");

    return $result;
}

$unrelated = ['jobs', 'reservations', 'reservation_payment_summaries', 'payment_attempts', 'payment_adjustments', 'outbox_events', 'reservation_medical_requests', 'reservation_files', 'reservation_reports'];
$hashes = array_combine($unrelated, array_map(fn ($table) => healthHash($table), $unrelated));
$cases = [];
foreach ($matrix as $case) {
    $cases[] = healthPair($case);
}
foreach ($hashes as $table => $hash) {
    healthEnsure(healthHash($table) === $hash, 'Unrelated lifecycle table or queue changed.');
}
healthEnsure((array) DB::table('jobs')->sole() === $sentinel, 'The default queue sentinel must remain untouched.');
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_schedule_acceptance', 'mysql' => $version, 'isolation' => $isolation,
    'cases' => $cases, 'snapshots' => PatientHealthSnapshot::count(), 'observations' => PatientBiometricObservation::count(), 'audits' => AuditEvent::count(),
    'default_queue_sentinel_unchanged' => true, 'unrelated_lifecycle_tables_unchanged' => true, 'medical_jobs' => 0,
    'limits' => ['Service-level forced interleavings; HTTP/session/recent-password/browser and live acceptance remain separate.',
        'Revocation is a synthetic fixture transaction under the real user lock, not acceptance of a new administration endpoint.',
        'No sustained load or forced deadlock recovery claim; unexpected SQL deadlocks/timeouts fail.']], JSON_THROW_ON_ERROR)."\n";
