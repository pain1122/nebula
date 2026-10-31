<?php

namespace App\Services {
    // Test process only: simulate definition age without changing host/daemon clocks or databases.
    function time(): int
    {
        if (getenv('CHECKUPINO_SCANNER_FAILURE_REHEARSAL') !== 'true') {
            throw new \RuntimeException('Scanner test clock requires the isolated rehearsal.');
        }

        return \time() + (int) getenv('CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET');
    }
}

namespace {
    use App\Enums\ReservationFileScanStatus;
    use App\Services\ClamdScanner;
    use Illuminate\Contracts\Console\Kernel;
    use Illuminate\Support\Facades\Artisan;

    function ensure(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException($message);
        }
    }

    ensure(getenv('CHECKUPINO_SCANNER_FAILURE_REHEARSAL') === 'true'
        && getenv('APP_ENV') === 'testing' && getenv('DB_CONNECTION') === 'sqlite'
        && getenv('DB_DATABASE') === ':memory:' && ! getenv('DB_URL')
        && getenv('APP_KEY') === 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
        && getenv('LARAVEL_STORAGE_PATH') === '/tmp/scanner-failures'
        && getenv('APP_CONFIG_CACHE') === '/tmp/scanner-failures/config.php'
        && getenv('CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET') === '0', 'Unsafe scanner rehearsal configuration.');
    ensure(function_exists('pcntl_fork') && posix_geteuid() === 33, 'Restricted PHP runtime required.');
    $root = '/tmp/scanner-failures';
    ensure(! file_exists($root), 'Rehearsal directory must start empty.');
    mkdir($root, 0700);
    foreach (['framework/cache', 'framework/sessions', 'framework/views', 'logs'] as $directory) {
        mkdir($root.'/'.$directory, 0700, true);
    }
    ensure(! file_exists($root.'/.env') && ! file_exists($root.'/.env.testing')
        && ! file_exists($root.'/config.php'), 'No environment or cached configuration may be loaded.');
    require '/var/www/vendor/autoload.php';
    $app = require '/var/www/bootstrap/app.php';
    $app->useEnvironmentPath($root);
    $app->make(Kernel::class)->bootstrap();
    ensure(config('database.default') === 'sqlite'
        && config('database.connections.sqlite.database') === ':memory:'
        && config('app.key') === getenv('APP_KEY'), 'Isolated application configuration required.');
    config(['medical.scanner.socket' => '/run/medical-scan/clamd.sock', 'medical.scanner.timeout_seconds' => 5]);
    pcntl_async_signals(true);
    pcntl_signal(SIGALRM, fn () => throw new RuntimeException('Scanner rehearsal exceeded its outer deadline.'));
    pcntl_alarm(40);
    $content = 'Checkupino synthetic runtime failure probe';
    $checks = [];

    function scanSynthetic(): mixed
    {
        global $content;
        $stream = fopen('php://memory', 'w+b');
        fwrite($stream, $content);
        rewind($stream);
        try {
            return app(ClamdScanner::class)->scan($stream);
        } finally {
            fclose($stream);
        }
    }

    function rejected(string $name): float
    {
        global $checks;
        $start = hrtime(true);
        try {
            scanSynthetic();
        } catch (RuntimeException $error) {
            ensure($error->getMessage() === 'Medical scanner is unavailable or rejected the scan.', 'Failure must redact provider details.');
            $seconds = (hrtime(true) - $start) / 1e9;
            $checks[$name] = ['rejected' => true, 'seconds' => round($seconds, 3), 'redacted' => true];

            return $seconds;
        }
        throw new RuntimeException('Unsafe synthetic scan was accepted.');
    }

    function readBytes(mixed $socket, int $length): string
    {
        $bytes = '';
        while (strlen($bytes) < $length) {
            $chunk = fread($socket, $length - strlen($bytes));
            ensure(is_string($chunk) && $chunk !== '', 'Bounded gateway frame incomplete.');
            $bytes .= $chunk;
        }

        return $bytes;
    }

    function terminated(mixed $socket): string
    {
        $bytes = '';
        while (strlen($bytes) < 4096) {
            $bytes .= readBytes($socket, 1);
            if (str_ends_with($bytes, "\0")) {
                return $bytes;
            }
        }
        throw new RuntimeException('Bounded gateway reply too long.');
    }

    function sendBytes(mixed $socket, string $bytes): void
    {
        while ($bytes !== '') {
            $written = fwrite($socket, $bytes);
            ensure(is_int($written) && $written > 0, 'Bounded gateway write incomplete.');
            $bytes = substr($bytes, $written);
        }
    }

    function engineRequest(string $request): string
    {
        $socket = stream_socket_client('unix:///run/medical-scan/clamd.sock', $code, $message, 2);
        ensure(is_resource($socket), 'Actual scanner socket unavailable.');
        stream_set_timeout($socket, 2);
        try {
            sendBytes($socket, $request);

            return terminated($socket);
        } finally {
            fclose($socket);
        }
    }

    function withGateway(string $scenario): void
    {
        global $root, $content, $checks;
        ensure(in_array($scenario, ['error', 'timeout'], true), 'Unknown gateway scenario.');
        $path = $root.'/'.$scenario.'.sock';
        $report = $root.'/'.$scenario.'.json';
        $server = stream_socket_server('unix://'.$path, $code, $message);
        ensure(is_resource($server), 'Disposable gateway unavailable.');
        $pid = pcntl_fork();
        ensure($pid >= 0, 'Disposable gateway fork failed.');
        if ($pid === 0) {
            pcntl_signal(SIGALRM, fn () => exit(70));
            pcntl_alarm(8);
            try {
                $client = stream_socket_accept($server, 3);
                ensure(is_resource($client), 'Gateway version request missing.');
                stream_set_timeout($client, 2);
                ensure(terminated($client) === "zVERSION\0", 'Only VERSION and synthetic INSTREAM are allowed.');
                sendBytes($client, engineRequest("zVERSION\0"));
                fclose($client);
                $client = stream_socket_accept($server, 3);
                ensure(is_resource($client), 'Gateway scan request missing.');
                stream_set_timeout($client, 2);
                ensure(terminated($client) === "zINSTREAM\0", 'Only synthetic streaming is allowed.');
                $bytes = '';
                while (true) {
                    $length = unpack('Nsize', readBytes($client, 4))['size'];
                    if ($length === 0) {
                        break;
                    }
                    ensure($length <= 1024 && strlen($bytes) + $length <= 1024, 'Synthetic gateway byte limit exceeded.');
                    $bytes .= readBytes($client, $length);
                }
                ensure(hash_equals($content, $bytes), 'Gateway accepts only the exact synthetic fixture.');
                if ($scenario === 'error') {
                    // The real daemon rejects this declared frame before receiving any large payload.
                    $reply = engineRequest("zINSTREAM\0".pack('N', 10485761));
                    ensure(str_contains($reply, 'INSTREAM size limit exceeded') && str_ends_with($reply, "ERROR\0"), 'Expected actual engine size-limit ERROR.');
                    file_put_contents($report, json_encode(['real_engine_error_observed' => true], JSON_THROW_ON_ERROR));
                } else {
                    $reply = engineRequest("zINSTREAM\0".pack('N', strlen($bytes)).$bytes.pack('N', 0));
                    ensure($reply === "stream: OK\0", 'Expected actual clean engine response before injected transport delay.');
                    file_put_contents($report, json_encode(['real_clean_reply_before_injected_delay' => true], JSON_THROW_ON_ERROR));
                    usleep(1500000);
                }
                @fwrite($client, $reply);
                fclose($client);
                fclose($server);
                exit(0);
            } catch (Throwable) {
                exit(71);
            }
        }
        fclose($server);
        $finished = false;
        try {
            config(['medical.scanner.socket' => $path, 'medical.scanner.timeout_seconds' => $scenario === 'timeout' ? 1 : 5]);
            $elapsed = rejected($scenario === 'error' ? 'actual_engine_protocol_error' : 'injected_transport_timeout');
            if ($scenario === 'timeout') {
                ensure($elapsed >= 0.9 && $elapsed < 3, 'Client timeout must remain bounded.');
            }
            $deadline = microtime(true) + 5;
            do {
                $finished = pcntl_waitpid($pid, $status, WNOHANG) === $pid;
                if (! $finished) {
                    usleep(10000);
                }
            } while (! $finished && microtime(true) < $deadline);
            ensure($finished && pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0, 'Disposable gateway must finish successfully.');
            $checks[$scenario.'_gateway'] = json_decode(file_get_contents($report), true, 4, JSON_THROW_ON_ERROR);
        } finally {
            if (! $finished) {
                posix_kill($pid, SIGKILL);
                pcntl_waitpid($pid, $status);
            }
            @unlink($path);
            @unlink($report);
            config(['medical.scanner.socket' => '/run/medical-scan/clamd.sock', 'medical.scanner.timeout_seconds' => 5]);
        }
    }

    ensure(Artisan::call('medical:scanner-check', ['--probe' => true]) === 0, 'Initial actual fresh-definition clean/EICAR gate failed.');
    $checks['initial_clean_eicar'] = true;
    withGateway('error');
    withGateway('timeout');
    putenv('CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET=172801');
    try {
        rejected('real_version_rejected_by_injected_stale_clock');
    } finally {
        putenv('CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET=0');
    }
    putenv('CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET=-86400');
    try {
        rejected('real_version_rejected_by_injected_future_clock');
    } finally {
        putenv('CHECKUPINO_SCANNER_TEST_CLOCK_OFFSET=0');
    }
    config(['medical.scanner.socket' => $root.'/absent.sock']);
    try {
        rejected('unavailable_socket');
    } finally {
        config(['medical.scanner.socket' => '/run/medical-scan/clamd.sock']);
    }
    $result = scanSynthetic();
    ensure($result->status === ReservationFileScanStatus::Clean
        && hash_equals(hash('sha256', $content), $result->checksumSha256), 'Recovered actual engine must approve only matching clean bytes.');
    ensure(Artisan::call('medical:scanner-check', ['--probe' => true]) === 0, 'Final actual clean/EICAR gate failed.');
    $checks['final_recovery_clean_eicar'] = true;
    pcntl_alarm(0);
    echo json_encode(['acceptance' => 'passed', 'checks' => $checks,
        'engine_version' => $result->engineVersion, 'database_version' => $result->databaseVersion,
        'definition_time' => $result->databaseUpdatedAt,
        'limitations' => ['Timeout is injected at the transport boundary, not daemon compute saturation',
            'Stale/future age is an isolated application-clock injection against a real VERSION reply, not a stale daemon database',
            'No database, queue, live definition/config/clock or clinical file writes']], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)."\n";
}
