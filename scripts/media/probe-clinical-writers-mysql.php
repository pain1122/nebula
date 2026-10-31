<?php

// Actual application saves in an empty, guarded disposable MySQL database only.
use App\Http\Controllers\Api\Admin\ClinicalAccountController;
use App\Models\AuditEvent;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Reservation;
use App\Models\User;
use App\Services\AdminIdentityService;
use App\Services\BookingService;
use App\Services\DoctorLocationService;
use App\Services\DoctorPracticeService;
use App\Services\HospitalAdministration;
use Carbon\Carbon;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\Process\Process;

class ClinicalWriterAssertion extends RuntimeException {}

function clinicalEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new ClinicalWriterAssertion($message);
    }
}

$stage = 'configuration';
$failureHandler = function (Throwable $error) use (&$stage): void {
    fwrite(STDERR, json_encode(['clinical_writer_failure' => true, 'stage' => $stage, 'class' => $error::class,
        'file' => str_replace('/var/www/', '', $error->getFile()),
        'mysql_code' => $error instanceof QueryException ? ($error->errorInfo[1] ?? null) : null,
        'line' => $error->getLine(), 'assertion' => $error instanceof ClinicalWriterAssertion ? $error->getMessage() : null], JSON_THROW_ON_ERROR)."\n");
    exit(1);
};
set_exception_handler($failureHandler);
$mode = $argv[1] ?? '';
$root = '/tmp/checkupino-clinical-writers';
clinicalEnsure(in_array($mode, ['parent', 'child', 'inspect'], true) && getenv('CHECKUPINO_CLINICAL_MYSQL_REHEARSAL') === 'true'
    && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'mysql'
    && getenv('DB_HOST') === 'mysql-acceptance' && getenv('DB_PORT') === '3306'
    && getenv('DB_DATABASE') === 'checkupino_schedule_acceptance' && getenv('DB_USERNAME') === 'schedule_acceptance'
    && preg_match('/^[a-f0-9]{32}$/D', (string) getenv('DB_PASSWORD'))
    && ! getenv('DB_URL') && ! getenv('DB_SOCKET') && posix_geteuid() === 33
    && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    && getenv('LARAVEL_STORAGE_PATH') === $root && getenv('APP_CONFIG_CACHE') === $root.'/config.php'
    && getenv('MEDICAL_SCAN_ENABLED') === 'false', 'Explicit isolated configuration required before boot.');
umask(0077);
if ($mode !== 'child') {
    clinicalEnsure(! file_exists($root), 'Fresh temporary storage required.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
}
$stat = lstat($root);
clinicalEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
    && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing') && ! file_exists($root.'/config.php'), 'Owned empty environment required.');
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root);
$stage = 'boot';
$app->make(Kernel::class)->bootstrap();
set_exception_handler($failureHandler);
clinicalEnsure(config('database.default') === 'mysql' && config('database.connections.mysql.host') === 'mysql-acceptance'
    && config('database.connections.mysql.database') === 'checkupino_schedule_acceptance'
    && ! config('database.connections.mysql.url') && config('queue.default') === 'database'
    && config('cache.default') === 'array' && ! config('medical.scanner.enabled')
    && DB::selectOne('SELECT DATABASE() AS name')->name === 'checkupino_schedule_acceptance', 'Effective isolated configuration required.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 8');
Carbon::setTestNow(Carbon::parse('2026-10-25 07:00:00', 'UTC')); // Isolated test clock, never a live clock.
config(['scheduling.materialization_days' => 7]);
$matrix = json_decode(file_get_contents('/var/www/scripts/media/clinical-writer-mysql-cases.json'), true, flags: JSON_THROW_ON_ERROR);
clinicalEnsure(count($matrix) === 19, 'Exact bounded case matrix required.');

function clinicalWait(string $path): void
{
    $deadline = microtime(true) + 8;
    do {
        clearstatcache(true, $path);
        if (is_file($path)) {
            return;
        }
        usleep(10000);
    } while (microtime(true) < $deadline);
    throw new ClinicalWriterAssertion('Transaction barrier timed out.');
}

function clinicalRequest(int $actor, array $body = []): Request
{
    // Authentication middleware resolves the user before application transactions.
    // Re-querying from the resolver would start an artificial repeatable-read
    // snapshot before the contender obtains its first production lock.
    $user = User::findOrFail($actor);
    $request = Request::create('/synthetic-clinical-writer', 'POST', $body);
    app()->instance('request', $request);
    // Laravel rebinds its auth resolver when the request instance changes.
    $request->setUserResolver(fn () => $user);

    return $request;
}

function clinicalRun(array $fixture, string $side): void
{
    $operation = $fixture[$side];
    $request = clinicalRequest($fixture[$side.'_actor'], $fixture[$side.'_body']);
    match ($operation) {
        'doctor_create', 'patient_create' => app(ClinicalAccountController::class)->store($request, app(HospitalAdministration::class), app(AdminIdentityService::class)),
        'hospital_create' => app(HospitalAdministration::class)->save($request, null),
        'hospital_deactivate' => app(HospitalAdministration::class)->save($request, MarketplaceHospital::findOrFail($fixture['attach_hospital'])),
        'attach' => app(DoctorLocationService::class)->attach($request),
        'prices' => app(DoctorLocationService::class)->prices($request, DoctorWorkplace::findOrFail($fixture['workplace'])),
        'weekly' => app(DoctorPracticeService::class)->save($request),
        'book' => app(BookingService::class)->createReservation(User::findOrFail($fixture['patient']), $fixture['slot_public_id']),
        default => throw new ClinicalWriterAssertion('Unknown bounded operation.'),
    };
}

if ($mode === 'child') {
    [$token, $side] = [$argv[2] ?? '', $argv[3] ?? ''];
    clinicalEnsure(preg_match('/^[a-f0-9]{16}$/D', $token) && in_array($side, ['leader', 'follower'], true), 'Invalid child arguments.');
    $fixture = json_decode(file_get_contents($root.'/'.$token.'.json'), true, flags: JSON_THROW_ON_ERROR);
    $stage = $fixture['name'].'-'.$side;
    $held = false;
    $attempted = false;
    $table = $fixture['barrier_table'];
    $needle = $fixture['barrier_insert'] ? 'insert into' : 'for update';
    if ($side === 'leader') {
        DB::listen(function ($query) use (&$held, $root, $token, $table, $needle): void {
            if (! $held && str_contains($query->sql, '`'.$table.'`') && str_contains(strtolower($query->sql), $needle)) {
                clinicalEnsure(DB::transactionLevel() > 0, 'Barrier requires a real transaction.');
                $held = true;
                file_put_contents($root.'/'.$token.'.locked', 'locked');
                clinicalWait($root.'/'.$token.'.attempted');
                usleep(350000);
            }
        });
    } else {
        clinicalWait($root.'/'.$token.'.locked');
        DB::connection()->beforeExecuting(function ($sql) use (&$attempted, $root, $token, $table, $needle): void {
            if (! $attempted && str_contains($sql, '`'.$table.'`') && str_contains(strtolower($sql), $needle)) {
                clinicalEnsure(DB::transactionLevel() > 0, 'Contender requires a real transaction.');
                $attempted = true;
                file_put_contents($root.'/'.$token.'.attempted', 'attempted');
            }
        });
    }
    if ($side === 'leader' && ($fixture['audit_failure'] ?? false)) {
        AuditEvent::creating(function (AuditEvent $event) use ($fixture): void {
            $action = match ($fixture['leader']) {
                'doctor_create' => 'admin.doctor.onboarded', 'hospital_create' => 'admin.hospital.created',
                'prices' => 'doctor.location.prices.updated', 'weekly' => 'doctor.practice.updated',
            };
            if ($event->action === $action) {
                throw new RuntimeException('Synthetic clinical audit refusal.');
            }
        });
    }
    $start = hrtime(true);
    try {
        clinicalRun($fixture, $side);
        $outcome = 'committed';
    } catch (ValidationException $error) {
        clinicalEnsure($fixture[$side] === 'book' && ($error->errors()['slot_id'][0] ?? null) === 'slot_not_available', 'Unexpected validation refusal.');
        $outcome = 'slot_unavailable';
    } catch (HttpExceptionInterface $error) {
        if ($error->getStatusCode() === 409) {
            $outcome = 'conflict';
        } else {
            clinicalEnsure($fixture['name'] === 'hospital_deactivation_before_attach' && $side === 'follower' && $error->getStatusCode() === 422, 'Unexpected HTTP refusal.');
            $outcome = 'hospital_unavailable';
        }
    } catch (QueryException $error) {
        if (! (($fixture['different_admin'] ?? false) && $side === 'follower' && (int) ($error->errorInfo[1] ?? 0) === 1062)) {
            throw $error; // Preserve only the structured error code/file, never SQL.
        }
        $outcome = 'duplicate_constraint_refused';
    } catch (ClinicalWriterAssertion $error) {
        throw $error;
    } catch (RuntimeException $error) {
        clinicalEnsure(($fixture['audit_failure'] ?? false) && $side === 'leader' && $error->getMessage() === 'Synthetic clinical audit refusal.', 'Unexpected runtime failure.');
        $outcome = 'audit_rolled_back';
    }
    clinicalEnsure(DB::transactionLevel() === 0, 'Child transaction leaked.');
    echo json_encode(['outcome' => $outcome, 'elapsed_ms' => (int) ((hrtime(true) - $start) / 1000000),
        'held' => $held, 'attempted' => $attempted], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

if ($mode === 'inspect') {
    $stage = 'read_only_context';
    DB::statement('SET TRANSACTION READ ONLY');
    DB::beginTransaction();
    $actor = User::role('admin')->orderBy('id')->firstOrFail();
    $request = clinicalRequest($actor->id);
    app(ClinicalAccountController::class)->context($request, app(HospitalAdministration::class));
    $hospital = MarketplaceHospital::orderByDesc('id')->firstOrFail();
    $attributes = $hospital->getAttributes();
    $factoryLike = (new MarketplaceHospital)->setRawAttributes(['timezone' => $attributes['timezone'], 'is_active' => $attributes['is_active']] + $attributes, true);
    $locations = app(DoctorLocationService::class);
    clinicalEnsure($locations->hospitalRevision($hospital) === $locations->hospitalRevision($hospital->fresh()), 'Persisted hospital revisions must be stable.');
    clinicalEnsure($locations->hospitalRevision($hospital) !== $locations->hospitalRevision($factoryLike), 'Fixture must use the persisted server representation, not factory attribute order.');
    $queries = 0;
    DB::listen(function () use (&$queries): void {
        $queries++;
    });
    clinicalEnsure($request->user() === $request->user() && $request->user()->id === $actor->id, 'Authenticated user must remain cached.');
    clinicalEnsure($queries === 0, 'User resolver must not create an in-transaction database snapshot.');
    DB::rollBack();
    echo json_encode(['acceptance' => 'read_only_inspection_passed', 'business_writes' => 0, 'cached_user_queries' => $queries,
        'persisted_hospital_revision_stable' => true, 'attribute_order_changes_revision' => true], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

$stage = 'empty_schema';
clinicalEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0, 'Refuse populated database; never reset or replay.');
$version = DB::selectOne('SELECT VERSION() AS version')->version;
$isolation = DB::selectOne('SELECT @@transaction_isolation AS isolation_level')->isolation_level;
clinicalEnsure(str_starts_with($version, '8.0.46') && $isolation === 'REPEATABLE-READ', 'Pinned MySQL and repeatable-read required.');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new ClinicalWriterAssertion('Parent deadline exceeded.'));
pcntl_alarm(240);
Artisan::call('migrate', ['--force' => true]); // Existing migrations in empty tmpfs DB only.
Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]);
DB::table('jobs')->insert(['queue' => 'default', 'payload' => 'synthetic-unconsumed-sentinel', 'attempts' => 0, 'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
$sentinel = (array) DB::table('jobs')->sole();

function clinicalFixture(array $case): array
{
    $rule = DoctorWorkingWindow::factory()->create(['weekday' => 1, 'starts_at' => '08:00:00', 'ends_at' => '09:00:00', 'visit_duration_minutes' => 30]);
    $place = $rule->workplace;
    $place->hospital->forceFill(['timezone' => 'Asia/Tehran', 'is_active' => true])->save();
    $place->doctorProfile->forceFill(['fee' => 350000, 'verified' => true])->save();
    $doctor = $place->doctorProfile->user;
    $doctor->syncRoles(['doctor']);
    $rule->checkup->forceFill(['currency' => 'IRR', 'is_active' => true])->save();
    $place->checkups()->updateExistingPivot($rule->checkup_id, ['price_override' => 450000, 'currency_override' => 'IRR', 'is_active' => true]);
    $other = DoctorWorkplace::factory()->create(['doctor_profile_id' => $place->doctor_profile_id]);
    $other->checkups()->attach($rule->checkup_id, ['price_override' => 450000, 'currency_override' => 'IRR', 'is_active' => true]);
    DoctorWorkingWindow::factory()->create(['doctor_workplace_id' => $other->id, 'checkup_id' => $rule->checkup_id,
        'weekday' => 2, 'starts_at' => '10:00:00', 'ends_at' => '12:00:00', 'visit_duration_minutes' => 30]);
    $start = Carbon::parse('2026-10-26 08:00:00', 'Asia/Tehran')->utc();
    $slot = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => $start, 'ends_at' => $start->copy()->addMinutes(30), 'price' => 450000, 'currency' => 'IRR']);
    $admin = User::factory()->admin()->create();
    $secondAdmin = User::factory()->admin()->create();
    $patient = User::factory()->patient()->create();
    // Revisions are issued from database reads in the real API. Factory-returned
    // attribute order/defaults are not the server's persisted representation.
    $hospital = MarketplaceHospital::factory()->create(['is_active' => true])->fresh();
    $fixture = $case + ['workplace' => $place->id, 'other_workplace' => $other->id, 'doctor' => $doctor->id, 'profile' => $place->doctor_profile_id,
        'patient' => $patient->id, 'slot' => $slot->id, 'slot_public_id' => $slot->public_id, 'rule' => $rule->id, 'attach_hospital' => $hospital->id];
    $suffix = bin2hex(random_bytes(6));
    $identity = ['first_name' => 'Synthetic', 'last_name' => 'Rehearsal', 'email' => $suffix.'@example.test',
        'phone' => '09'.random_int(100000000, 999999999), 'NID' => (string) random_int(1000000000, 1999999999), 'birth_date' => '1990-01-01',
        'password' => 'cedar lantern valley compass', 'password_confirmation' => 'cedar lantern valley compass'];
    $fixture['created_email'] = $identity['email'];
    $fixture['created_slug'] = 'synthetic-'.$suffix;
    foreach (['leader', 'follower'] as $side) {
        $op = $case[$side];
        $actor = in_array($op, ['doctor_create', 'patient_create', 'hospital_create', 'hospital_deactivate'], true)
            ? ($side === 'follower' && ($case['different_admin'] ?? false) ? $secondAdmin : $admin) : $doctor;
        $fixture[$side.'_actor'] = $actor->id;
        $base = ['reason' => 'Synthetic concurrent acceptance.', 'confirmed' => true];
        $practice = app(DoctorPracticeService::class)->capture($doctor);
        $base['expected_revision'] = $practice['revision'];
        if (in_array($op, ['doctor_create', 'patient_create'], true)) {
            $request = clinicalRequest($actor->id);
            $context = app(ClinicalAccountController::class)->context($request, app(HospitalAdministration::class))->getData(true)['data'];
            $body = $identity + ['role' => $op === 'doctor_create' ? 'doctor' : 'patient'];
            if ($op === 'doctor_create') {
                $body += ['specialty_id' => $place->doctorProfile->specialty_id, 'experience_years' => 8, 'fee' => 600000, 'verified' => false];
            }
            $body += [...$base, 'expected_revision' => $context['revision']];
        } elseif (in_array($op, ['hospital_create', 'hospital_deactivate'], true)) {
            $target = $op === 'hospital_deactivate' ? $hospital : null;
            $body = $target ? $target->only(HospitalAdministration::FIELDS) : ['name' => 'Synthetic clinic', 'slug' => $fixture['created_slug'], 'timezone' => 'Asia/Tehran', 'is_active' => true];
            $body = [...$body, ...$base, 'expected_revision' => app(HospitalAdministration::class)->revision($actor->load('roles'), $target)];
            if ($target) {
                $body['is_active'] = false;
            }
        } elseif ($op === 'attach') {
            $body = $base + ['hospital_public_id' => $hospital->public_id, 'hospital_revision' => app(DoctorLocationService::class)->hospitalRevision($hospital),
                'services' => [['id' => $rule->checkup_id, 'price' => 600000, 'currency' => 'IRR']]];
        } elseif ($op === 'prices') {
            $body = $base + ['services' => [['id' => $rule->checkup_id, 'price' => $side === 'leader' ? 600000 : 700000, 'currency' => 'IRR']]];
        } elseif ($op === 'weekly') {
            $body = $base + ['mode' => 'weekly', 'workplace_id' => $side === 'follower' && ($case['other_location'] ?? false) ? $other->id : $place->id,
                'availability' => [['day' => 'mon', 'windows' => [['checkup_id' => $rule->checkup_id, 'start' => '08:00', 'end' => '16:00',
                    'duration_minutes' => 30, 'breaks' => [['start' => '12:00', 'end' => '13:00']]]]]]];
        } else {
            $body = [];
        }
        $fixture[$side.'_body'] = $body;
    }
    $fixture['barrier_insert'] = (bool) ($case['different_admin'] ?? false);
    $fixture['barrier_table'] = $fixture['barrier_insert'] ? ($case['leader'] === 'hospital_create' ? 'marketplace_hospitals' : 'users')
        : (in_array('book', [$case['leader'], $case['follower']], true) ? 'doctor_profiles' : ($case['leader'] === 'hospital_deactivate' ? 'marketplace_hospitals' : 'users'));
    if (($case['different_admin'] ?? false) && $case['leader'] === 'doctor_create') {
        // Both creators lock the same specialty before inserting the identity.
        $fixture['barrier_table'] = 'specialties';
        $fixture['barrier_insert'] = false;
    }
    if ($case['follower'] === 'book') {
        // Stop after the writer owns the resource the booking will request next.
        // A profile-only barrier here would manufacture an earlier lock inversion
        // rather than establish the intended writer-before-booking commit order.
        $fixture['barrier_table'] = $case['leader'] === 'weekly' ? 'doctor_visit_slots' : 'doctor_workplaces';
    }

    return $fixture;
}

function clinicalHash(string $table): string
{
    $rows = DB::table($table)->get()->map(function ($row): array {
        $row = (array) $row;
        ksort($row);

        return $row;
    })->all();
    usort($rows, fn ($a, $b) => json_encode($a) <=> json_encode($b));

    return hash('sha256', json_encode($rows, JSON_THROW_ON_ERROR));
}

function clinicalPair(array $case): array
{
    global $root, $stage;
    $stage = $case['name'];
    $fixture = clinicalFixture($case);
    $beforeAudit = AuditEvent::max('id') ?? 0;
    $beforeReservations = Reservation::count();
    $beforePayments = DB::table('reservation_payment_summaries')->count();
    $beforeOutbox = DB::table('outbox_events')->count();
    $otherHours = DB::table('doctor_working_windows')->where('doctor_workplace_id', $fixture['other_workplace'])->orderBy('id')->get()->toJson();
    $before = [];
    foreach (['users', 'doctor_profiles', 'model_has_roles', 'doctor_specialty', 'marketplace_hospitals', 'doctor_workplaces', 'doctor_workplace_checkup', 'doctor_working_windows', 'doctor_working_window_breaks', 'doctor_visit_slots', 'reservations', 'reservation_payment_summaries', 'outbox_events'] as $table) {
        $before[$table] = clinicalHash($table);
    }
    $slot = DoctorVisitSlot::findOrFail($fixture['slot']);
    $immutable = array_intersect_key($slot->getAttributes(), array_flip(['id', 'public_id', 'doctor_working_window_id', 'doctor_workplace_id', 'checkup_id', 'starts_at', 'ends_at', 'price', 'currency']));
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode($fixture, JSON_THROW_ON_ERROR));
    $env = array_fill_keys(array_unique(array_merge(array_keys(getenv()), array_keys($_ENV))), false);
    foreach (['CHECKUPINO_CLINICAL_MYSQL_REHEARSAL', 'APP_ENV', 'APP_DEBUG', 'APP_KEY', 'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_URL', 'DB_SOCKET', 'CACHE_STORE', 'SESSION_DRIVER', 'MAIL_MAILER', 'LOG_CHANNEL', 'QUEUE_CONNECTION', 'MEDICAL_SCAN_ENABLED', 'MEDICAL_STORAGE_DRIVER', 'MEDICAL_LOCAL_STORAGE_ROOT', 'LARAVEL_STORAGE_PATH', 'APP_CONFIG_CACHE', 'VIEW_COMPILED_PATH', 'BCRYPT_ROUNDS'] as $key) {
        $env[$key] = getenv($key);
    }
    $env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
    $processes = [];
    try {
        foreach (['leader', 'follower'] as $side) {
            $process = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', $env, timeout: 22);
            $process->start();
            $processes[$side] = $process;
        }
        foreach ($processes as $side => $process) {
            $process->wait();
            if (! $process->isSuccessful()) {
                foreach (preg_split('/\R/', trim($process->getErrorOutput())) as $line) {
                    $diagnostic = json_decode($line, true);
                    if (($diagnostic['clinical_writer_failure'] ?? false) === true) {
                        fwrite(STDERR, json_encode($diagnostic, JSON_THROW_ON_ERROR)."\n");
                    }
                }
            }
            clinicalEnsure($process->isSuccessful(), 'Concurrent child failed: '.$case['name'].'/'.$side);
            $results[$side] = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }
    } finally {
        foreach ($processes as $process) {
            $process->stop(0);
        }
    }
    clinicalEnsure($results['leader']['held'] && $results['follower']['attempted'] && $results['follower']['elapsed_ms'] >= 250, 'Actual overlapping transaction barriers required.');
    fwrite(STDERR, json_encode(['clinical_writer_pair_observed' => ['name' => $case['name'], 'results' => $results]], JSON_THROW_ON_ERROR)."\n");
    clinicalEnsure([$results['leader']['outcome'], $results['follower']['outcome']] === $case['expected'], 'Exact expected outcomes required.');
    DB::purge();
    $audits = AuditEvent::where('id', '>', $beforeAudit)->orderBy('id')->get();
    $expectedAudits = [];
    $changed = [];
    foreach (['leader', 'follower'] as $side) {
        if ($results[$side]['outcome'] !== 'committed') {
            continue;
        }
        $op = $fixture[$side];
        $actions = match ($op) {
            'doctor_create' => ['admin.user.created', 'admin.doctor.onboarded'], 'patient_create' => ['admin.user.created'],
            'hospital_create' => ['admin.hospital.created'], 'hospital_deactivate' => ['admin.hospital.updated'],
            'attach' => ['doctor.location.added'], 'prices' => ['doctor.location.prices.updated'], 'weekly' => ['doctor.practice.updated'], 'book' => [],
        };
        foreach ($actions as $action) {
            $expectedAudits[] = [$action, $fixture[$side.'_actor']];
        }
        $tables = match ($op) {
            'doctor_create' => ['users', 'model_has_roles', 'doctor_profiles', 'doctor_specialty'], 'patient_create' => ['users', 'model_has_roles'],
            'hospital_create', 'hospital_deactivate' => ['marketplace_hospitals'], 'attach' => ['doctor_workplaces', 'doctor_workplace_checkup'],
            'prices' => ['doctor_workplace_checkup'], 'weekly' => ['doctor_working_windows', 'doctor_working_window_breaks', 'doctor_visit_slots'],
            'book' => ['reservations', 'reservation_payment_summaries', 'outbox_events'],
        };
        $changed = array_merge($changed, $tables);
    }
    clinicalEnsure($audits->map(fn ($a) => [$a->action, $a->actor_user_id])->all() === $expectedAudits, 'Exact atomic audit actions and actors required.');
    foreach ($before as $table => $hash) {
        if (! in_array($table, $changed, true)) {
            clinicalEnsure(clinicalHash($table) === $hash, 'Unrelated or rolled-back table changed: '.$table);
        }
    }
    $actual = array_intersect_key($slot->fresh()->getAttributes(), $immutable);
    ksort($actual);
    ksort($immutable);
    clinicalEnsure($actual === $immutable, 'Existing slot identity/time/price/currency must remain exact.');
    $created = User::where('email', $fixture['created_email'])->get();
    if (in_array('doctor_create', [$case['leader'], $case['follower']], true)) {
        clinicalEnsure($created->count() === 1 && $created[0]->hasExactRoles(['doctor']), 'Exactly one fixed-role doctor required.');
        $profile = $created[0]->doctorProfile;
        clinicalEnsure($profile && ! $profile->verified && $profile->verified_at === null && $profile->verified_by === null && (int) $profile->fee === 600000, 'Pending verification and owned fee required.');
        clinicalEnsure($profile->specialties()->count() === 1, 'Exactly one onboarding specialty required.');
    } elseif (in_array('patient_create', [$case['leader'], $case['follower']], true)) {
        clinicalEnsure($created->count() === 1 && $created[0]->hasExactRoles(['patient']) && $created[0]->doctorProfile === null, 'Exactly one patient without doctor profile required.');
    }
    if ($case['leader'] === 'hospital_create') {
        clinicalEnsure(MarketplaceHospital::where('slug', $fixture['created_slug'])->count() === 1, 'Exactly one hospital required.');
    }
    $committed = array_filter(['leader', 'follower'], fn ($side) => $results[$side]['outcome'] === 'committed');
    $booked = in_array('book', array_map(fn ($side) => $fixture[$side], $committed), true);
    $reservation = Reservation::where('doctor_visit_slot_id', $fixture['slot'])->first();
    clinicalEnsure((bool) $reservation === $booked, 'Exact booking result required.');
    clinicalEnsure(Reservation::count() === $beforeReservations + (int) $booked
        && DB::table('reservation_payment_summaries')->count() === $beforePayments + (int) $booked
        && DB::table('outbox_events')->count() === $beforeOutbox + (int) $booked, 'Exactly one reservation/payment/outbox per committed booking required.');
    clinicalEnsure(DB::table('doctor_working_windows')->where('doctor_workplace_id', $fixture['other_workplace'])->orderBy('id')->get()->toJson() === $otherHours,
        'The other hospital working hours must stay exact, including on a stale cross-location save.');
    if ($booked) {
        clinicalEnsure((int) $reservation->price_snapshot === 450000 && $reservation->currency_snapshot === 'IRR'
            && (int) $reservation->payment->amount === 450000 && $reservation->payment->currency === 'IRR', 'Booked money must preserve the original slot.');
    }
    $prices = array_values(array_filter($committed, fn ($side) => $fixture[$side] === 'prices'));
    if ($prices) {
        $priceSide = $prices[0];
        $expectedPrice = $fixture[$priceSide.'_body']['services'][0]['price'];
        $current = DoctorWorkplace::findOrFail($fixture['workplace'])->checkups()->firstOrFail();
        clinicalEnsure((int) $current->pivot->price_override === $expectedPrice && $current->pivot->currency_override === 'IRR', 'Exact committed service default required.');
        $audit = $audits->firstWhere('action', 'doctor.location.prices.updated');
        clinicalEnsure($audit->before['services'][0]['price'] === 450000 && $audit->after['services'][0]['price'] === $expectedPrice, 'Exact price before/after audit required.');
    }
    $weekly = array_values(array_filter($committed, fn ($side) => $fixture[$side] === 'weekly'));
    if ($weekly) {
        $target = DoctorWorkplace::findOrFail($fixture[$weekly[0].'_body']['workplace_id']);
        $newRule = $target->workingWindows()->where('is_active', true)->sole();
        clinicalEnsure(substr($newRule->starts_at, 0, 5) === '08:00' && substr($newRule->ends_at, 0, 5) === '16:00' && $newRule->visit_duration_minutes === 30, 'Full shift and duration required.');
        clinicalEnsure($newRule->breaks()->count() === 1 && $newRule->visitSlots()->count() === 14, 'Seven hours after lunch must materialize fourteen sessions.');
        clinicalEnsure($newRule->visitSlots()->where('price', '!=', 450000)->count() === 0, 'Rolled-back/uncommitted defaults must never materialize.');
        $starts = $newRule->visitSlots()->get()->map(fn ($s) => $s->starts_at->setTimezone('Asia/Tehran')->format('H:i'))->all();
        clinicalEnsure(! in_array('12:00', $starts, true) && ! in_array('12:30', $starts, true), 'Lunch must contain no generated appointments.');
    }
    if ($case['leader'] === 'attach') {
        clinicalEnsure(DoctorWorkplace::where('doctor_profile_id', $fixture['profile'])->where('marketplace_hospital_id', $fixture['attach_hospital'])->count() === 1, 'Exactly one hospital association required.');
    }
    $result = ['name' => $case['name'], 'results' => $results, 'atomic_state_audit_and_booked_money_verified' => true,
        'committed_audits' => count($expectedAudits), 'booking_created' => $booked];
    fwrite(STDERR, json_encode(['clinical_writer_case_result' => $result], JSON_THROW_ON_ERROR)."\n");

    return $result;
}

$cases = [];
foreach ($matrix as $case) {
    $cases[] = clinicalPair($case);
}
clinicalEnsure((array) DB::table('jobs')->sole() === $sentinel, 'Queue sentinel must remain untouched.');
foreach (['payment_attempts', 'payment_adjustments', 'reservation_schedule_changes', 'reservation_medical_requests', 'reservation_files', 'reservation_reports'] as $table) {
    clinicalEnsure(DB::table($table)->count() === 0, 'Unrelated lifecycle table must remain empty.');
}
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_schedule_acceptance', 'mysql' => $version, 'isolation' => $isolation,
    'cases' => $cases, 'default_queue_sentinel_unchanged' => true, 'medical_jobs' => 0,
    'limits' => ['Service/controller-level synthetic saves, no HTTP/CSRF/recent-password/browser or live acceptance.',
        'Cross-admin duplicate tests prove unique-constraint rollback; raw1062 is not accepted client-facing error handling.',
        'Not sustained load or forced deadlock/retry exhaustion coverage; any unexpected SQL deadlock/timeout fails.']], JSON_THROW_ON_ERROR)."\n";
