<?php

namespace App\Services;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use App\Support\FileUploadPolicy;
use App\Support\MedicalScanVerdict;
use App\Support\VerifiedPrivateFile;
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
        private readonly MedicalScanQueue $scanQueue,
        private readonly MedicalContentValidator $contentValidator,
        private readonly MedicalUploadAdmission $uploadAdmission,
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

        return $this->storeUpload(
            $request,
            $actor,
            $reservation,
            $upload,
            $label,
            $retentionUntil,
        );
    }

    public function uploadForMedicalRequest(
        Request $request,
        User $actor,
        ReservationMedicalRequest $medicalRequest,
        UploadedFile $upload,
        ?string $label = null,
    ): ReservationFile {
        Gate::forUser($actor)->authorize('upload', $medicalRequest);

        return $this->storeUpload(
            $request,
            $actor,
            $medicalRequest->reservation,
            $upload,
            $label,
            medicalRequest: $medicalRequest,
        );
    }

    private function storeUpload(
        Request $request,
        User $actor,
        Reservation $reservation,
        UploadedFile $upload,
        ?string $label = null,
        ?\DateTimeInterface $retentionUntil = null,
        ?ReservationMedicalRequest $medicalRequest = null,
    ): ReservationFile {
        $attachmentPolicy = $medicalRequest === null ? null : app(MedicalAttachmentPolicy::class)->forUpload(
            $actor, $medicalRequest, $reservation,
        );
        Validator::make(['file' => $upload, 'label' => $label], [
            'file' => ($attachmentPolicy['policy'] ?? app(UploadPolicySettings::class)->forSection('medical'))->fileRules(),
            'label' => ['nullable', 'string', 'max:255'],
        ])->validate();

        if ($retentionUntil !== null && $retentionUntil <= now()) {
            throw new InvalidArgumentException('Reservation file retention must be in the future.');
        }

        $stagedFile = null;
        try {
            return $this->uploadAdmission->within($reservation, $medicalRequest, (int) $upload->getSize(), function () use (
                $request, $actor, $reservation, $upload, $label, $retentionUntil, $medicalRequest, $attachmentPolicy, &$stagedFile,
            ): ReservationFile {
                return $stagedFile = $this->persistUpload($request, $actor, $reservation, $upload, $label, $retentionUntil, $medicalRequest, $attachmentPolicy);
            });
        } catch (Throwable $exception) {
            if ($stagedFile instanceof ReservationFile) {
                Storage::disk('private')->delete($stagedFile->path);
            }
            throw $exception;
        }
    }

    private function persistUpload(
        Request $request,
        User $actor,
        Reservation $reservation,
        UploadedFile $upload,
        ?string $label,
        ?\DateTimeInterface $retentionUntil,
        ?ReservationMedicalRequest $medicalRequest,
        ?array $attachmentPolicy,
    ): ReservationFile {
        $publicId = (string) Str::ulid();
        $mimeType = (string) $upload->getMimeType();
        $extension = FileUploadPolicy::extensionForMime($mimeType)
            ?? throw new DomainException('Unsupported private file MIME type.');
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
                $medicalRequest,
                $attachmentPolicy,
            ): ReservationFile {
                $lockedMedicalRequest = null;

                if ($medicalRequest !== null) {
                    $lockedMedicalRequest = ReservationMedicalRequest::query()
                        ->lockForUpdate()
                        ->findOrFail($medicalRequest->getKey());

                    if ($lockedMedicalRequest->reservation_id !== $reservation->getKey()
                        || $lockedMedicalRequest->reservation?->user_id !== $actor->getKey()) {
                        throw new DomainException('Medical request ownership is invalid.');
                    }

                    if ($lockedMedicalRequest->status !== ReservationMedicalRequestStatus::Open) {
                        throw new DomainException('Only an open medical request accepts files.');
                    }

                    if ($lockedMedicalRequest->retention_until === null
                        || $lockedMedicalRequest->retention_until->isPast()) {
                        throw new DomainException('Medical request retention has expired.');
                    }

                    $currentPolicy = app(MedicalAttachmentPolicy::class)->forUpload(
                        $actor, $lockedMedicalRequest, $reservation, lock: true,
                    );
                    if (! hash_equals($attachmentPolicy['revision'], $currentPolicy['revision'])) {
                        throw new DomainException('Attachment policy changed during upload. Reload before retrying.');
                    }

                    $retentionUntil = $lockedMedicalRequest->retention_until;
                }

                $file = new ReservationFile;
                $file->forceFill([
                    'public_id' => $publicId,
                    'reservation_id' => $reservation->getKey(),
                    'medical_request_id' => $lockedMedicalRequest?->getKey(),
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
                    action: $lockedMedicalRequest === null
                        ? 'reservation_file.uploaded'
                        : 'reservation_medical_file.uploaded',
                    subject: $file,
                    riskLevel: 'high',
                    before: null,
                    after: $lockedMedicalRequest === null
                        ? $this->snapshot($file)
                        : $this->medicalSnapshot($file, $lockedMedicalRequest) + [
                            'attachment_policy_revision' => $attachmentPolicy['issued_revision'],
                            'effective_attachment_policy_revision' => $attachmentPolicy['revision'],
                        ],
                );

                $this->scanQueue->enqueue($file);

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
        string $scannedChecksumSha256,
        ?MedicalScanVerdict $scannerVerdict = null,
    ): ReservationFile {
        if ($result === ReservationFileScanStatus::Quarantined) {
            throw new InvalidArgumentException('A completed scan cannot remain quarantined.');
        }

        if ($scannerVerdict !== null && ($scannerVerdict->status !== $result || ! hash_equals($scannedChecksumSha256, $scannerVerdict->checksumSha256))) {
            throw new InvalidArgumentException('Scanner evidence does not match the verdict.');
        }

        return DB::transaction(function () use ($request, $file, $result, $scannedChecksumSha256, $scannerVerdict): ReservationFile {
            $lockedFile = ReservationFile::query()->lockForUpdate()->findOrFail($file->getKey());

            if ($lockedFile->scan_status !== ReservationFileScanStatus::Quarantined || $lockedFile->trashed()) {
                throw new DomainException('Only an active quarantined file may receive a scan result.');
            }

            if (! preg_match('/^[a-f0-9]{64}$/D', $scannedChecksumSha256)
                || ! hash_equals((string) $lockedFile->checksum_sha256, $scannedChecksumSha256)) {
                throw new DomainException('Scan result does not match the uploaded file content.');
            }
            $contentFacts = [];
            if ($result === ReservationFileScanStatus::Clean) {
                $contentFacts = VerifiedPrivateFile::open($lockedFile)->useStream(
                    fn ($stream): array => $this->contentValidator->validate($stream, $lockedFile->mime_type),
                );
            }

            $before = $this->snapshot($lockedFile);
            $lockedFile->forceFill([
                'scan_status' => $result,
                'scanned_at' => now(),
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: null,
                action: $lockedFile->medical_request_id === null
                    ? 'reservation_file.scan_recorded'
                    : 'reservation_medical_file.scan_recorded',
                subject: $lockedFile,
                riskLevel: 'high',
                before: $lockedFile->medical_request_id === null
                    ? $before
                    : $this->medicalSnapshot($lockedFile),
                after: ($lockedFile->medical_request_id === null
                    ? $this->snapshot($lockedFile)
                    : $this->medicalSnapshot($lockedFile)) + ($scannerVerdict?->auditFacts() ?? []) + $contentFacts,
            );

            return $lockedFile->fresh();
        });
    }

    public function download(Request $request, User $actor, ReservationFile $file, bool $administrative = false): StreamedResponse
    {
        $file->refresh();
        if ($administrative) {
            if (! $actor->canAccessAdminPanel() || $file->medical_request_id === null
                || $file->medicalRequest?->reservation_id !== $file->reservation_id
                || ($file->medicalRequest?->retention_until !== null && ! $file->medicalRequest->retention_until->isFuture())) {
                throw new \Illuminate\Auth\Access\AuthorizationException;
            }
            if (! ReservationFile::query()->availableForMedicalReview()->whereKey($file->id)->exists()) {
                throw new DomainException('Private file is not available for download.');
            }
        } else {
            Gate::forUser($actor)->authorize('view', $file);
        }

        if ($file->trashed()
            || $file->scan_status !== ReservationFileScanStatus::Clean
            || ($file->retention_until !== null && $file->retention_until->isPast())) {
            throw new DomainException('Private file is not available for download.');
        }

        // Capture once, verify that copy, then serve it without reopening a mutable storage path.
        $snapshot = VerifiedPrivateFile::open($file);

        $this->auditLogger->log(
            request: $request,
            actor: $actor,
            action: $file->medical_request_id === null
                ? 'reservation_file.accessed'
                : 'reservation_medical_file.accessed',
            subject: $file,
            riskLevel: 'critical',
            before: null,
            after: $file->medical_request_id === null
                ? ['scan_status' => $file->scan_status->value]
                : $this->medicalSnapshot($file),
        );

        $response = new StreamedResponse(fn () => $snapshot->send());
        $response->headers->set('Content-Type', $file->mime_type);
        $response->headers->set('Content-Length', (string) $file->size_bytes);
        $response->headers->set('Content-Disposition', $response->headers->makeDisposition('attachment', $file->safe_filename));
        $response->headers->set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; sandbox; frame-ancestors 'none'");
        $response->headers->set('Referrer-Policy', 'no-referrer');

        return $response;
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
                action: $lockedFile->medical_request_id === null
                    ? 'reservation_file.archived'
                    : 'reservation_medical_file.archived',
                subject: $lockedFile,
                riskLevel: 'critical',
                before: $lockedFile->medical_request_id === null
                    ? $before
                    : $this->medicalSnapshot($lockedFile),
                after: $lockedFile->medical_request_id === null
                    ? $this->snapshot($lockedFile)
                    : $this->medicalSnapshot($lockedFile),
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
                $newFile = $file->medical_request_id === null
                    ? $this->upload(
                        $request,
                        $actor,
                        $file->reservation,
                        $replacement,
                        $label,
                        $retentionUntil,
                    )
                    : $this->uploadForMedicalRequest(
                        $request,
                        $actor,
                        ReservationMedicalRequest::query()->findOrFail($file->medical_request_id),
                        $replacement,
                        $label,
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

    /** @return array<string, mixed> */
    private function medicalSnapshot(
        ReservationFile $file,
        ?ReservationMedicalRequest $medicalRequest = null,
    ): array {
        $medicalRequest ??= $file->medicalRequest;

        return [
            'file_public_id' => $file->public_id,
            'request_public_id' => $medicalRequest?->public_id,
            'reservation_public_id' => $file->reservation?->public_id,
            'scan_status' => $file->scan_status->value,
            'scanned_at' => $file->scanned_at?->toISOString(),
            'retention_until' => $file->retention_until?->toISOString(),
            'archived_at' => $file->deleted_at?->toISOString(),
        ];
    }
}
