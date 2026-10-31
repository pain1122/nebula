<?php

namespace App\Services;

use App\Enums\ReservationMedicalRequestStatus;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Support\AdminClinicalScope;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class ReservationMedicalRequestService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function create(
        Request $request,
        User $actor,
        Reservation $reservation,
        string $requestType,
        string $title,
        ?string $instructions = null,
        ?DateTimeInterface $dueAt = null,
        array $attachmentRules = [],
        ?string $administrativeReason = null,
    ): ReservationMedicalRequest {
        $administrative = AdminClinicalScope::authorize($actor, $administrativeReason);
        if (! $administrative) {
            Gate::forUser($actor)->authorize('create', [ReservationMedicalRequest::class, $reservation]);
        }
        app(MedicalAttachmentPolicy::class)->assertSchemaReady();

        $requestType = trim($requestType);
        $title = trim($title);
        $instructions = $instructions === null ? null : trim($instructions);

        if (! preg_match('/^[a-z][a-z0-9_]{1,59}$/', $requestType)) {
            throw new InvalidArgumentException('The medical request type is invalid.');
        }

        if ($title === '' || mb_strlen($title) > 255) {
            throw new InvalidArgumentException('The medical request title is invalid.');
        }

        if ($instructions !== null && mb_strlen($instructions) > 5000) {
            throw new InvalidArgumentException('The medical request instructions are too long.');
        }

        $dueAt = $dueAt === null ? null : CarbonImmutable::instance($dueAt);

        if ($dueAt !== null && $dueAt->isPast()) {
            throw new InvalidArgumentException('The medical request due time must be in the future.');
        }

        return DB::transaction(function () use (
            $request,
            $actor,
            $reservation,
            $requestType,
            $title,
            $instructions,
            $dueAt,
            $attachmentRules,
            $administrative,
            $administrativeReason,
        ): ReservationMedicalRequest {
            $lockedReservation = Reservation::query()
                ->with('doctor:id,user_id')
                ->lockForUpdate()
                ->findOrFail($reservation->getKey());

            if (! $administrative && $lockedReservation->doctor?->user_id !== $actor->getKey()) {
                throw new DomainException('Only the assigned doctor may create a medical request.');
            }

            if (! in_array($lockedReservation->status, [
                ReservationStatus::Confirmed,
                ReservationStatus::Completed,
            ], true)) {
                throw new DomainException('Medical requests require a confirmed or completed reservation.');
            }

            $retentionDays = max(1, (int) config('medical.records_retention_days', 365));
            $attachmentPolicy = app(MedicalAttachmentPolicy::class)->issue($attachmentRules);
            $medicalRequest = new ReservationMedicalRequest;
            $medicalRequest->forceFill([
                'reservation_id' => $lockedReservation->getKey(),
                'requested_by' => $actor->getKey(),
                'request_type' => $requestType,
                'title' => $title,
                'instructions' => $instructions === '' ? null : $instructions,
                'attachment_policy' => $attachmentPolicy['snapshot'],
                'attachment_policy_revision' => $attachmentPolicy['revision'],
                'status' => ReservationMedicalRequestStatus::Open,
                'due_at' => $dueAt,
                'retention_until' => now()->addDays($retentionDays),
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: $administrative ? 'admin.medical_request.created' : 'reservation_medical_request.created',
                subject: $medicalRequest,
                riskLevel: 'critical',
                before: null,
                after: $this->snapshot($medicalRequest, $lockedReservation),
                reason: $administrativeReason,
            );

            return $medicalRequest->fresh();
        });
    }

    public function startReview(
        Request $request,
        User $actor,
        ReservationMedicalRequest $medicalRequest,
        ?string $administrativeReason = null,
    ): ReservationMedicalRequest {
        $administrative = AdminClinicalScope::authorize($actor, $administrativeReason);
        if (! $administrative) {
            Gate::forUser($actor)->authorize('review', $medicalRequest);
        }

        return DB::transaction(function () use ($request, $actor, $medicalRequest, $administrative, $administrativeReason): ReservationMedicalRequest {
            $lockedRequest = ReservationMedicalRequest::query()
                ->with('reservation.doctor:id,user_id')
                ->lockForUpdate()
                ->findOrFail($medicalRequest->getKey());

            if (! $administrative && $lockedRequest->reservation?->doctor?->user_id !== $actor->getKey()) {
                throw new DomainException('Only the assigned doctor may review this medical request.');
            }

            if ($lockedRequest->status === ReservationMedicalRequestStatus::InReview) {
                return $lockedRequest;
            }

            if ($lockedRequest->status !== ReservationMedicalRequestStatus::Open) {
                throw new DomainException('Only an open medical request may enter review.');
            }

            if ($lockedRequest->retention_until !== null && $lockedRequest->retention_until->isPast()) {
                throw new DomainException('Medical request retention has expired.');
            }

            $availableFiles = $lockedRequest->files()
                ->availableForMedicalReview()
                ->lockForUpdate()
                ->get();

            if ($availableFiles->isEmpty()) {
                throw new DomainException('No clean active retained file is available for review.');
            }

            $before = $this->snapshot($lockedRequest, $lockedRequest->reservation);
            $lockedRequest->forceFill([
                'status' => ReservationMedicalRequestStatus::InReview,
                'reviewed_at' => now(),
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: $administrative ? 'admin.medical_request.review_started' : 'reservation_medical_request.review_started',
                subject: $lockedRequest,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($lockedRequest, $lockedRequest->reservation),
                reason: $administrativeReason,
            );

            return $lockedRequest->fresh();
        });
    }

    /** @return array<string, mixed> */
    private function snapshot(
        ReservationMedicalRequest $medicalRequest,
        Reservation $reservation,
    ): array {
        return [
            'request_public_id' => $medicalRequest->public_id,
            'reservation_public_id' => $reservation->public_id,
            'status' => $medicalRequest->status->value,
            'attachment_policy_revision' => $medicalRequest->attachment_policy_revision,
            'due_at' => $medicalRequest->due_at?->toISOString(),
            'reviewed_at' => $medicalRequest->reviewed_at?->toISOString(),
            'closed_at' => $medicalRequest->closed_at?->toISOString(),
            'retention_until' => $medicalRequest->retention_until?->toISOString(),
        ];
    }
}
