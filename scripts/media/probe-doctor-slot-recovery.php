<?php

// Service-level contention in a new, empty disposable database; never an HTTP writer.
use App\Models\AuditEvent;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\Reservation;
use App\Models\User;
use App\Services\AdminVisitSlotControl;
use App\Services\BookingService;
use App\Services\DoctorVisitSlotControlService;
use Carbon\Carbon;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\Process\Process;

class ScheduleProbeAssertion extends RuntimeException {}

function scheduleEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new ScheduleProbeAssertion($message);
    }
}

$probeStage = 'configuration';
$redactedFailure = function (Throwable $error) use (&$probeStage): void {
    // No connection strings, SQL, credentials or source environment in output.
    fwrite(STDERR, json_encode(['schedule_probe_failure' => true, 'class' => $error::class, 'stage' => $probeStage,
        'line' => $error->getLine(), 'assertion' => $error instanceof ScheduleProbeAssertion ? $error->getMessage() : null], JSON_THROW_ON_ERROR)."\n");
    exit(1);
};
set_exception_handler($redactedFailure);
$mode = $argv[1] ?? '';
$root = '/tmp/checkupino-schedule-contention';
scheduleEnsure(in_array($mode, ['parent', 'child'], true)
    && getenv('CHECKUPINO_SCHEDULE_MYSQL_REHEARSAL') === 'true'
    && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'mysql'
    && getenv('DB_HOST') === 'mysql-acceptance' && getenv('DB_PORT') === '3306'
    && getenv('DB_DATABASE') === 'checkupino_schedule_acceptance'
    && getenv('DB_USERNAME') === 'schedule_acceptance'
    && preg_match('/^[a-f0-9]{32}$/D', (string) getenv('DB_PASSWORD'))
    && ! getenv('DB_URL') && ! getenv('DB_SOCKET')
    && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    && getenv('LARAVEL_STORAGE_PATH') === $root && getenv('APP_CONFIG_CACHE') === $root.'/config.php'
    && getenv('MEDICAL_SCAN_ENABLED') === 'false' && posix_geteuid() === 33,
    'Isolated testing configuration required before boot.');
umask(0077);
if ($mode === 'parent') {
    scheduleEnsure(! file_exists($root), 'A fresh tmpfs directory is required.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
}
$stat = lstat($root);
scheduleEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
    && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing') && ! file_exists($root.'/config.php'), 'Owned isolated environment required.');
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root);
$probeStage = 'framework_boot';
$app->make(Kernel::class)->bootstrap();
set_exception_handler($redactedFailure);
$probeStage = 'effective_configuration';
scheduleEnsure(config('database.default') === 'mysql'
    && config('database.connections.mysql.host') === 'mysql-acceptance'
    && config('database.connections.mysql.database') === 'checkupino_schedule_acceptance'
    && config('database.connections.mysql.username') === 'schedule_acceptance'
    && ! config('database.connections.mysql.url') && ! config('medical.scanner.enabled')
    && config('queue.default') === 'database' && config('cache.default') === 'array', 'Effective isolated configuration required.');
scheduleEnsure(DB::selectOne('SELECT DATABASE() AS name')->name === 'checkupino_schedule_acceptance', 'Wrong database refused.');
DB::statement('SET SESSION innodb_lock_wait_timeout = 8');

function scheduleWait(string $path): void
{
    $deadline = microtime(true) + 8;
    do {
        clearstatcache(true, $path);
        if (is_file($path)) {
            return;
        }
        usleep(10000);
    } while (microtime(true) < $deadline);
    throw new ScheduleProbeAssertion('Bounded writer barrier timed out.');
}

function scheduleRequest(array $fixture, array $input, string $method = 'GET'): Request
{
    $request = Request::create('/synthetic-schedule-contention', $method, $input);
    app()->instance('request', $request);
    $request->setUserResolver(fn () => User::findOrFail($fixture['admin']));

    return $request;
}

if ($mode === 'child') {
    $token = $argv[2] ?? '';
    $side = $argv[3] ?? '';
    scheduleEnsure(preg_match('/^[a-f0-9]{16}$/D', $token) && in_array($side, ['leader', 'follower'], true), 'Invalid child arguments.');
    $fixture = json_decode(file_get_contents($root.'/'.$token.'.json'), true, flags: JSON_THROW_ON_ERROR);
    $operation = $fixture[$side];
    scheduleEnsure(in_array($operation, ['book', 'admin', 'doctor', 'audit_failure'], true), 'Unknown bounded operation.');
    $probeStage = $side.'-'.$operation;
    $leaderTable = 'doctor_visit_slots';
    // Two admins share the locked authority-role row, so the contender waits
    // there before reaching the target slot. Observe that first real blocker.
    $blockedTable = $fixture['leader'] === 'admin' && $fixture['follower'] === 'admin' ? 'roles' : $leaderTable;
    $held = false;
    $attempted = false;
    $doctorAttempts = 0;
    if ($operation === 'doctor') {
        DB::connection()->beforeExecuting(function ($sql) use (&$doctorAttempts): void {
            if (str_contains($sql, '`doctor_visit_slots`') && str_contains(strtolower($sql), 'for update')) {
                $doctorAttempts++;
            }
        });
    }
    if ($side === 'leader') {
        // Pause only after the actual production transaction has acquired its lock.
        DB::listen(function ($query) use (&$held, $leaderTable, $root, $token): void {
            if (! $held && str_contains($query->sql, '`'.$leaderTable.'`') && str_contains(strtolower($query->sql), 'for update')) {
                $held = true;
                file_put_contents($root.'/'.$token.'.locked', 'locked');
                scheduleWait($root.'/'.$token.'.attempted');
                usleep(350000);
            }
        });
    } else {
        scheduleWait($root.'/'.$token.'.locked');
        DB::connection()->beforeExecuting(function ($sql) use (&$attempted, $blockedTable, $root, $token): void {
            if (! $attempted && str_contains($sql, '`'.$blockedTable.'`') && str_contains(strtolower($sql), 'for update')) {
                $attempted = true;
                file_put_contents($root.'/'.$token.'.attempted', 'attempted');
            }
        });
    }
    if ($operation === 'audit_failure') {
        AuditEvent::creating(function (AuditEvent $event): void {
            if ($event->action === 'admin.visit_slots.controlled') {
                throw new RuntimeException('Synthetic audit refusal.');
            }
        });
    }
    $started = hrtime(true);
    try {
        if ($operation === 'book') {
            app(BookingService::class)->createReservation(User::findOrFail($fixture['patient']), $fixture['slot']);
        } elseif ($operation === 'doctor') {
            $slot = DoctorVisitSlot::where('public_id', $fixture['slot'])->firstOrFail();
            app(DoctorVisitSlotControlService::class)->change(
                Request::create('/synthetic-schedule-contention', 'PUT'), User::findOrFail($fixture['doctor']),
                $slot->workplace, $slot->checkup, 'slot', Carbon::parse($fixture['date'], 'Asia/Tehran'),
                $slot, null, 3000, 'Synthetic concurrent doctor control.',
            );
        } else {
            $input = $fixture[$side.'_input'];
            $actorFixture = $fixture;
            $actorFixture['admin'] = $fixture[$side.'_admin'];
            app(AdminVisitSlotControl::class)->change(scheduleRequest($actorFixture, $input, 'PUT'), $fixture['workplace']);
        }
        $outcome = 'committed';
    } catch (HttpExceptionInterface $error) {
        scheduleEnsure($error->getStatusCode() === 409 && $operation === 'admin', 'Only expected stale revision refusal is admitted.');
        $outcome = 'stale_revision';
    } catch (ValidationException $error) {
        scheduleEnsure($operation === 'book' && ($error->errors()['slot_id'][0] ?? null) === 'slot_not_available', 'Only expected disabled-slot refusal is admitted.');
        $outcome = 'slot_unavailable';
    } catch (DomainException $error) {
        scheduleEnsure($operation === 'doctor' && $error->getMessage() === 'No future unreserved visit slots matched this control.', 'Only booked-slot refusal is admitted.');
        $outcome = 'slot_reserved';
    } catch (ScheduleProbeAssertion $error) {
        throw $error;
    } catch (RuntimeException $error) {
        scheduleEnsure($operation === 'audit_failure' && $error->getMessage() === 'Synthetic audit refusal.', 'Unexpected runtime failure.');
        $outcome = 'audit_rolled_back';
    }
    scheduleEnsure(DB::transactionLevel() === 0, 'No child transaction may remain open.');
    echo json_encode(['outcome' => $outcome, 'elapsed_ms' => (int) ((hrtime(true) - $started) / 1000000),
        'leader_lock_observed' => $held, 'follower_lock_attempt_observed' => $attempted,
        'follower_blocking_table' => $side === 'follower' ? $blockedTable : null,
        'doctor_transaction_attempts' => $operation === 'doctor' ? $doctorAttempts : null], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

$probeStage = 'empty_schema';
scheduleEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0,
    'Database must be empty; never reset or reseed existing data.');
$version = DB::selectOne('SELECT VERSION() AS version')->version;
scheduleEnsure(str_starts_with($version, '8.0.46'), 'Pinned MySQL version required.');
$isolation = DB::selectOne('SELECT @@transaction_isolation AS isolation_level')->isolation_level;
scheduleEnsure($isolation === 'REPEATABLE-READ', 'Production-style MySQL repeatable-read required.');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new RuntimeException('Bounded parent deadline exceeded.'));
pcntl_alarm(180);
$probeStage = 'disposable_schema_setup';
Artisan::call('migrate', ['--force' => true]); // Existing migrations, verified empty tmpfs DB only.
Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]);
DB::table('jobs')->insert(['queue' => 'default', 'payload' => 'synthetic-unconsumed-sentinel', 'attempts' => 0,
    'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
$sentinel = (array) DB::table('jobs')->sole();

function scheduleFixture(string $leader, string $follower, string $scope): array
{
    $patient = User::factory()->patient()->create();
    $admin = User::factory()->admin()->create();
    $otherAdmin = User::factory()->admin()->create();
    $rule = DoctorWorkingWindow::factory()->create(['weekday' => Carbon::MONDAY,
        'starts_at' => '13:30:00', 'ends_at' => '15:00:00', 'visit_duration_minutes' => 30]);
    $workplace = $rule->workplace;
    $workplace->hospital->forceFill(['timezone' => 'Asia/Tehran'])->save();
    $workplace->doctorProfile->forceFill(['verified' => true])->save();
    $doctor = $workplace->doctorProfile->user;
    $doctor->syncRoles(['doctor']);
    $rule->checkup->forceFill(['is_active' => true, 'price' => 1000, 'currency' => 'IRR'])->save();
    $start = Carbon::now('UTC')->addWeeks(2)->startOfWeek(Carbon::MONDAY)->setTime(10, 0);
    $slot = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id,
        'starts_at' => $start, 'ends_at' => $start->copy()->addMinutes(30), 'price' => 1000, 'currency' => 'IRR']);
    $slots = collect([$slot]);
    if ($scope !== 'slot') {
        $slots->push(DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id,
            'starts_at' => $start->copy()->addMinutes(30), 'ends_at' => $start->copy()->addHour(), 'price' => 1000, 'currency' => 'IRR']));
    }
    if ($scope === 'week') {
        $nextRule = $rule->replicate(['public_id']);
        $nextRule->weekday = Carbon::TUESDAY;
        $nextRule->save();
        $slots->push(DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $nextRule->id,
            'starts_at' => $start->copy()->addDay(), 'ends_at' => $start->copy()->addDay()->addMinutes(30), 'price' => 1000, 'currency' => 'IRR']));
    }
    $immutable = ['id', 'public_id', 'doctor_working_window_id', 'doctor_workplace_id', 'checkup_id', 'starts_at', 'ends_at', 'currency'];

    return ['leader' => $leader, 'follower' => $follower, 'scope' => $scope,
        'patient' => $patient->id, 'admin' => $admin->id, 'leader_admin' => $admin->id, 'follower_admin' => $otherAdmin->id,
        'doctor' => $doctor->id, 'workplace' => $workplace->id, 'checkup' => $rule->checkup_id,
        'slot' => (string) $slot->public_id, 'date' => $start->copy()->setTimezone('Asia/Tehran')->toDateString(),
        'target_public_ids' => $slots->pluck('public_id')->all(),
        'immutable_slots' => $slots->map(fn ($target) => array_intersect_key($target->getAttributes(), array_flip($immutable)))->all()];
}

function schedulePair(string $name, string $leader, string $follower, string $scope = 'slot', bool $disable = false): array
{
    global $root, $probeStage;
    $probeStage = $name;
    $fixture = scheduleFixture($leader, $follower, $scope);
    $slot = DoctorVisitSlot::where('public_id', $fixture['slot'])->firstOrFail();
    $beforeAudit = AuditEvent::count();
    $beforeReservations = Reservation::count();
    $beforePayments = DB::table('reservation_payment_summaries')->count();
    $beforeOutbox = DB::table('outbox_events')->count();
    foreach (['leader', 'follower'] as $side) {
        if (in_array($fixture[$side], ['admin', 'audit_failure'], true)) {
            $selection = ['checkup_id' => $fixture['checkup'], 'scope' => $scope, 'date' => $fixture['date']];
            if ($scope === 'slot') {
                $selection['slot_public_id'] = $fixture['slot'];
            }
            $actorFixture = $fixture;
            $actorFixture['admin'] = $fixture[$side.'_admin'];
            $preview = app(AdminVisitSlotControl::class)->preview(scheduleRequest($actorFixture, $selection), $fixture['workplace']);
            scheduleEnsure($preview['eligible_count'] === count($fixture['target_public_ids']), 'Exact fresh single/day/week eligible fixtures required.');
            $fixture[$side.'_input'] = $selection + ['expected_revision' => $preview['revision'], 'preview_expires_at' => $preview['preview_expires_at'],
                'reason' => 'Synthetic concurrent admin control.', 'confirmed' => true] + ($disable ? ['is_active' => false] : ['price' => $side === 'leader' ? 2500 : 4000]);
        }
    }
    $token = bin2hex(random_bytes(8));
    file_put_contents($root.'/'.$token.'.json', json_encode($fixture, JSON_THROW_ON_ERROR));
    $processes = [];
    $env = array_fill_keys(array_unique(array_merge(array_keys(getenv()), array_keys($_ENV))), false);
    foreach (['CHECKUPINO_SCHEDULE_MYSQL_REHEARSAL', 'APP_ENV', 'APP_DEBUG', 'APP_KEY', 'DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE',
        'DB_USERNAME', 'DB_PASSWORD', 'DB_URL', 'DB_SOCKET', 'CACHE_STORE', 'SESSION_DRIVER', 'MAIL_MAILER', 'LOG_CHANNEL', 'QUEUE_CONNECTION',
        'MEDICAL_SCAN_ENABLED', 'MEDICAL_STORAGE_DRIVER', 'MEDICAL_LOCAL_STORAGE_ROOT', 'LARAVEL_STORAGE_PATH', 'APP_CONFIG_CACHE',
        'VIEW_COMPILED_PATH', 'BCRYPT_ROUNDS'] as $key) {
        $env[$key] = getenv($key);
    }
    $env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
    try {
        foreach (['leader', 'follower'] as $side) {
            $process = new Process([PHP_BINARY, __FILE__, 'child', $token, $side], '/var/www', $env, timeout: 25);
            $process->start();
            $processes[$side] = $process;
        }
        $results = [];
        foreach ($processes as $side => $process) {
            $process->wait();
            if (! $process->isSuccessful()) {
                foreach (preg_split('/\R/', trim($process->getErrorOutput())) as $line) {
                    $diagnostic = json_decode($line, true);
                    if (is_array($diagnostic) && ($diagnostic['schedule_probe_failure'] ?? null) === true) {
                        fwrite(STDERR, json_encode($diagnostic, JSON_THROW_ON_ERROR)."\n");
                    }
                }
            }
            scheduleEnsure($process->isSuccessful(), 'A concurrent writer failed before a verified result: '.$name.'/'.$side);
            $results[$side] = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }
    } finally {
        foreach ($processes as $process) {
            $process->stop(0);
        }
    }
    scheduleEnsure($results['leader']['leader_lock_observed'] && $results['follower']['follower_lock_attempt_observed'], 'Actual lock barriers must be observed.');
    scheduleEnsure($results['follower']['elapsed_ms'] >= 250, 'Follower must overlap the held production lock.');
    DB::purge();
    $slot->refresh();
    foreach ($fixture['immutable_slots'] as $immutable) {
        $current = DoctorVisitSlot::findOrFail($immutable['id']);
        $actual = array_intersect_key($current->getAttributes(), $immutable);
        // Fresh SELECT column order differs from factory insertion order.
        // Compare canonical keys while retaining strict value/type equality.
        ksort($actual);
        ksort($immutable);
        scheduleEnsure($actual === $immutable, 'Every target identity/time/currency must stay immutable.');
        scheduleEnsure($current->price === $slot->price && $current->is_active === $slot->is_active, 'Batch must settle entirely to the winning state.');
    }
    $adminCommitted = 0;
    $doctorCommitted = 0;
    $bookCommitted = 0;
    foreach (['leader', 'follower'] as $side) {
        $operation = $fixture[$side];
        $outcome = $results[$side]['outcome'];
        if ($operation === 'audit_failure') {
            scheduleEnsure($outcome === 'audit_rolled_back', 'Audit error must fail closed.');
        } elseif ($operation === 'doctor') {
            scheduleEnsure($outcome === ($leader === 'book' ? 'slot_reserved' : 'committed'), 'Doctor must complete without a deadlock victim, or protect a booking that committed first.');
            $doctorCommitted += (int) ($outcome === 'committed');
        } elseif ($operation === 'book') {
            scheduleEnsure($outcome === ($disable ? 'slot_unavailable' : 'committed'), 'Booking must see committed enabled/price state.');
            $bookCommitted += (int) ($outcome === 'committed');
        } else {
            scheduleEnsure(in_array($outcome, ['committed', 'stale_revision'], true), 'Admin retry must settle or refuse the stale revision.');
            $adminCommitted += (int) ($outcome === 'committed');
        }
    }
    if ($leader === 'book') {
        scheduleEnsure($results['follower']['outcome'] === ($follower === 'doctor' ? 'slot_reserved' : 'stale_revision') && $slot->price === 1000, 'A booked slot must not be changed by stale admin preview.');
    } elseif ($leader === 'audit_failure') {
        scheduleEnsure($slot->price === 1000, 'Audit refusal must restore the original price before booking.');
    } elseif ($leader === 'admin' && $follower === 'admin') {
        scheduleEnsure($results['leader']['outcome'] === 'committed' && $results['follower']['outcome'] === 'stale_revision'
            && $slot->price === 2500, 'Duplicate concurrent admin preview must commit exactly once.');
    } elseif ($follower === 'book') {
        scheduleEnsure($results['leader']['outcome'] === 'committed' && ($disable ? ! $slot->is_active : $slot->price === ($leader === 'doctor' ? 3000 : 2500)), 'Committed editor state must win before booking.');
    } elseif ($leader === 'doctor') {
        scheduleEnsure($results['leader']['outcome'] === 'committed' && $results['follower']['outcome'] === 'stale_revision' && $slot->price === 3000, 'Doctor-first commit must invalidate the earlier admin preview.');
    } else {
        scheduleEnsure($adminCommitted === 1 && $doctorCommitted === 1 && $slot->price === 3000, 'Admin-first edit and subsequent doctor set-value must serialize with two complete distinct audits.');
    }
    scheduleEnsure(AuditEvent::count() === $beforeAudit + $adminCommitted + $doctorCommitted, 'Exact committed audit count required.');
    scheduleEnsure(AuditEvent::where('subject_id', $fixture['workplace'])->where('action', 'admin.visit_slots.controlled')->count() === $adminCommitted
        && AuditEvent::where('subject_id', $fixture['workplace'])->where('action', 'doctor.visit_slots.controlled')->count() === $doctorCommitted, 'Audit action/subject must match the committed writer.');
    foreach (['leader', 'follower'] as $side) {
        if ($results[$side]['outcome'] === 'committed' && in_array($fixture[$side], ['admin', 'doctor'], true)) {
            $doctorAction = $fixture[$side] === 'doctor';
            $audit = AuditEvent::where('subject_id', $fixture['workplace'])
                ->where('action', $doctorAction ? 'doctor.visit_slots.controlled' : 'admin.visit_slots.controlled')->sole();
            scheduleEnsure($audit->actor_user_id === ($doctorAction ? $fixture['doctor'] : $fixture[$side.'_admin']), 'Audit must retain the real actor.');
            scheduleEnsure($doctorAction
                ? $audit->before['prices'] === [$leader === 'admin' ? 2500 : 1000] && $audit->after['prices'] === [3000]
                : array_column($audit->after['slots'], 'public_id') === $fixture['target_public_ids']
                    && array_column($audit->before['slots'], 'price') === array_fill(0, count($fixture['target_public_ids']), '1000')
                    && array_column($audit->after['slots'], 'price') === array_fill(0, count($fixture['target_public_ids']), (string) ($fixture[$side.'_input']['price'] ?? 1000))
                    && array_column($audit->after['slots'], 'is_active') === array_fill(0, count($fixture['target_public_ids']), $fixture[$side.'_input']['is_active'] ?? true), 'Audit snapshots must match every committed target.');
        }
    }
    scheduleEnsure(Reservation::count() === $beforeReservations + $bookCommitted
        && DB::table('reservation_payment_summaries')->count() === $beforePayments + $bookCommitted
        && DB::table('outbox_events')->count() === $beforeOutbox + $bookCommitted, 'Reservation/payment/outbox must commit together exactly once.');
    if ($bookCommitted) {
        $reservation = Reservation::where('doctor_visit_slot_id', $slot->id)->sole();
        $payment = $reservation->payment()->sole();
        scheduleEnsure($reservation->price_snapshot === $slot->price && (int) $payment->amount === $slot->price
            && $reservation->currency_snapshot === $slot->currency && $payment->currency === $slot->currency
            && $reservation->status->value === 'pending' && $payment->status->value === 'unpaid', 'Booked snapshot and unpaid money must agree with committed slot.');
    }

    $result = ['name' => $name, 'scope' => $scope, 'targets' => count($fixture['target_public_ids']), 'results' => $results, 'final_price' => (string) $slot->price, 'final_active' => $slot->is_active,
        'committed_admin_audits' => $adminCommitted, 'committed_doctor_audits' => $doctorCommitted, 'bookings' => $bookCommitted,
        'atomic_audit_payment_outbox_and_immutable_slot_verified' => true];
    fwrite(STDERR, json_encode(['schedule_case_result' => $result], JSON_THROW_ON_ERROR)."\n");

    return $result;
}

$cases = [
    schedulePair('booking_before_admin', 'book', 'admin'),
    schedulePair('admin_disables_before_booking', 'admin', 'book', disable: true),
    schedulePair('admin_price_before_booking', 'admin', 'book'),
    schedulePair('same_slot_admin_revision', 'admin', 'admin'),
    schedulePair('same_day_admin_revision', 'admin', 'admin', 'day'),
    schedulePair('same_week_admin_revision', 'admin', 'admin', 'week'),
    schedulePair('doctor_before_admin', 'doctor', 'admin'),
    schedulePair('admin_before_doctor', 'admin', 'doctor'),
    schedulePair('audit_rollback_releases_booking', 'audit_failure', 'book'),
    schedulePair('doctor_price_before_booking', 'doctor', 'book'),
    schedulePair('booking_before_doctor', 'book', 'doctor'),
];
scheduleEnsure((array) DB::table('jobs')->sole() === $sentinel && DB::table('jobs')->where('queue', 'medical-scan')->count() === 0, 'No job may be delivered or consumed.');
scheduleEnsure(DB::table('reservation_schedule_changes')->count() === 0 && DB::table('payment_attempts')->count() === 0
    && DB::table('payment_adjustments')->count() === 0 && DB::table('reservation_files')->count() === 0, 'No unrelated lifecycle or medical data allowed.');
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_schedule_acceptance', 'mysql' => $version, 'isolation' => $isolation,
    'cases' => $cases, 'default_queue_sentinel_unchanged' => true, 'medical_jobs' => 0,
    'limits' => ['Synthetic service transactions only; no HTTP/CSRF, privileged live save or sustained load acceptance.',
        'Doctor edits use consistent resource order; real forced retry/exhaustion is not claimed by these interleavings.',
        'Only existing migrations/role seed in the verified empty disposable tmpfs database; no reset or live schema operation.']], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n";
