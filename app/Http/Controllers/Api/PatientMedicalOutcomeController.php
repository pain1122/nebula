<?php

namespace App\Http\Controllers\Api;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Http\Resources\ReservationMedicalFileResource;
use App\Http\Resources\ReservationMedicalRequestResource;
use App\Http\Resources\ReservationReportResource;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Services\ReservationFileService;
use DomainException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PatientMedicalOutcomeController extends ApiController
{
    public function index(Request $request, Reservation $reservation): JsonResponse
    {
        if ($reservation->user_id !== $request->user()->id) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        // Receipt counts disclose no unsafe file identities or eligibility verdicts.
        $ownedFiles = static function (Builder $files) use ($request, $reservation): void {
            $files->where('reservation_id', $reservation->id)
                ->where('uploaded_by', $request->user()->id)
                ->where('disk', 'private')
                ->where('classification', 'medical')
                ->where(function (Builder $retention): void {
                    $retention->whereNull('retention_until')->orWhere('retention_until', '>', now());
                });
        };
        $medicalRequests = $reservation->medicalRequests()
            ->withCount([
                'files as patient_received_count' => $ownedFiles,
                'files as patient_awaiting_checks_count' => static function (Builder $files) use ($ownedFiles): void {
                    $ownedFiles($files);
                    $files->where('scan_status', ReservationFileScanStatus::Quarantined->value);
                },
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->each->setRelation('reservation', $reservation);

        return $this->successResponse(
            data: ReservationMedicalRequestResource::collection($medicalRequests)->resolve($request),
            message: 'Reservation medical requests.',
        );
    }

    public function show(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): JsonResponse {
        if (! $this->isOwnedRequest($request, $reservation, $medicalRequest)) {
            return $this->errorResponse('Medical outcome not found.', 404);
        }

        Gate::forUser($request->user())->authorize('view', $medicalRequest);
        $reports = $this->publishedReports($medicalRequest);

        if ($medicalRequest->status !== ReservationMedicalRequestStatus::Completed
            || $reports->isEmpty()) {
            return $this->errorResponse('Medical outcome not found.', 404);
        }

        $files = $medicalRequest->files()
            ->availableForMedicalReview()
            ->orderBy('id')
            ->get();

        return $this->successResponse(
            data: [
                'medical_request' => (new ReservationMedicalRequestResource(
                    $medicalRequest->loadMissing('reservation:id,public_id')
                ))->resolve($request),
                'latest_report' => (new ReservationReportResource($reports->last()))->resolve($request),
                'report_history' => ReservationReportResource::collection($reports)->resolve($request),
                'files' => ReservationMedicalFileResource::collection($files)->resolve($request),
            ],
            message: 'Published medical outcome.',
        );
    }

    public function download(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationFile $file,
        ReservationFileService $service,
    ): StreamedResponse|JsonResponse {
        if (! $this->isOwnedRequest($request, $reservation, $medicalRequest)
            || $file->reservation_id !== $reservation->id
            || $file->medical_request_id !== $medicalRequest->id) {
            return $this->errorResponse('Medical file not found.', 404);
        }

        Gate::forUser($request->user())->authorize('view', $file);

        if ($medicalRequest->status !== ReservationMedicalRequestStatus::Completed
            || $this->publishedReports($medicalRequest)->isEmpty()) {
            return $this->errorResponse('Medical file not found.', 404);
        }

        try {
            return $service->download($request, $request->user(), $file);
        } catch (DomainException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['file' => ['file_unavailable']],
            );
        }
    }

    private function isOwnedRequest(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): bool {
        return $reservation->user_id === $request->user()->id
            && $medicalRequest->reservation_id === $reservation->id;
    }

    /** @return Collection<int, ReservationReport> */
    private function publishedReports(ReservationMedicalRequest $medicalRequest): Collection
    {
        return $medicalRequest->reports()
            ->where('status', ReservationReportStatus::Published->value)
            ->where(function ($retention): void {
                $retention
                    ->whereNull('retention_until')
                    ->orWhere('retention_until', '>', now());
            })
            ->with([
                'medicalRequest:id,public_id',
                'supersedes:id,public_id',
            ])
            ->orderBy('published_at')
            ->orderBy('id')
            ->get();
    }
}
