<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Services\ClamdScanner;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class ClamdScannerTest extends TestCase
{
    public static function replies(): array
    {
        return [
            'clean' => ['stream: OK', ReservationFileScanStatus::Clean],
            'infected' => ['stream: Eicar-Signature FOUND', ReservationFileScanStatus::Infected],
            'encrypted PDF blocked' => ['stream: Heuristics.Encrypted.PDF FOUND', ReservationFileScanStatus::Failed],
            'scan limit blocked' => ['stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND', ReservationFileScanStatus::Failed],
            'engine error' => ['stream: private-path-secret ERROR', null],
            'unexpected reply' => ['OK', null],
            'appended reply' => ["stream: OK\0stream: Eicar-Signature FOUND", null],
        ];
    }

    #[DataProvider('replies')]
    public function test_real_socket_framing_digest_and_strict_verdicts(string $reply, ?ReservationFileScanStatus $status): void
    {
        $this->withDaemon($reply, $this->version(), $this->version(), function ($stream) use ($status): void {
            if ($status === null) {
                $this->expectException(RuntimeException::class);
                $this->expectExceptionMessage('Medical scanner is unavailable or rejected the scan.');
            }
            $result = app(ClamdScanner::class)->scan($stream);
            $this->assertSame($status, $result->status);
            $this->assertSame(hash('sha256', $this->content()), $result->checksumSha256);
            $this->assertSame('1.5.4', $result->engineVersion);
            $this->assertSame('999999', $result->databaseVersion);
            $this->assertArrayNotHasKey('signature', $result->auditFacts());
        }, str_contains($reply, "\0") ? 2 : 3);
    }

    public static function unsafeVersions(): array
    {
        return [
            'stale definitions' => ['ClamAV 1.5.4/999999/'.gmdate('D M j H:i:s Y', time() - 172801)],
            'future definitions' => ['ClamAV 1.5.4/999999/'.gmdate('D M j H:i:s Y', time() + 3600)],
            'wrong engine' => ['ClamAV 1.5.3/999999/'.gmdate('D M j H:i:s Y')],
            'unknown version' => ['COMMAND UNAVAILABLE'],
        ];
    }

    #[DataProvider('unsafeVersions')]
    public function test_untrusted_or_stale_engine_cannot_approve_content(string $version): void
    {
        $this->withDaemon('stream: OK', $version, $version, function ($stream): void {
            $this->expectException(RuntimeException::class);
            app(ClamdScanner::class)->scan($stream);
        }, 1);
    }

    public function test_database_reload_during_scan_prevents_clean_acceptance(): void
    {
        $this->withDaemon('stream: OK', $this->version(), str_replace('/999999/', '/999998/', $this->version()), function ($stream): void {
            $this->expectException(RuntimeException::class);
            app(ClamdScanner::class)->scan($stream);
        });
    }

    public function test_socket_timeout_is_bounded_and_fails_without_exposing_endpoint(): void
    {
        config(['medical.scanner.timeout_seconds' => 1]);
        $this->withDaemon('stream: OK', $this->version(), $this->version(), function ($stream): void {
            $start = microtime(true);
            try {
                app(ClamdScanner::class)->scan($stream);
                $this->fail('A stalled daemon must not approve content.');
            } catch (RuntimeException $exception) {
                $this->assertSame('Medical scanner is unavailable or rejected the scan.', $exception->getMessage());
                $this->assertLessThan(2.5, microtime(true) - $start);
            }
        }, 1, true);
    }

    public function test_missing_socket_fails_without_exposing_path(): void
    {
        config(['medical.scanner.socket' => '/tmp/checkupino-scanner-no-such-private-endpoint.sock']);
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, 'synthetic');
        rewind($stream);
        try {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('Medical scanner is unavailable or rejected the scan.');
            app(ClamdScanner::class)->scan($stream);
        } finally {
            fclose($stream);
        }
    }

    private function version(): string
    {
        return 'ClamAV 1.5.4/999999/'.gmdate('D M j H:i:s Y');
    }

    private function content(): string
    {
        return str_repeat('synthetic scanner bytes ', 10000);
    }

    private function withDaemon(string $reply, string $before, string $after, callable $test, int $connections = 3, bool $stall = false): void
    {
        $path = '/tmp/checkupino-clamd-test-'.bin2hex(random_bytes(8)).'.sock';
        $server = stream_socket_server('unix://'.$path, $errorCode, $errorMessage);
        $this->assertIsResource($server);
        config(['medical.scanner.socket' => $path]);
        $pid = pcntl_fork();
        if ($pid === -1) {
            fclose($server);
            unlink($path);
            $this->fail('The socket protocol fixture must fork.');
        }
        if ($pid === 0) {
            for ($index = 0; $index < $connections; $index++) {
                $client = @stream_socket_accept($server, 3);
                if (! is_resource($client)) {
                    exit(1);
                }
                stream_set_timeout($client, 3);
                $command = '';
                while (! str_ends_with($command, "\0") && ! feof($client)) {
                    $command .= fread($client, 1);
                }
                if ($stall) {
                    usleep(1200000);
                    fclose($client);
                    break;
                }
                if ($command === "zVERSION\0") {
                    $response = ($index === 0 ? $before : $after)."\0";
                } elseif ($command === "zINSTREAM\0") {
                    $hash = hash_init('sha256');
                    while (true) {
                        $length = unpack('N', $this->readExactly($client, 4))[1];
                        if ($length === 0) {
                            break;
                        }
                        if ($length > 65536) {
                            exit(1);
                        }
                        hash_update($hash, $this->readExactly($client, $length));
                    }
                    if (! hash_equals(hash('sha256', $this->content()), hash_final($hash))) {
                        exit(1);
                    }
                    $response = $reply."\0";
                } else {
                    exit(1);
                }
                // Exercise fragmented records rather than assuming one socket read.
                if (str_contains($reply, "\0")) {
                    fwrite($client, $response);
                } else {
                    fwrite($client, substr($response, 0, 5));
                    usleep(1000);
                    fwrite($client, substr($response, 5));
                }
                fclose($client);
            }
            fclose($server);
            exit(0);
        }
        fclose($server);
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, $this->content());
        rewind($stream);
        try {
            $test($stream);
        } finally {
            fclose($stream);
            pcntl_waitpid($pid, $status);
            unlink($path);
            $this->assertSame(0, pcntl_wexitstatus($status), 'The daemon fixture must observe correct framing and complete.');
        }
    }

    private function readExactly(mixed $client, int $length): string
    {
        $bytes = '';
        while (strlen($bytes) < $length) {
            $chunk = fread($client, $length - strlen($bytes));
            if ($chunk === '' || $chunk === false) {
                exit(1);
            }
            $bytes .= $chunk;
        }

        return $bytes;
    }
}
