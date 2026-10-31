<?php

namespace App\Services;

use App\Enums\ReservationFileScanStatus;
use App\Support\FileUploadPolicy;
use App\Support\MedicalScanVerdict;
use DateTimeImmutable;
use DateTimeZone;
use RuntimeException;
use Throwable;

class ClamdScanner
{
    private const ERROR = 'Medical scanner is unavailable or rejected the scan.';

    /** @param resource $source */
    public function scan(mixed $source): MedicalScanVerdict
    {
        $connection = null;
        try {
            if (! is_resource($source)) {
                throw new RuntimeException(self::ERROR);
            }
            $maxBytes = FileUploadPolicy::scannerMaxBytes();
            $timeout = config('medical.scanner.timeout_seconds', 45);
            if (! is_int($timeout) || $timeout < 1 || $timeout > 45) {
                throw new RuntimeException(self::ERROR);
            }
            $deadline = hrtime(true) / 1e9 + $timeout;
            $version = $this->version($deadline);
            $connection = $this->connect($deadline);
            $this->write($connection, "zINSTREAM\0", $deadline);
            $digest = hash_init('sha256');
            $size = 0;
            while (! feof($source)) {
                $chunk = fread($source, 65536);
                if ($chunk === false || ($chunk === '' && ! feof($source))) {
                    throw new RuntimeException(self::ERROR);
                }
                $size += strlen($chunk);
                if ($size > $maxBytes) {
                    throw new RuntimeException(self::ERROR);
                }
                if ($chunk !== '') {
                    $this->write($connection, pack('N', strlen($chunk)).$chunk, $deadline);
                    hash_update($digest, $chunk);
                }
            }
            if ($size === 0) {
                throw new RuntimeException(self::ERROR);
            }
            $this->write($connection, pack('N', 0), $deadline);
            $response = $this->read($connection, $deadline);
            fclose($connection);
            $connection = null;
            if ($version !== $this->version($deadline)) {
                throw new RuntimeException(self::ERROR);
            }
            $status = match (true) {
                $response === 'stream: OK' => ReservationFileScanStatus::Clean,
                preg_match('/^stream: Heuristics\.(Encrypted|Limits\.Exceeded)[A-Za-z0-9._ -]* FOUND$/D', $response) === 1 => ReservationFileScanStatus::Failed,
                preg_match('/^stream: [A-Za-z0-9._() -]+ FOUND$/D', $response) === 1 => ReservationFileScanStatus::Infected,
                default => throw new RuntimeException(self::ERROR),
            };

            return new MedicalScanVerdict($status, hash_final($digest), ...$version);
        } catch (Throwable) {
            // Do not retain socket paths, signature text or provider exception details.
            throw new RuntimeException(self::ERROR);
        } finally {
            if (is_resource($connection)) {
                fclose($connection);
            }
        }
    }

    /** @return array{string, string, string} */
    private function version(float $deadline): array
    {
        $connection = $this->connect($deadline);
        try {
            $this->write($connection, "zVERSION\0", $deadline);
            $response = $this->read($connection, $deadline);
        } finally {
            fclose($connection);
        }
        if (! preg_match('/^ClamAV ([0-9]+\.[0-9]+\.[0-9]+)\/([0-9]+)\/([^\x00-\x1f]{1,100})$/D', $response, $matches)
            || $matches[1] !== '1.5.4') {
            throw new RuntimeException(self::ERROR);
        }
        $updated = new DateTimeImmutable($matches[3], new DateTimeZone('UTC'));
        $age = time() - $updated->getTimestamp();
        if ($age < -300 || $age > 172800) {
            throw new RuntimeException(self::ERROR);
        }

        return [$matches[1], $matches[2], $updated->setTimezone(new DateTimeZone('UTC'))->format(DATE_ATOM)];
    }

    /** @return resource */
    private function connect(float $deadline): mixed
    {
        $path = config('medical.scanner.socket', '/run/medical-scan/clamd.sock');
        if (! is_string($path) || ! str_starts_with($path, '/') || str_contains($path, "\0")) {
            throw new RuntimeException(self::ERROR);
        }
        $remaining = $deadline - hrtime(true) / 1e9;
        if ($remaining <= 0) {
            throw new RuntimeException(self::ERROR);
        }
        $connection = @stream_socket_client('unix://'.$path, $errorCode, $errorMessage, min(2, $remaining));
        if (! is_resource($connection) || ! stream_set_blocking($connection, false)) {
            if (is_resource($connection)) {
                fclose($connection);
            }
            throw new RuntimeException(self::ERROR);
        }

        return $connection;
    }

    /** @param resource $connection */
    private function ready(mixed $connection, float $deadline, bool $writing): void
    {
        $remaining = $deadline - hrtime(true) / 1e9;
        if ($remaining <= 0) {
            throw new RuntimeException(self::ERROR);
        }
        $seconds = (int) $remaining;
        $microseconds = (int) (($remaining - $seconds) * 1000000);
        $read = $writing ? [] : [$connection];
        $write = $writing ? [$connection] : [];
        $except = [];
        if (@stream_select($read, $write, $except, $seconds, $microseconds) !== 1) {
            throw new RuntimeException(self::ERROR);
        }
    }

    /** @param resource $connection */
    private function write(mixed $connection, string $bytes, float $deadline): void
    {
        while ($bytes !== '') {
            $this->ready($connection, $deadline, true);
            $written = @fwrite($connection, $bytes);
            if ($written === false || $written === 0) {
                throw new RuntimeException(self::ERROR);
            }
            $bytes = substr($bytes, $written);
        }
    }

    /** @param resource $connection */
    private function read(mixed $connection, float $deadline): string
    {
        $response = '';
        while (strlen($response) < 4096) {
            $this->ready($connection, $deadline, false);
            $chunk = @fread($connection, 4096 - strlen($response));
            if ($chunk === false || $chunk === '') {
                throw new RuntimeException(self::ERROR);
            }
            $response .= $chunk;
            $terminator = strpos($response, "\0");
            if ($terminator !== false) {
                if ($terminator !== strlen($response) - 1) {
                    throw new RuntimeException(self::ERROR);
                }

                return substr($response, 0, -1);
            }
        }
        throw new RuntimeException(self::ERROR);
    }
}
