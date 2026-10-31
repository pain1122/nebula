<?php

namespace App\Services;

use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;
use App\Support\AdminClinicalScope;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use InvalidArgumentException;

class ReservationReportService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function saveDraft(
        Request $request,
        User $actor,
        ReservationMedicalRequest $medicalRequest,
        string $body,
        ?ReservationReport $draft = null,
        ?ReservationReport $supersedes = null,
        ?string $administrativeReason = null,
    ): ReservationReport {
        $administrative = AdminClinicalScope::authorize($actor, $administrativeReason);
        if ($draft !== null && $supersedes !== null) {
            throw new InvalidArgumentException('A draft update cannot replace its predecessor reference.');
        }

        if (! $administrative) {
            if ($draft === null) {
                Gate::forUser($actor)->authorize('create', [ReservationReport::class, $medicalRequest]);
            } else {
                Gate::forUser($actor)->authorize('update', $draft);
            }
        }

        $body = trim($body);

        if ($body === '' || mb_strlen($body) > 20_000) {
            throw new InvalidArgumentException('The reservation report body is invalid.');
        }

        return DB::transaction(function () use (
            $request,
            $actor,
            $medicalRequest,
            $body,
            $draft,
            $supersedes,
            $administrative,
            $administrativeReason,
        ): ReservationReport {
            $lockedRequest = ReservationMedicalRequest::query()
                ->with('reservation.doctor:id,user_id')
                ->lockForUpdate()
                ->findOrFail($medicalRequest->getKey());

            if (! $administrative) {
                $this->assertAssignedDoctor($lockedRequest, $actor);
            }

            if ($lockedRequest->retention_until !== null && $lockedRequest->retention_until->isPast()) {
                throw new DomainException('Medical request retention has expired.');
            }

            $lockedDraft = null;
            $lockedPredecessor = null;

            if ($draft !== null) {
                $lockedDraft = ReservationReport::query()
                    ->lockForUpdate()
                    ->findOrFail($draft->getKey());

                if ($lockedDraft->medical_request_id !== $lockedRequest->id
                    || $lockedDraft->reservation_id !== $lockedRequest->reservation_id
                    || $lockedDraft->status !== ReservationReportStatus::Draft
                    || $lockedDraft->author_user_id !== $actor->id) {
                    throw new DomainException('Only the assigned doctor may update this draft report.');
                }
            } elseif ($supersedes !== null) {
                $lockedPredecessor = ReservationReport::query()
                    ->lockForUpdate()
                    ->findOrFail($supersedes->getKey());

                if ($lockedRequest->status !== ReservationMedicalRequestStatus::Completed
                    || $lockedPredecessor->medical_request_id !== $lockedRequest->id
                    || $lockedPredecessor->reservation_id !== $lockedRequest->reservation_id
                    || $lockedPredecessor->status !== ReservationReportStatus::Published) {
                    throw new DomainException('An amendment requires a published report from the same request.');
                }

                $successorExists = ReservationReport::query()
                    ->where('supersedes_report_id', $lockedPredecessor->id)
                    ->lockForUpdate()
                    ->exists();

                if ($successorExists) {
                    throw new DomainException('This report already has an active amendment.');
                }
            } else {
                if ($lockedRequest->status !== ReservationMedicalRequestStatus::InReview) {
                    throw new DomainException('An original report draft requires a request in review.');
                }

                $originalExists = ReservationReport::query()
                    ->where('medical_request_id', $lockedRequest->id)
                    ->whereNull('supersedes_report_id')
                    ->lockForUpdate()
                    ->exists();

                if ($originalExists) {
                    throw new DomainException('This medical request already has an original report.');
                }
            }

            $before = $lockedDraft === null
                ? null
                : $this->snapshot($lockedDraft, $lockedRequest);
            $report = $lockedDraft ?? new ReservationReport;
            $report->forceFill([
                'reservation_id' => $lockedRequest->reservation_id,
                'medical_request_id' => $lockedRequest->id,
                'author_user_id' => $actor->id,
                'author_name_snapshot' => $actor->name,
                'status' => ReservationReportStatus::Draft,
                'body' => $body,
                'published_at' => null,
                'supersedes_report_id' => $lockedDraft?->supersedes_report_id
                    ?? $lockedPredecessor?->id,
                'retention_until' => $lockedRequest->retention_until,
            ])->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: $administrative ? 'admin.medical_report.draft_saved' : 'reservation_report.draft_saved',
                subject: $report,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($report, $lockedRequest),
                reason: $administrativeReason,
            );

            return $report->fresh();
        });
    }

    public function publish(
        Request $request,
        User $actor,
        ReservationReport $report,
        ?string $administrativeReason = null,
    ): ReservationReport {
        $administrative = AdminClinicalScope::authorize($actor, $administrativeReason);
        if (! $administrative) {
            Gate::forUser($actor)->authorize('publish', $report);
        }

        return DB::transaction(function () use ($request, $actor, $report, $administrative, $administrativeReason): ReservationReport {
            $lockedReport = ReservationReport::query()
                ->lockForUpdate()
                ->findOrFail($report->getKey());
            $lockedRequest = ReservationMedicalRequest::query()
                ->with('reservation.doctor:id,user_id')
                ->lockForUpdate()
                ->findOrFail($lockedReport->medical_request_id);

            if (! $administrative) {
                $this->assertAssignedDoctor($lockedRequest, $actor);
            }

            if ($lockedReport->status === ReservationReportStatus::Published) {
                return $lockedReport;
            }

            if ($lockedReport->status !== ReservationReportStatus::Draft
                || $lockedReport->author_user_id !== $actor->id
                || $lockedReport->reservation_id !== $lockedRequest->reservation_id) {
                throw new DomainException('Only the assigned doctor may publish this draft report.');
            }

            if ($lockedRequest->retention_until !== null && $lockedRequest->retention_until->isPast()) {
                throw new DomainException('Medical request retention has expired.');
            }

            $availableFiles = $lockedRequest->files()
                ->availableForMedicalReview()
                ->lockForUpdate()
                ->get();

            if ($availableFiles->isEmpty()) {
                throw new DomainException('A report requires at least one clean active retained file.');
            }

            if ($lockedReport->supersedes_report_id === null) {
                if ($lockedRequest->status !== ReservationMedicalRequestStatus::InReview) {
                    throw new DomainException('An original report requires a request in review.');
                }
            } else {
                if ($lockedRequest->status !== ReservationMedicalRequestStatus::Completed) {
                    throw new DomainException('An amendment requires a completed medical request.');
                }

                $predecessor = ReservationReport::query()
                    ->lockForUpdate()
                    ->findOrFail($lockedReport->supersedes_report_id);

                if ($predecessor->status !== ReservationReportStatus::Published
                    || $predecessor->medical_request_id !== $lockedRequest->id
                    || $predecessor->reservation_id !== $lockedRequest->reservation_id) {
                    throw new DomainException('The amendment predecessor is invalid.');
                }
            }

            $before = $this->snapshot($lockedReport, $lockedRequest);
            $publishedAt = now();
            $lockedReport->forceFill([
                'status' => ReservationReportStatus::Published,
                'published_at' => $publishedAt,
            ])->save();

            if ($lockedReport->supersedes_report_id === null) {
                $lockedRequest->forceFill([
                    'status' => ReservationMedicalRequestStatus::Completed,
                    'closed_at' => $publishedAt,
                ])->save();
            }

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: $administrative ? 'admin.medical_report.published' : 'reservation_report.published',
                subject: $lockedReport,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($lockedReport, $lockedRequest),
                reason: $administrativeReason,
            );

            return $lockedReport->fresh();
        });
    }

    private function assertAssignedDoctor(
        ReservationMedicalRequest $medicalRequest,
        User $actor,
    ): void {
        if ($medicalRequest->reservation?->doctor?->user_id !== $actor->id) {
            throw new DomainException('Only the assigned doctor may manage this reservation report.');
        }
    }

    /** @return array<string, mixed> */
    private function snapshot(
        ReservationReport $report,
        ReservationMedicalRequest $medicalRequest,
    ): array {
        return [
            'report_public_id' => $report->public_id,
            'request_public_id' => $medicalRequest->public_id,
            'reservation_public_id' => $medicalRequest->reservation?->public_id,
            'status' => $report->status->value,
            'published_at' => $report->published_at?->toISOString(),
            'supersedes_report_public_id' => $report->supersedes?->public_id,
            'request_status' => $medicalRequest->status->value,
            'request_closed_at' => $medicalRequest->closed_at?->toISOString(),
            'retention_until' => $report->retention_until?->toISOString(),
        ];
    }
}
