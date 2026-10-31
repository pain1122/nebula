<?php

namespace App\Support;

use DomainException;

/** A single bounded, identity-bound request over the private Unix socket. */
final class MedicalContentProtocol
{
    public const MAX_BYTES = 10485760;

    public const MAX_HEADER = 2048;

    public static function deadline(int $seconds = 30): int
    {
        return hrtime(true) + $seconds * 1000000000;
    }

    public function validateRemotely($stream, string $mime, MedicalContentPolicy $policy, int $capacity, mixed $path): array
    {
        $socket = null;
        try {
            if (! is_resource($stream) || ! in_array($mime, ['application/pdf', 'image/jpeg', 'image/png'], true)
                || ! is_string($path) || ! str_starts_with($path, '/') || strlen($path) > 100 || str_contains($path, "\0")
                || $capacity < 1 || $capacity > self::MAX_BYTES || ! rewind($stream)) {
                throw new DomainException;
            }
            $bytes = 0;
            $hash = hash_init('sha256');
            while (! feof($stream)) {
                $chunk = fread($stream, min(65536, $capacity - $bytes + 1));
                if ($chunk === false || ($chunk === '' && ! feof($stream))) {
                    throw new DomainException;
                }
                $bytes += strlen($chunk);
                if ($bytes > $capacity) {
                    throw new DomainException;
                }
                hash_update($hash, $chunk);
            }
            if ($bytes < 1 || ! rewind($stream)) {
                throw new DomainException;
            }
            $header = ['version' => 1, 'nonce' => bin2hex(random_bytes(16)), 'bytes' => $bytes,
                'sha256' => hash_final($hash), 'mime' => $mime, 'revision' => $policy->revision];
            $deadline = self::deadline();
            $socket = @stream_socket_client('unix://'.$path, $errorCode, $errorMessage, 2);
            if (! is_resource($socket) || ! stream_set_blocking($socket, false)) {
                throw new DomainException;
            }
            self::write($socket, json_encode($header, JSON_THROW_ON_ERROR)."\n", $deadline);
            $sent = 0;
            $sentHash = hash_init('sha256');
            while ($sent < $bytes) {
                $chunk = fread($stream, min(65536, $bytes - $sent));
                if (! is_string($chunk) || $chunk === '') {
                    throw new DomainException;
                }
                self::write($socket, $chunk, $deadline);
                $sent += strlen($chunk);
                hash_update($sentHash, $chunk);
            }
            if (fread($stream, 1) !== '' || ! feof($stream) || ! hash_equals($header['sha256'], hash_final($sentHash))
                || ! stream_socket_shutdown($socket, STREAM_SHUT_WR)) {
                throw new DomainException;
            }
            $reply = self::line($socket, $deadline);
            self::end($socket, $deadline);
            self::assertReply($reply, $header);
            if (! hash_equals($policy->revision, MedicalContentPolicy::current()->revision)) {
                throw new DomainException;
            }

            return ['content_policy_revision' => $reply['revision'], 'content_validator' => $reply['validator']];
        } finally {
            if (is_resource($socket)) {
                fclose($socket);
            }
        }
    }

    public static function assertHeader(array $header, MedicalContentPolicy $policy): void
    {
        $keys = array_keys($header);
        sort($keys);
        if ($keys !== ['bytes', 'mime', 'nonce', 'revision', 'sha256', 'version'] || $header['version'] !== 1
            || ! is_int($header['bytes']) || $header['bytes'] < 1 || $header['bytes'] > self::MAX_BYTES
            || ! is_string($header['mime']) || ! in_array($header['mime'], ['application/pdf', 'image/jpeg', 'image/png'], true)
            || ! is_string($header['nonce']) || ! preg_match('/^[a-f0-9]{32}$/D', $header['nonce'])
            || ! is_string($header['sha256']) || ! preg_match('/^[a-f0-9]{64}$/D', $header['sha256'])
            || ! is_string($header['revision']) || ! hash_equals($policy->revision, $header['revision'])) {
            throw new DomainException;
        }
    }

    public static function assertReply(array $reply, array $header): void
    {
        $keys = array_keys($reply);
        sort($keys);
        if ($keys !== ['bytes', 'mime', 'nonce', 'ok', 'revision', 'sha256', 'validator', 'version']
            || ($reply['version'] ?? null) !== 1 || ($reply['ok'] ?? null) !== true) {
            throw new DomainException;
        }
        foreach (['bytes', 'mime', 'nonce', 'revision', 'sha256'] as $key) {
            if ($reply[$key] !== $header[$key]) {
                throw new DomainException;
            }
        }
        if (! is_string($reply['validator']) || ($header['mime'] === 'application/pdf'
            ? $reply['validator'] !== 'qpdf-12.4.2/medical-v1'
            : ! preg_match('/^gd-(?:[0-9]+\.[0-9]+\.[0-9]+|bundled\/php-[0-9]+\.[0-9]+\.[0-9]+)\/medical-v1$/D', $reply['validator']))) {
            throw new DomainException;
        }
    }

    public static function line($socket, int $deadline): array
    {
        $line = '';
        while (strlen($line) < self::MAX_HEADER) {
            $char = self::read($socket, 1, $deadline);
            if ($char === "\n") {
                $value = json_decode($line, true, 16, JSON_THROW_ON_ERROR);
                if (! is_array($value) || json_encode($value, JSON_THROW_ON_ERROR) !== $line) {
                    throw new DomainException;
                }

                return $value;
            }
            if ($char === '') {
                throw new DomainException;
            }
            $line .= $char;
        }
        throw new DomainException;
    }

    public static function end($socket, int $deadline): void
    {
        if (self::read($socket, 1, $deadline) !== '' || ! feof($socket)) {
            throw new DomainException;
        }
    }

    public static function read($socket, int $length, int $deadline): string
    {
        self::wait($socket, $deadline, false);
        $chunk = fread($socket, $length);
        if (! is_string($chunk) || ($chunk === '' && ! feof($socket))) {
            throw new DomainException;
        }

        return $chunk;
    }

    public static function write($socket, string $bytes, int $deadline): void
    {
        while ($bytes !== '') {
            self::wait($socket, $deadline, true);
            $written = fwrite($socket, $bytes);
            if (! is_int($written) || $written < 1) {
                throw new DomainException;
            }
            $bytes = substr($bytes, $written);
        }
    }

    private static function wait($socket, int $deadline, bool $writing): void
    {
        $remaining = $deadline - hrtime(true);
        if ($remaining <= 0) {
            throw new DomainException;
        }
        $read = $writing ? [] : [$socket];
        $write = $writing ? [$socket] : [];
        $except = [];
        if (@stream_select($read, $write, $except, intdiv($remaining, 1000000000), intdiv($remaining % 1000000000, 1000)) !== 1) {
            throw new DomainException;
        }
    }
}
