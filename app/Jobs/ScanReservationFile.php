<?php

namespace App\Jobs;

use App\Enums\ReservationFileScanStatus;
use App\Models\ReservationFile;
use App\Services\ClamdScanner;
use App\Services\ReservationFileService;
use App\Support\VerifiedPrivateFile;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class ScanReservationFile implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(public string $filePublicId, public string $checksumSha256)
    {
        $this->onConnection('medical-scan')->onQueue('medical-scan')->beforeCommit();
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [15, 60];
    }

    public function handle(ClamdScanner $scanner, ReservationFileService $files): void
    {
        $file = $this->eligibleFile();
        if ($file === null) {
            return;
        }
        try {
            $snapshot = VerifiedPrivateFile::open($file);
            $verdict = $snapshot->useStream(fn ($stream) => $scanner->scan($stream));
            if (! hash_equals($this->checksumSha256, $verdict->checksumSha256)) {
                throw new RuntimeException('Medical scan content identity is invalid.');
            }
            $files->recordScan(Request::create('/internal/medical-scan'), $file, $verdict->status, $verdict->checksumSha256, $verdict);
        } catch (Throwable) {
            // A concurrent successful job or archive makes this delivery harmless.
            if ($this->eligibleFile() !== null) {
                throw new RuntimeException('Medical scan could not complete; file access remains blocked.');
            }
        }
    }

    public function failed(?Throwable $exception): void
    {
        $file = $this->eligibleFile();
        if ($file !== null) {
            try {
                app(ReservationFileService::class)->recordScan(Request::create('/internal/medical-scan'), $file, ReservationFileScanStatus::Failed, $this->checksumSha256);
            } catch (Throwable) {
                // Failure to persist a failure verdict must still leave access blocked.
                throw new RuntimeException('Medical scan failure could not be recorded; file access remains blocked.');
            }
        }
    }

    private function eligibleFile(): ?ReservationFile
    {
        if (! config('medical.scanner.enabled', false)) {
            return null;
        }
        $file = ReservationFile::query()->where('public_id', $this->filePublicId)->first();
        if ($file === null || $file->scan_status !== ReservationFileScanStatus::Quarantined
            || ! hash_equals((string) $file->checksum_sha256, $this->checksumSha256)
            || ($file->retention_until !== null && $file->retention_until->isPast())) {
            return null;
        }

        return $file;
    }
}
