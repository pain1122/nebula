<?php

namespace App\Http\Requests;

use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Services\MedicalAttachmentPolicy;
use DomainException;
use Illuminate\Foundation\Http\FormRequest;

class UploadReservationMedicalFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        $reservation = $this->route('reservation');
        $medicalRequest = $this->route('medicalRequest');
        abort_unless($reservation instanceof Reservation && $medicalRequest instanceof ReservationMedicalRequest
            && $medicalRequest->reservation_id === $reservation->getKey()
            && $reservation->user_id === $this->user()?->getKey(), 404);

        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        try {
            $resolved = app(MedicalAttachmentPolicy::class)->forUpload(
                $this->user(), $this->route('medicalRequest'), $this->route('reservation'),
            );
        } catch (DomainException) {
            throw \Illuminate\Validation\ValidationException::withMessages(['file' => 'upload_rejected']);
        }

        return [
            'file' => $resolved['policy']->fileRules(),
            'attachment_rules' => ['prohibited'],
            'attachment_policy' => ['prohibited'],
            'attachment_policy_revision' => ['prohibited'],
            'section' => ['prohibited'],
            'label' => ['nullable', 'string', 'max:255'],
            'public_id' => ['prohibited'],
            'reservation_id' => ['prohibited'],
            'medical_request_id' => ['prohibited'],
            'uploaded_by' => ['prohibited'],
            'disk' => ['prohibited'],
            'path' => ['prohibited'],
            'original_filename' => ['prohibited'],
            'safe_filename' => ['prohibited'],
            'mime_type' => ['prohibited'],
            'extension' => ['prohibited'],
            'size_bytes' => ['prohibited'],
            'checksum_sha256' => ['prohibited'],
            'classification' => ['prohibited'],
            'scan_status' => ['prohibited'],
            'scanned_at' => ['prohibited'],
            'retention_until' => ['prohibited'],
            'archived_by' => ['prohibited'],
            'archive_reason' => ['prohibited'],
        ];
    }
}
