<?php

// Standalone trusted supervisor. No Laravel boot, .env, database or storage driver.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use App\Services\MedicalContentValidator;
use App\Support\MedicalContentPolicy;
use App\Support\MedicalContentProtocol as Protocol;

umask(0077);
$path = $argv[1] ?? '/run/medical-content/content.sock';
if (! is_string($path) || ! str_starts_with($path, '/') || strlen($path) > 100 || str_contains($path, "\0")) {
    exit(1);
}
$leasePath = $path.'.lock';
$leaseStat = @lstat($leasePath);
if (is_array($leaseStat) && (($leaseStat['mode'] & 0170000) !== 0100000 || $leaseStat['uid'] !== posix_geteuid())) {
    exit(1);
}
$lease = @fopen($leasePath, 'c+b');
if (! is_resource($lease) || ! flock($lease, LOCK_EX | LOCK_NB) || ! chmod($leasePath, 0600)) {
    exit(1); // An active supervisor's socket is never removed.
}
$socketStat = @lstat($path);
if (is_array($socketStat)) {
    if (($socketStat['mode'] & 0170000) !== 0140000 || $socketStat['uid'] !== posix_geteuid() || ! unlink($path)) {
        exit(1); // Recover only a stale socket owned by this unprivileged UID.
    }
}
$policy = MedicalContentPolicy::fromRules(require dirname(__DIR__, 2).'/config/medical_content.php');
$validator = new class($policy) extends MedicalContentValidator
{
    public function __construct(private readonly MedicalContentPolicy $serverPolicy) {}

    protected function inlineAllowed(): bool
    {
        return true; // This executable is installed only in the isolated parser image.
    }

    protected function policy(): MedicalContentPolicy
    {
        return $this->serverPolicy;
    }

    protected function capacity(): int
    {
        return Protocol::MAX_BYTES;
    }

    protected function imageHelper(): string
    {
        return __DIR__.'/validate-medical-image.php';
    }
};
$server = @stream_socket_server('unix://'.$path, $errorCode, $errorMessage, STREAM_SERVER_BIND | STREAM_SERVER_LISTEN);
if (! is_resource($server) || ! chmod($path, 0600)) {
    exit(1);
}
try {
    while (true) {
        $client = @stream_socket_accept($server, 1);
        if (! is_resource($client)) {
            continue;
        }
        $snapshot = null;
        try {
            stream_set_blocking($client, false);
            $deadline = Protocol::deadline(15);
            $header = Protocol::line($client, $deadline);
            Protocol::assertHeader($header, $policy);
            $snapshot = fopen('php://temp/maxmemory:1048576', 'w+b');
            if (! is_resource($snapshot)) {
                throw new DomainException;
            }
            $bytes = 0;
            $hash = hash_init('sha256');
            while ($bytes < $header['bytes']) {
                $chunk = Protocol::read($client, min(65536, $header['bytes'] - $bytes), $deadline);
                if ($chunk === '' || fwrite($snapshot, $chunk) !== strlen($chunk)) {
                    throw new DomainException;
                }
                hash_update($hash, $chunk);
                $bytes += strlen($chunk);
            }
            Protocol::end($client, $deadline);
            if (! hash_equals($header['sha256'], hash_final($hash))) {
                throw new DomainException;
            }
            $facts = $validator->validate($snapshot, $header['mime']);
            Protocol::write($client, json_encode([...$header, 'ok' => true, 'validator' => $facts['content_validator']], JSON_THROW_ON_ERROR)."\n", Protocol::deadline(2));
        } catch (Throwable) {
            // Reject by closing the socket. Never return/log parser diagnostics or text.
        } finally {
            if (is_resource($snapshot)) {
                fclose($snapshot);
            }
            fclose($client);
        }
    }
} finally {
    fclose($server);
    // Kernel flock release fences crash recovery; only our own socket is removed.
    if (file_exists($path)) {
        unlink($path);
    }
    flock($lease, LOCK_UN);
    fclose($lease);
}
