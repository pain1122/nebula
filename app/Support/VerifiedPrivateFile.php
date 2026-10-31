<?php

namespace App\Support;

use App\Models\ReservationFile;
use DomainException;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class VerifiedPrivateFile
{
    /** @param resource $stream */
    private function __construct(private mixed $stream) {}

    public static function open(ReservationFile $file): self
    {
        $extension = FileUploadPolicy::extensionForMime((string) $file->mime_type);
        $expectedPath = 'reservation-files/quarantine/'.$file->reservation?->public_id.'/'.$file->public_id.'.'.$extension;
        $expectedBytes = (int) $file->size_bytes;
        if ($file->disk !== 'private' || $extension === null || $file->extension !== $extension
            || ! preg_match('/^[0-9a-hjkmnp-tv-z]{26}$/iD', (string) $file->public_id)
            || ! preg_match('/^[0-9a-hjkmnp-tv-z]{26}$/iD', (string) $file->reservation?->public_id)
            || $file->safe_filename !== $file->public_id.'.'.$extension || $file->path !== $expectedPath
            || ! preg_match('/^[a-f0-9]{64}$/D', (string) $file->checksum_sha256)
            || $expectedBytes < 1 || $expectedBytes > FileUploadPolicy::capacityMaxBytes()) {
            throw new DomainException('Private file storage metadata is invalid.');
        }

        $source = null;
        $snapshot = null;
        try {
            $source = Storage::disk('private')->readStream($file->path);
            $snapshot = fopen('php://temp/maxmemory:1048576', 'w+b');
            if (! is_resource($source) || ! is_resource($snapshot)) {
                throw new DomainException('Private file cannot be verified.');
            }

            $hash = hash_init('sha256');
            $bytes = 0;
            while (! feof($source)) {
                $chunk = fread($source, min(65536, $expectedBytes - $bytes + 1));
                if ($chunk === false || ($chunk === '' && ! feof($source))) {
                    throw new DomainException('Private file cannot be verified.');
                }
                $bytes += strlen($chunk);
                if ($bytes > $expectedBytes || fwrite($snapshot, $chunk) !== strlen($chunk)) {
                    throw new DomainException('Private file integrity verification failed.');
                }
                hash_update($hash, $chunk);
            }
            if ($bytes !== $expectedBytes || ! hash_equals($file->checksum_sha256, hash_final($hash))) {
                throw new DomainException('Private file integrity verification failed.');
            }
            rewind($snapshot);

            return new self($snapshot);
        } catch (Throwable $exception) {
            if (is_resource($snapshot)) {
                fclose($snapshot);
            }
            throw new DomainException('Private file integrity verification failed.', 0, $exception);
        } finally {
            if (is_resource($source)) {
                fclose($source);
            }
        }
    }

    public function send(): void
    {
        try {
            fpassthru($this->stream);
        } finally {
            $this->close();
        }
    }

    /** The scanner reads the already verified snapshot; the callback never opens storage. */
    public function useStream(callable $reader): mixed
    {
        try {
            rewind($this->stream);

            return $reader($this->stream);
        } finally {
            $this->close();
        }
    }

    public function close(): void
    {
        if (is_resource($this->stream)) {
            fclose($this->stream);
        }
    }

    public function __destruct()
    {
        $this->close();
    }
}
