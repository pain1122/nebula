<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\UploadReservationMedicalFileRequest;
use App\Http\Resources\ReservationMedicalFileResource;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Services\ReservationFileService;
use DomainException;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

class PatientMedicalFileController extends ApiController
{
    public function store(
        UploadReservationMedicalFileRequest $request,
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationFileService $service,
    ): JsonResponse {
        if ($reservation->user_id !== $request->user()->id
            || $medicalRequest->reservation_id !== $reservation->id) {
            return $this->errorResponse('Medical request not found.', 404);
        }

        try {
            $file = $service->uploadForMedicalRequest(
                request: $request,
                actor: $request->user(),
                medicalRequest: $medicalRequest,
                upload: $request->file('file'),
                label: $request->validated('label'),
            );
        } catch (DomainException|InvalidArgumentException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['file' => ['upload_rejected']],
            );
        }

        return $this->successResponse(
            data: (new ReservationMedicalFileResource($file))->resolve($request),
            message: 'Medical file uploaded and awaiting safety review.',
            status: 201,
        );
    }
}
