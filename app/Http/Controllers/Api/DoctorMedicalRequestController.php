<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Doctor\StoreReservationMedicalRequest;
use App\Http\Resources\ReservationMedicalFileResource;
use App\Http\Resources\ReservationMedicalRequestResource;
use App\Http\Resources\ReservationReportResource;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Services\MedicalAttachmentPolicy;
use App\Services\ReservationFileService;
use App\Services\ReservationMedicalRequestService;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DoctorMedicalRequestController extends ApiController
{
    public function attachmentOptions(Request $request, Reservation $reservation, MedicalAttachmentPolicy $policy): JsonResponse
    {
        if (! $this->isAssignedDoctor($request, $reservation)) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        return $this->successResponse(data: $policy->categories())
            ->header('Cache-Control', 'no-store, private');
    }

    public function index(Request $request, Reservation $reservation): JsonResponse
    {
        if (! $this->isAssignedDoctor($request, $reservation)) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        $medicalRequests = $reservation->medicalRequests()
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
        if (! $this->isAssignedDoctor($request, $reservation)
            || $medicalRequest->reservation_id !== $reservation->id) {
            return $this->errorResponse('Medical request not found.', 404);
        }

        $files = $medicalRequest->files()
            ->availableForMedicalReview()
            ->orderBy('id')
            ->get();
        $reports = $medicalRequest->reports()
            ->with([
                'medicalRequest:id,public_id',
                'supersedes:id,public_id',
            ])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return $this->successResponse(
            data: [
                'medical_request' => (new ReservationMedicalRequestResource(
                    $medicalRequest->setRelation('reservation', $reservation)
                ))->resolve($request),
                'files' => ReservationMedicalFileResource::collection($files)->resolve($request),
                'reports' => ReservationReportResource::collection($reports)->resolve($request),
            ],
            message: 'Reservation medical request.',
        );
    }

    public function store(
        StoreReservationMedicalRequest $request,
        Reservation $reservation,
        ReservationMedicalRequestService $service,
    ): JsonResponse {
        $doctorProfile = $request->user()->doctorProfile;

        if (! $doctorProfile || $reservation->doctor_profile_id !== $doctorProfile->id) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        $data = $request->validated();

        try {
            $medicalRequest = $service->create(
                request: $request,
                actor: $request->user(),
                reservation: $reservation,
                requestType: $data['request_type'],
                title: $data['title'],
                instructions: $data['instructions'] ?? null,
                dueAt: isset($data['due_at']) ? CarbonImmutable::parse($data['due_at']) : null,
                attachmentRules: isset($data['attachment_categories'])
                    ? app(MedicalAttachmentPolicy::class)->rulesForCategories($data['attachment_categories'])
                    : ($data['attachment_rules'] ?? []),
            );
        } catch (DomainException|InvalidArgumentException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['medical_request' => ['request_rejected']],
            );
        }

        return $this->successResponse(
            data: (new ReservationMedicalRequestResource(
                $medicalRequest->loadMissing('reservation:id,public_id')
            ))->resolve($request),
            message: 'Medical request created.',
            status: 201,
        );
    }

    public function review(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationMedicalRequestService $service,
    ): JsonResponse {
        if (! $this->isAssignedDoctor($request, $reservation)
            || $medicalRequest->reservation_id !== $reservation->id) {
            return $this->errorResponse('Medical request not found.', 404);
        }

        try {
            $medicalRequest = $service->startReview(
                $request,
                $request->user(),
                $medicalRequest,
            );
        } catch (DomainException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['medical_request' => ['review_rejected']],
            );
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
                'files' => ReservationMedicalFileResource::collection($files)->resolve($request),
            ],
            message: 'Medical request review started.',
        );
    }

    public function download(
        Request $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationFile $file,
        ReservationFileService $service,
    ): StreamedResponse|JsonResponse {
        if (! $this->isAssignedDoctor($request, $reservation)
            || $medicalRequest->reservation_id !== $reservation->id
            || $file->reservation_id !== $reservation->id
            || $file->medical_request_id !== $medicalRequest->id) {
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

    private function isAssignedDoctor(Request $request, Reservation $reservation): bool
    {
        $doctorProfile = $request->user()->doctorProfile;

        return $doctorProfile !== null && $reservation->doctor_profile_id === $doctorProfile->id;
    }
}
