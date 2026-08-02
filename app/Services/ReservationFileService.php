<?php

namespace App\Services;

use App\Enums\ReservationFileScanStatus;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\User;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ReservationFileService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function upload(
        Request $request,
        User $actor,
        Reservation $reservation,
        UploadedFile $upload,
        ?string $label = null,
        ?\DateTimeInterface $retentionUntil = null,
    ): ReservationFile {
        Gate::forUser($actor)->authorize('upload', [ReservationFile::class, $reservation]);
        Validator::make(['file' => $upload, 'label' => $label], [
            'file' => ['required', 'file', 'max:10240', 'mimetypes:application/pdf,image/jpeg,image/png'],
            'label' => ['nullable', 'string', 'max:255'],
        ])->validate();

        if ($retentionUntil !== null && $retentionUntil <= now()) {
            throw new InvalidArgumentException('Reservation file retention must be in the future.');
        }

        $publicId = (string) Str::ulid();
        $mimeType = (string) $upload->getMimeType();
        $extension = match ($mimeType) {
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            default => throw new DomainException('Unsupported private file MIME type.'),
        };
        $safeFilename = $publicId.'.'.$extension;
        $directory = 'reservation-files/quarantine/'.$reservation->public_id;
        $path = Storage::disk('private')->putFileAs($directory, $upload, $safeFilename);

        if (! is_string($path) || $path === '') {
            throw new DomainException('Private reservation file storage failed.');
        }

        try {
            return DB::transaction(function () use (
                $request,
                $actor,
                $reservation,
                $upload,
                $label,
                $retentionUntil,
                $publicId,
                $mimeType,
                $extension,
                $safeFilename,
                $path,
            ): ReservationFile {
                $file = new ReservationFile;
                $file->forceFill([
                    'public_id' => $publicId,
                    'reservation_id' => $reservation->getKey(),
                    'uploaded_by' => $actor->getKey(),
                    'disk' => 'private',
                    'path' => $path,
                    'original_filename' => Str::limit($upload->getClientOriginalName(), 255, ''),
                    'safe_filename' => $safeFilename,
                    'label' => $label,
                    'mime_type' => $mimeType,
                    'extension' => $extension,
                    'size_bytes' => $upload->getSize(),
                    'checksum_sha256' => hash_file('sha256', $upload->getRealPath()),
                    'classification' => 'medical',
                    'scan_status' => ReservationFileScanStatus::Quarantined,
                    'retention_until' => $retentionUntil,
                ])->save();

                $this->auditLogger->log(
                    request: $request,
                    actor: $actor,
                    action: 'reservation_file.uploaded',
                    subject: $file,
                    riskLevel: 'high',
                    before: null,
                    after: $this->snapshot($file),
                );

                return $file;
            });
        } catch (Throwable $exception) {
            Storage::disk('private')->delete($path);

            throw $exception;
        }
    }

    public function recordScan(
        Request $request,
        ReservationFile $file,
        ReservationFileScanStatus $result,
    ): ReservationFile {
        if ($result === ReservationFileScanStatus::Quarantined) {
            throw new InvalidArgumentException('A completed scan cannot remain quarantined.');
        }

        return DB::transaction(function () use ($request, $file, $result): ReservationFile {
            $lockedFile = ReservationFile::query()->lockForUpdate()->findOrFail($file->getKey());

            if ($lockedFile->scan_status !== ReservationFileScanStatus::Quarantined || $lockedFile->trashed()) {
                throw new DomainException('Only an active quarantined file may receive a scan result.');
            }

            $before = $this->snapshot($lockedFile);
            $lockedFile->forceFill([
                'scan_status' => $result,
                'scanned_at' => now(),
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: null,
                action: 'reservation_file.scan_recorded',
                subject: $lockedFile,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($lockedFile),
            );

            return $lockedFile->fresh();
        });
    }

    public function download(Request $request, User $actor, ReservationFile $file): StreamedResponse
    {
        Gate::forUser($actor)->authorize('view', $file);
        $file->refresh();

        if ($file->trashed()
            || $file->scan_status !== ReservationFileScanStatus::Clean
            || ($file->retention_until !== null && $file->retention_until->isPast())) {
            throw new DomainException('Private file is not available for download.');
        }

        if ($file->disk !== 'private' || ! Storage::disk('private')->exists($file->path)) {
            throw new DomainException('Private file storage metadata is invalid.');
        }

        $this->auditLogger->log(
            request: $request,
            actor: $actor,
            action: 'reservation_file.accessed',
            subject: $file,
            riskLevel: 'critical',
            before: null,
            after: ['scan_status' => $file->scan_status->value],
        );

        return Storage::disk('private')->download(
            $file->path,
            $file->safe_filename,
            ['Content-Type' => $file->mime_type],
        );
    }

    public function archive(Request $request, User $actor, ReservationFile $file, string $reason): void
    {
        Gate::forUser($actor)->authorize('archive', $file);
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A reservation file archive reason is required.');
        }

        DB::transaction(function () use ($request, $actor, $file, $reason): void {
            $lockedFile = ReservationFile::query()->lockForUpdate()->findOrFail($file->getKey());
            $before = $this->snapshot($lockedFile);
            $lockedFile->forceFill([
                'archived_by' => $actor->getKey(),
                'archive_reason' => $reason,
            ]);
            $lockedFile->save();
            $lockedFile->delete();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'reservation_file.archived',
                subject: $lockedFile,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($lockedFile),
                reason: $reason,
            );
        });
    }

    public function replace(
        Request $request,
        User $actor,
        ReservationFile $file,
        UploadedFile $replacement,
        string $reason,
        ?string $label = null,
        ?\DateTimeInterface $retentionUntil = null,
    ): ReservationFile {
        $newFile = null;

        try {
            return DB::transaction(function () use (
                $request,
                $actor,
                $file,
                $replacement,
                $reason,
                $label,
                $retentionUntil,
                &$newFile,
            ): ReservationFile {
                $newFile = $this->upload(
                    $request,
                    $actor,
                    $file->reservation,
                    $replacement,
                    $label,
                    $retentionUntil,
                );
                $this->archive($request, $actor, $file, $reason);

                return $newFile;
            });
        } catch (Throwable $exception) {
            if ($newFile instanceof ReservationFile) {
                Storage::disk('private')->delete($newFile->path);
            }

            throw $exception;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(ReservationFile $file): array
    {
        return [
            'reservation_public_id' => $file->reservation?->public_id,
            'classification' => $file->classification,
            'scan_status' => $file->scan_status->value,
            'mime_type' => $file->mime_type,
            'size_bytes' => $file->size_bytes,
            'retention_until' => $file->retention_until?->toISOString(),
            'archived' => $file->trashed(),
        ];
    }
}
