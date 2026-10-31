<?php

use App\Enums\ReservationFileScanStatus;
use App\Jobs\MaterializeDoctorVisitSlots;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\User;
use App\Services\ReservationFileService;
use App\Support\VerifiedPrivateFile;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;
use Tests\Fixtures\SyntheticMedicalFiles;

function raceEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$mode = $argv[1] ?? '';
raceEnsure(in_array($mode, ['parent', 'child'], true)
    && getenv('CHECKUPINO_MEDICAL_MYSQL_REHEARSAL') === 'true'
    && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'mysql'
    && getenv('DB_HOST') === 'mysql-acceptance' && getenv('DB_PORT') === '3306'
    && getenv('DB_DATABASE') === 'checkupino_medical_acceptance'
    && getenv('DB_USERNAME') === 'medical_acceptance' && preg_match('/^[a-f0-9]{32}$/D', (string) getenv('DB_PASSWORD'))
    && ! getenv('DB_URL') && ! getenv('DB_SOCKET')
    && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    && getenv('LARAVEL_STORAGE_PATH') === '/tmp/medical-upload-races'
    && getenv('APP_CONFIG_CACHE') === '/tmp/medical-upload-races/config.php', 'Unsafe isolated MySQL rehearsal configuration.');
raceEnsure(posix_geteuid() === 33, 'Unprivileged PHP required.');
umask(0077);
$root = '/tmp/medical-upload-races';
if ($mode === 'parent') {
    raceEnsure(! file_exists($root), 'Parent temporary directory must start empty.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
}
$stat = lstat($root);
raceEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
    && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing') && ! file_exists($root.'/config.php'), 'Only the owned empty environment path is permitted.');
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root);
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, "Isolated upload-race probe failed; no completed acceptance.\n");
    exit(1);
});
raceEnsure(config('database.default') === 'mysql'
    && config('database.connections.mysql.host') === 'mysql-acceptance'
    && config('database.connections.mysql.database') === 'checkupino_medical_acceptance'
    && config('database.connections.mysql.username') === 'medical_acceptance'
    && ! config('database.connections.mysql.url') && ! config('medical.scanner.enabled'), 'Effective isolated configuration required.');
config(['filesystems.disks.private.root' => $root.'/private', 'medical_uploads.cache_store' => 'database',
    'medical_uploads.account_max_files' => 1, 'medical_uploads.account_max_bytes' => 1048576,
    'medical_uploads.concurrent_uploads' => 2]);
Storage::forgetDisk('private');
raceEnsure(DB::selectOne('SELECT DATABASE() AS name')->name === 'checkupino_medical_acceptance', 'Wrong database refused.');

function uploadSynthetic(int $owner, int $reservation): ReservationFile
{
    global $root;
    $bytes = file_get_contents($root.'/fixture.pdf');
    raceEnsure(is_string($bytes) && strlen($bytes) === 1048576, 'Exact synthetic fixture required.');
    $actor = User::findOrFail($owner);
    $visit = Reservation::findOrFail($reservation);
    raceEnsure((int) $visit->user_id === $owner, 'Synthetic fixture ownership must match.');

    return app(ReservationFileService::class)->upload(Request::create('/synthetic-upload-race'), $actor, $visit,
        UploadedFile::fake()->createWithContent('synthetic.pdf', $bytes), retentionUntil: now()->addYear());
}

if ($mode === 'child') {
    $token = $argv[2] ?? '';
    $index = $argv[3] ?? '';
    raceEnsure(preg_match('/^[a-f0-9]{8}$/D', $token) && in_array($index, ['0', '1'], true)
        && ctype_digit($argv[4] ?? '') && ctype_digit($argv[5] ?? ''), 'Invalid bounded child arguments.');
    file_put_contents($root.'/'.$token.'-'.$index.'.ready', 'ready');
    $deadline = microtime(true) + 15;
    while (! file_exists($root.'/'.$token.'.go') && microtime(true) < $deadline) {
        clearstatcache();
        usleep(10000);
    }
    raceEnsure(file_exists($root.'/'.$token.'.go'), 'Upload-race release barrier timed out.');
    $start = hrtime(true);
    try {
        $file = uploadSynthetic((int) $argv[4], (int) $argv[5]);
        raceEnsure($file->scan_status === ReservationFileScanStatus::Quarantined && $file->scanned_at === null
            && $file->size_bytes === 1048576, 'Uploaded fixture must remain quarantined with canonical size.');
        VerifiedPrivateFile::open($file)->close();
        $facts = ['accepted' => true, 'bytes' => 1048576, 'private_integrity' => true];
    } catch (ThrottleRequestsException $error) {
        raceEnsure($error->getMessage() === 'Medical upload capacity is busy.', 'Unexpected throttle reason.');
        $facts = ['accepted' => false, 'reason' => 'capacity_busy'];
    } catch (DomainException $error) {
        raceEnsure($error->getMessage() === 'Medical upload allowance is exhausted.', 'Unexpected allowance reason.');
        $facts = ['accepted' => false, 'reason' => 'quota_exhausted'];
    }
    echo json_encode([...$facts, 'seconds' => round((hrtime(true) - $start) / 1e9, 3)], JSON_THROW_ON_ERROR)."\n";
    exit(0);
}

pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new RuntimeException('Upload-race outer deadline exceeded.'));
pcntl_alarm(120);
raceEnsure((int) DB::selectOne('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()')->total === 0,
    'Temporary schema must be empty; never reset/reseed an existing database.');
raceEnsure(str_starts_with(DB::selectOne('SELECT VERSION() AS version')->version, '8.0.46'), 'Pinned MySQL version required.');
Artisan::call('migrate', ['--force' => true]); // Only the verified empty disposable database.
Artisan::call('db:seed', ['--class' => RolesSeeder::class, '--force' => true]); // Synthetic roles only.
$padding = 1046528;
for ($iteration = 0; $iteration < 8; $iteration++) {
    $bytes = SyntheticMedicalFiles::pdf(paddingBytes: $padding);
    if (strlen($bytes) === 1048576) {
        break;
    }
    $padding += 1048576 - strlen($bytes);
}
raceEnsure(strlen($bytes) === 1048576, 'Exact PDF construction failed.');
file_put_contents($root.'/fixture.pdf', $bytes);
$sentinelId = Queue::connection('database')->push(new MaterializeDoctorVisitSlots, '', 'default');
$sentinel = (array) DB::table('jobs')->where('id', $sentinelId)->sole();

function twoWriters(array $visits, bool $sameOwner): array
{
    global $root;
    raceEnsure(count($visits) === 2, 'Exactly two bounded writers required.');
    $baselineFiles = ReservationFile::count();
    $baselineAudit = AuditEvent::count();
    $baselineBlobs = count(Storage::disk('private')->allFiles());
    $token = bin2hex(random_bytes(4));
    $processes = [];
    // Whitelist inherited values: no project environment or live credentials reach children.
    $env = array_fill_keys(array_unique(array_merge(array_keys(getenv()), array_keys($_ENV))), false);
    foreach (['CHECKUPINO_MEDICAL_MYSQL_REHEARSAL', 'APP_ENV', 'APP_DEBUG', 'APP_KEY', 'DB_CONNECTION', 'DB_HOST', 'DB_PORT',
        'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_URL', 'DB_SOCKET', 'CACHE_STORE', 'SESSION_DRIVER', 'MAIL_MAILER', 'LOG_CHANNEL',
        'MEDICAL_SCAN_ENABLED', 'MEDICAL_STORAGE_DRIVER', 'MEDICAL_LOCAL_STORAGE_ROOT', 'LARAVEL_STORAGE_PATH', 'APP_CONFIG_CACHE',
        'VIEW_COMPILED_PATH', 'BCRYPT_ROUNDS'] as $key) {
        $env[$key] = getenv($key);
    }
    $env['PATH'] = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
    try {
        foreach ($visits as $index => $visit) {
            $process = new Process([PHP_BINARY, __FILE__, 'child', $token, (string) $index, (string) $visit->user_id, (string) $visit->id], '/var/www', $env, timeout: 45);
            $process->start();
            $processes[] = $process;
        }
        $deadline = microtime(true) + 15;
        while ((! is_file($root.'/'.$token.'-0.ready') || ! is_file($root.'/'.$token.'-1.ready')) && microtime(true) < $deadline) {
            foreach ($processes as $process) {
                raceEnsure($process->isRunning(), 'Both bounded writers must reach the release barrier.');
            }
            clearstatcache();
            usleep(10000);
        }
        raceEnsure(is_file($root.'/'.$token.'-0.ready') && is_file($root.'/'.$token.'-1.ready'), 'Writer release barrier timed out.');
        $start = hrtime(true);
        file_put_contents($root.'/'.$token.'.go', 'go');
        $results = [];
        foreach ($processes as $process) {
            $process->wait();
            raceEnsure($process->isSuccessful(), 'Upload-race child must exit successfully.');
            $results[] = json_decode($process->getOutput(), true, 8, JSON_THROW_ON_ERROR);
        }
        $accepted = count(array_filter($results, fn ($result) => $result['accepted']));
        $expected = $sameOwner ? 1 : 2;
        raceEnsure($accepted === $expected, 'Expected exact concurrent upload result.');
        raceEnsure(ReservationFile::count() === $baselineFiles + $expected && AuditEvent::count() === $baselineAudit + $expected
            && count(Storage::disk('private')->allFiles()) === $baselineBlobs + $expected, 'Committed blobs, files and audits must agree; no orphan or partial commit.');
        raceEnsure(DB::table('cache_locks')->where('key', 'like', '%medical-upload:%')->count() === 0, 'Only owned admission locks must release without leftovers.');

        return ['same_owner' => $sameOwner, 'writers' => 2, 'accepted' => $accepted, 'blocked' => 2 - $accepted,
            'seconds' => round((hrtime(true) - $start) / 1e9, 3), 'results' => $results, 'file_audit_blob_counts_agree' => true];
    } finally {
        foreach ($processes as $process) {
            $process->stop(0);
        }
        @unlink($root.'/'.$token.'-0.ready');
        @unlink($root.'/'.$token.'-1.ready');
        @unlink($root.'/'.$token.'.go');
    }
}

$owner = User::factory()->patient()->create();
$first = Reservation::factory()->create(['user_id' => $owner->id]);
$second = Reservation::factory()->create(['user_id' => $owner->id]);
$cases = [twoWriters([$first, $second], true)];
$quotaRejected = false;
try {
    uploadSynthetic($owner->id, $first->id);
} catch (DomainException $error) {
    $quotaRejected = $error->getMessage() === 'Medical upload allowance is exhausted.';
}
raceEnsure($quotaRejected && ReservationFile::count() === 1, 'Committed quota must block a later upload without extra records.');
$third = Reservation::factory()->create(['user_id' => User::factory()->patient()->create()->id]);
$fourth = Reservation::factory()->create(['user_id' => User::factory()->patient()->create()->id]);
$cases[] = twoWriters([$third, $fourth], false);
raceEnsure((array) DB::table('jobs')->where('id', $sentinelId)->sole() === $sentinel, 'Default-queue sentinel must remain unchanged.');
raceEnsure(DB::table('jobs')->where('queue', 'medical-scan')->count() === 0, 'No scan dispatch or worker consumption is allowed.');
raceEnsure(ReservationFile::count() === 3 && ReservationFile::where('scan_status', ReservationFileScanStatus::Quarantined->value)->count() === 3
    && ReservationFile::whereNotNull('scanned_at')->count() === 0, 'All committed synthetic uploads remain unscanned quarantine.');
foreach (ReservationFile::with('reservation')->get() as $file) {
    VerifiedPrivateFile::open($file)->close();
}
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'database' => 'checkupino_medical_acceptance', 'mysql' => '8.0.46',
    'cases' => $cases, 'later_quota_upload_rejected' => true, 'files' => 3, 'quarantined' => 3,
    'private_integrity_verified' => true, 'default_queue_sentinel_unchanged' => true, 'medical_scan_jobs' => 0,
    'medical_admission_locks_remaining' => DB::table('cache_locks')->where('key', 'like', '%medical-upload:%')->count(),
    'limits' => ['Two synchronized service writers, not HTTP/CSRF or sustained peak-load acceptance',
        'No crash/orphan reconciliation, lease-expiry or deployed restart/update-outage acceptance',
        'New schema and synthetic roles exist only in the operator-created disposable tmpfs database']], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n";
