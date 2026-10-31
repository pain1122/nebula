<?php

use App\Enums\ReservationFileScanStatus;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Services\ClamdScanner;
use App\Services\MedicalContentValidator;
use App\Support\VerifiedPrivateFile;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Fixtures\SyntheticMedicalFiles;

function capacityEnsure(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$sustained = ($argv[1] ?? '') === '--sustained';
capacityEnsure(count($argv) === ($sustained ? 2 : 1), 'Only the bounded optional sustained mode is permitted.');
capacityEnsure(getenv('CHECKUPINO_SCANNER_CAPACITY_REHEARSAL') === 'true'
    && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'sqlite'
    && getenv('DB_DATABASE') === ':memory:' && ! getenv('DB_URL')
    && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    && getenv('LARAVEL_STORAGE_PATH') === '/tmp/scanner-capacity'
    && getenv('APP_CONFIG_CACHE') === '/tmp/scanner-capacity/config.php', 'Unsafe scanner capacity configuration.');
capacityEnsure(function_exists('pcntl_fork') && posix_geteuid() === 33, 'Restricted PHP fork runtime required.');
$root = '/tmp/scanner-capacity';
capacityEnsure(! file_exists($root), 'Capacity directory must start empty.');
mkdir($root, 0700);
foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs', 'private'] as $directory) {
    mkdir($root.'/'.$directory, 0700, true);
}
require '/var/www/vendor/autoload.php';
$app = require '/var/www/bootstrap/app.php';
$app->useEnvironmentPath($root);
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, "Synthetic capacity probe failed; no acceptance produced.\n");
    exit(1);
});
capacityEnsure(config('database.default') === 'sqlite'
    && config('database.connections.sqlite.database') === ':memory:'
    && config('app.key') === getenv('APP_KEY'), 'Isolated application configuration required.');
config(['filesystems.disks.private.root' => $root.'/private', 'medical_parser.test_inline' => false,
    'medical_parser.socket' => '/run/medical-content/content.sock',
    'medical.scanner.socket' => '/run/medical-scan/clamd.sock', 'medical.scanner.timeout_seconds' => 5]);
Storage::forgetDisk('private');
pcntl_async_signals(true);
pcntl_signal(SIGALRM, fn () => throw new RuntimeException('Capacity probe exceeded outer deadline.'));
pcntl_alarm(75);
$padding = 1046528;
for ($iteration = 0; $iteration < 8; $iteration++) {
    $content = SyntheticMedicalFiles::pdf(paddingBytes: $padding);
    if (strlen($content) === 1048576) {
        break;
    }
    $padding += 1048576 - strlen($content);
}
capacityEnsure(strlen($content) === 1048576, 'Exact PDF fixture construction failed.');
$digest = hash('sha256', $content);
$reservation = (new Reservation)->forceFill(['public_id' => (string) Str::ulid()]);
$id = (string) Str::ulid();
$file = (new ReservationFile)->forceFill(['public_id' => $id, 'disk' => 'private',
    'path' => 'reservation-files/quarantine/'.$reservation->public_id.'/'.$id.'.pdf',
    'safe_filename' => $id.'.pdf', 'extension' => 'pdf', 'mime_type' => 'application/pdf',
    'size_bytes' => 1048576, 'checksum_sha256' => $digest, 'scan_status' => ReservationFileScanStatus::Quarantined]);
$file->setRelation('reservation', $reservation);
capacityEnsure(! $file->exists && ! $reservation->exists, 'Only unsaved synthetic metadata is permitted.');
capacityEnsure(Storage::disk('private')->put($file->path, $content), 'Synthetic fixture write failed.');

function verifiedRead(bool $scan): array
{
    global $file, $digest;
    $start = hrtime(true);
    $facts = VerifiedPrivateFile::open($file)->useStream(function ($stream) use ($scan, $digest): array {
        if (! $scan) {
            $readHash = hash_init('sha256');
            capacityEnsure(hash_update_stream($readHash, $stream) === 1048576
                && hash_equals($digest, hash_final($readHash)), 'Verified concurrent read must match the complete fixture.');

            return ['mode' => 'read', 'bytes' => 1048576, 'integrity' => true];
        }
        $verdict = app(ClamdScanner::class)->scan($stream);
        capacityEnsure($verdict->status === ReservationFileScanStatus::Clean
            && hash_equals($digest, $verdict->checksumSha256), 'Actual scan must match clean synthetic bytes.');
        $parser = app(MedicalContentValidator::class)->validate($stream, 'application/pdf');
        capacityEnsure($parser['content_validator'] === 'qpdf-12.4.2/medical-v1', 'Remote parser identity must match.');

        return ['mode' => 'scan_parse', 'bytes' => 1048576, 'integrity' => true,
            'engine' => $verdict->engineVersion, 'database' => $verdict->databaseVersion,
            'validator' => $parser['content_validator']];
    });

    return ['accepted' => true, ...$facts, 'seconds' => round((hrtime(true) - $start) / 1e9, 3)];
}

function concurrentCase(int $scans, int $reads, bool $requireAll): array
{
    global $root;
    capacityEnsure($scans >= 1 && $scans <= 4 && $reads >= 1 && $reads <= 4, 'Concurrency must remain bounded.');
    $token = bin2hex(random_bytes(4));
    $go = $root.'/'.$token.'.go';
    $children = [];
    try {
        for ($index = 0; $index < $scans + $reads; $index++) {
            $ready = $root.'/'.$token.'-'.$index.'.ready';
            $result = $root.'/'.$token.'-'.$index.'.json';
            $pid = pcntl_fork();
            capacityEnsure($pid >= 0, 'Bounded capacity fork failed.');
            if ($pid === 0) {
                pcntl_signal(SIGALRM, fn () => exit(70));
                pcntl_alarm(35);
                try {
                    file_put_contents($ready, 'ready');
                    $deadline = microtime(true) + 5;
                    while (! file_exists($go) && microtime(true) < $deadline) {
                        clearstatcache(true, $go);
                        usleep(1000);
                    }
                    capacityEnsure(file_exists($go), 'Concurrent release barrier timed out.');
                    $facts = verifiedRead($index < $scans);
                } catch (RuntimeException|DomainException $error) {
                    $allowed = ['Medical scanner is unavailable or rejected the scan.',
                        'Medical content validation did not pass; file access remains blocked.'];
                    if (! in_array($error->getMessage(), $allowed, true) || $index >= $scans) {
                        exit(71);
                    }
                    $facts = ['accepted' => false, 'mode' => 'scan_parse', 'blocked_and_redacted' => true];
                } catch (Throwable) {
                    exit(72);
                }
                file_put_contents($result, json_encode($facts, JSON_THROW_ON_ERROR));
                exit(0);
            }
            $children[$pid] = ['ready' => $ready, 'result' => $result, 'finished' => false];
        }
        $deadline = microtime(true) + 5;
        do {
            clearstatcache();
            $readyCount = count(array_filter($children, fn ($child) => is_file($child['ready'])));
            if ($readyCount < count($children)) {
                usleep(1000);
            }
        } while ($readyCount < count($children) && microtime(true) < $deadline);
        capacityEnsure($readyCount === count($children), 'All children must be ready before concurrent release.');
        $start = hrtime(true);
        file_put_contents($go, 'go');
        $deadline = microtime(true) + 36;
        $results = [];
        do {
            foreach ($children as $pid => $child) {
                if (! $child['finished'] && pcntl_waitpid($pid, $status, WNOHANG) === $pid) {
                    $children[$pid]['finished'] = true;
                    capacityEnsure(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0, 'Capacity child must finish without hidden integrity/guard failures.');
                    $results[] = json_decode(file_get_contents($child['result']), true, 8, JSON_THROW_ON_ERROR);
                }
            }
            if (count($results) < count($children)) {
                usleep(10000);
            }
        } while (count($results) < count($children) && microtime(true) < $deadline);
        capacityEnsure(count($results) === count($children), 'Bounded capacity children did not all finish.');
        $accepted = count(array_filter($results, fn ($result) => $result['accepted']));
        capacityEnsure(! $requireAll || $accepted === count($results), 'One/two-scan demo cases require every scan/parse/read to pass.');
        capacityEnsure(count(array_filter($results, fn ($result) => $result['mode'] === 'read' && $result['accepted'])) === $reads, 'All concurrent verified reads must pass.');

        return ['scans' => $scans, 'reads' => $reads, 'accepted' => $accepted,
            'blocked' => count($results) - $accepted, 'wall_seconds' => round((hrtime(true) - $start) / 1e9, 3), 'results' => $results];
    } finally {
        foreach ($children as $pid => $child) {
            if (! $child['finished']) {
                posix_kill($pid, SIGKILL);
                pcntl_waitpid($pid, $status);
            }
            @unlink($child['ready']);
            @unlink($child['result']);
        }
        @unlink($go);
    }
}

capacityEnsure(Artisan::call('medical:scanner-check', ['--probe' => true]) === 0, 'Actual clean/EICAR/freshness prerequisite failed.');
$baseline = verifiedRead(true);
if ($sustained) {
    $runStart = microtime(true);
    $rounds = 0;
    $accepted = 0;
    $blocked = 0;
    $scanTimes = [];
    $readTimes = [];
    do {
        $roundStart = microtime(true);
        $batch = concurrentCase(2, 2, true);
        $rounds++;
        $accepted += $batch['accepted'];
        $blocked += $batch['blocked'];
        foreach ($batch['results'] as $result) {
            if ($result['mode'] === 'read') {
                $readTimes[] = $result['seconds'];
            } else {
                $scanTimes[] = $result['seconds'];
            }
        }
        // Bound the offered rate as well as parallelism; no unpaced saturation loop.
        $pause = max(0, 0.5 - (microtime(true) - $roundStart));
        if ($pause > 0) {
            usleep((int) ($pause * 1000000));
        }
    } while ($rounds < 64 && microtime(true) - $runStart < 30);
    capacityEnsure($rounds >= 5 && $blocked === 0 && $accepted === $rounds * 4,
        'Every repeated two-scan/two-read operation must pass.');
    $summarize = function (array $values): array {
        sort($values, SORT_NUMERIC);
        $count = count($values);

        return ['samples' => $count, 'p50_seconds' => $values[(int) ceil($count * 0.5) - 1],
            'p95_seconds' => $values[(int) ceil($count * 0.95) - 1], 'max_seconds' => $values[$count - 1]];
    };
    $cases = [['scans_per_round' => 2, 'reads_per_round' => 2, 'rounds' => $rounds,
        'accepted' => $accepted, 'blocked' => $blocked, 'wall_seconds' => round(microtime(true) - $runStart, 3),
        'minimum_batch_interval_seconds' => 0.5, 'scan_parse' => $summarize($scanTimes),
        'read' => $summarize($readTimes)]];
} else {
    $cases = [concurrentCase(1, 2, true), concurrentCase(2, 2, true), concurrentCase(4, 4, false)];
}
$snapshot = VerifiedPrivateFile::open($file);
capacityEnsure(Storage::disk('private')->put($file->path, str_repeat('z', 1048576)), 'Synthetic-only integrity mutation failed.');
$snapshot->useStream(function ($stream) use ($digest): void {
    $hash = hash_init('sha256');
    capacityEnsure(hash_update_stream($hash, $stream) === 1048576
        && hash_equals($digest, hash_final($hash)), 'Previously verified snapshot must remain immutable.');
});
$tamperRejected = false;
try {
    VerifiedPrivateFile::open($file)->close();
} catch (DomainException) {
    $tamperRejected = true;
}
capacityEnsure($tamperRejected, 'A new read must reject altered synthetic storage.');
capacityEnsure(Storage::disk('private')->put($file->path, $content), 'Synthetic fixture restoration failed.');
$recovery = verifiedRead(true);
capacityEnsure(Artisan::call('medical:scanner-check', ['--probe' => true]) === 0, 'Actual clean/EICAR recovery failed.');
capacityEnsure(Storage::disk('private')->delete($file->path), 'Synthetic fixture cleanup failed.');
pcntl_alarm(0);
echo json_encode(['acceptance' => 'passed', 'fixture_bytes' => 1048576, 'baseline' => $baseline,
    'workload' => $sustained ? 'paced_30_second_repetition' : 'single_bounded_bursts',
    'cases' => $cases, 'verified_snapshot_immutable_and_new_tampered_read_rejected' => true,
    'recovery' => $recovery, 'peak_php_memory_mib' => round(memory_get_peak_usage(true) / 1048576, 2),
    'limits' => ['Bounded synthetic 1 MiB PDF workload; no videos/ZIP, production load or throughput guarantee',
        'Optional repeated mode is paced for 30 seconds, at most 64 batches; not saturation or a production SLO',
        'Four-scan burst permits bounded redacted rejection and is not an admitted-concurrency setting',
        'No database/schema/queue/HTTP/owner authorization or MySQL upload-race acceptance',
        'No deployed scanner/parser restart or definition-update-outage acceptance']], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n";
