<?php

namespace App\Services {
    // Isolated consumer clock only; no host/daemon clock or database timestamp changes.
    function time(): int
    {
        if (getenv('CHECKUPINO_SCANNER_RECOVERY_REHEARSAL') !== 'true') {
            throw new \RuntimeException('Scanner recovery test clock requires isolation.');
        }

        return \time() + (int) getenv('CHECKUPINO_SCANNER_RECOVERY_CLOCK_OFFSET');
    }
}

namespace {
    use App\Enums\ReservationFileScanStatus;
    use App\Services\ClamdScanner;
    use Illuminate\Contracts\Console\Kernel;

    function recoveryEnsure(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException($message);
        }
    }

    $phase = $argv[1] ?? '';
    $root = '/tmp/scanner-recovery';
    recoveryEnsure(count($argv) === 2 && in_array($phase, ['active', 'stopped', 'aged'], true)
        && getenv('CHECKUPINO_SCANNER_RECOVERY_REHEARSAL') === 'true'
        && getenv('CHECKUPINO_SCANNER_RECOVERY_CLOCK_OFFSET') === '0'
        && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'sqlite'
        && getenv('DB_DATABASE') === ':memory:' && ! getenv('DB_URL')
        && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
        && getenv('LARAVEL_STORAGE_PATH') === $root && getenv('APP_CONFIG_CACHE') === $root.'/config.php'
        && posix_geteuid() === 33, 'Unsafe isolated scanner recovery configuration.');
    umask(0077);
    if (! file_exists($root)) {
        mkdir($root, 0700);
        foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs'] as $directory) {
            mkdir($root.'/'.$directory, 0700, true);
        }
    }
    $stat = lstat($root);
    recoveryEnsure(is_array($stat) && $stat['uid'] === 33 && ($stat['mode'] & 0170000) === 0040000
        && ! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing')
        && ! file_exists($root.'/config.php'), 'Owned isolated environment required.');
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->useEnvironmentPath($root);
    $app->make(Kernel::class)->bootstrap();
    set_exception_handler(function (Throwable $error): void {
        fwrite(STDERR, "Isolated scanner recovery failed; no completed acceptance.\n");
        exit(1);
    });
    recoveryEnsure(config('database.default') === 'sqlite'
        && config('database.connections.sqlite.database') === ':memory:'
        && ! config('database.connections.sqlite.url') && config('app.key') === getenv('APP_KEY'),
        'Effective isolated SQLite/key required.');
    config(['medical.scanner.socket' => '/run/medical-scan/clamd.sock', 'medical.scanner.timeout_seconds' => 3]);
    pcntl_async_signals(true);
    pcntl_signal(SIGALRM, fn () => throw new RuntimeException('Scanner recovery probe deadline exceeded.'));
    pcntl_alarm(12);
    $socket = lstat('/run/medical-scan/clamd.sock');
    recoveryEnsure(is_array($socket) && $socket['uid'] === 100 && ($socket['mode'] & 0170000) === 0140000
        && ($socket['mode'] & 0777) === 0666, 'Only the sandbox daemon socket is permitted.');

    function recoveryScan(string $bytes): mixed
    {
        $stream = fopen('php://memory', 'w+b');
        fwrite($stream, $bytes);
        rewind($stream);
        try {
            $verdict = app(ClamdScanner::class)->scan($stream);
            recoveryEnsure(hash_equals(hash('sha256', $bytes), $verdict->checksumSha256), 'Synthetic scan integrity required.');

            return $verdict;
        } finally {
            fclose($stream);
        }
    }

    $start = hrtime(true);
    if ($phase === 'active') {
        $clean = recoveryScan('Checkupino isolated offline recovery check');
        $infected = recoveryScan('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
        recoveryEnsure($clean->status === ReservationFileScanStatus::Clean
            && $infected->status === ReservationFileScanStatus::Infected && $clean->engineVersion === '1.5.4'
            && $clean->databaseVersion === $infected->databaseVersion, 'Actual clean/infected verdicts required.');
        $facts = ['clean_eicar_integrity' => true, 'engine' => $clean->engineVersion,
            'definitions' => $clean->databaseVersion, 'definitions_updated_at' => $clean->databaseUpdatedAt];
    } else {
        if ($phase === 'aged') {
            putenv('CHECKUPINO_SCANNER_RECOVERY_CLOCK_OFFSET=172801');
        }
        $rejected = false;
        try {
            recoveryScan('Checkupino isolated offline recovery check');
        } catch (RuntimeException $error) {
            recoveryEnsure($error->getMessage() === 'Medical scanner is unavailable or rejected the scan.', 'Failure must redact details.');
            $rejected = true;
        } finally {
            putenv('CHECKUPINO_SCANNER_RECOVERY_CLOCK_OFFSET=0');
        }
        recoveryEnsure($rejected, 'Unavailable or synthetically aged consumer must reject.');
        $facts = ['rejected_and_redacted' => true, 'clock_offset_test_only' => $phase === 'aged'];
    }
    pcntl_alarm(0);
    echo json_encode(['acceptance' => 'passed', 'phase' => $phase, 'socket_inode' => $socket['ino'],
        'seconds' => round((hrtime(true) - $start) / 1e9, 3), ...$facts], JSON_THROW_ON_ERROR)."\n";
}
