<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Doctor\SaveReservationReportRequest;
use App\Http\Resources\ReservationReportResource;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Services\ReservationReportService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class DoctorReservationReportController extends ApiController
{
    public function store(
        SaveReservationReportRequest $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationReportService $service,
    ): JsonResponse {
        if (! $this->isOwnedRequest($request, $reservation, $medicalRequest)) {
            return $this->errorResponse('Medical request not found.', 404);
        }

        $data = $request->validated();
        $supersedes = null;

        if (isset($data['supersedes_report_id'])) {
            $supersedes = ReservationReport::query()
                ->where('public_id', $data['supersedes_report_id'])
                ->where('reservation_id', $reservation->id)
                ->where('medical_request_id', $medicalRequest->id)
                ->first();

            if (! $supersedes) {
                return $this->errorResponse('Report not found.', 404);
            }
        }

        try {
            $report = $service->saveDraft(
                request: $request,
                actor: $request->user(),
                medicalRequest: $medicalRequest,
                body: $data['body'],
                supersedes: $supersedes,
            );
        } catch (DomainException|InvalidArgumentException $exception) {
            return $this->reportError($exception);
        }

        return $this->successResponse(
            data: $this->resource($request, $report),
            message: 'Reservation report draft saved.',
            status: 201,
        );
    }

    public function update(
        SaveReservationReportRequest $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationReport $report,
        ReservationReportService $service,
    ): JsonResponse {
        if (! $this->isOwnedReport($request, $reservation, $medicalRequest, $report)) {
            return $this->errorResponse('Report not found.', 404);
        }

        try {
            $report = $service->saveDraft(
                request: $request,
                actor: $request->user(),
                medicalRequest: $medicalRequest,
                body: $request->validated('body'),
                draft: $report,
            );
        } catch (DomainException|InvalidArgumentException $exception) {
            return $this->reportError($exception);
        }

        return $this->successResponse(
            data: $this->resource($request, $report),
            message: 'Reservation report draft updated.',
        );
    }

    public function publish(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationReport $report,
        ReservationReportService $service,
    ): JsonResponse {
        if (! $this->isOwnedReport($request, $reservation, $medicalRequest, $report)) {
            return $this->errorResponse('Report not found.', 404);
        }

        $request->validate([
            'body' => ['prohibited'],
            'status' => ['prohibited'],
            'published_at' => ['prohibited'],
            'author_user_id' => ['prohibited'],
            'supersedes_report_id' => ['prohibited'],
            'retention_until' => ['prohibited'],
        ]);

        try {
            $report = $service->publish($request, $request->user(), $report);
        } catch (DomainException $exception) {
            return $this->reportError($exception);
        }

        return $this->successResponse(
            data: $this->resource($request, $report),
            message: 'Reservation report published.',
        );
    }

    private function isOwnedRequest(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): bool {
        $doctorProfile = $request->user()->doctorProfile;

        return $doctorProfile !== null
            && $reservation->doctor_profile_id === $doctorProfile->id
            && $medicalRequest->reservation_id === $reservation->id;
    }

    private function isOwnedReport(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationReport $report,
    ): bool {
        return $this->isOwnedRequest($request, $reservation, $medicalRequest)
            && $report->reservation_id === $reservation->id
            && $report->medical_request_id === $medicalRequest->id;
    }

    /** @return array<string, mixed> */
    private function resource(Request $request, ReservationReport $report): array
    {
        return (new ReservationReportResource($report->loadMissing([
            'medicalRequest:id,public_id',
            'supersedes:id,public_id',
        ])))->resolve($request);
    }

    private function reportError(DomainException|InvalidArgumentException $exception): JsonResponse
    {
        return $this->errorResponse(
            message: $exception->getMessage(),
            status: 422,
            errors: ['report' => ['report_rejected']],
        );
    }
}
