<?php

namespace App\Http\Requests\Doctor;

use Illuminate\Foundation\Http\FormRequest;

class SaveReservationReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $updating = $this->route('report') !== null;

        return [
            'body' => ['required', 'string', 'max:20000'],
            'supersedes_report_id' => $updating
                ? ['prohibited']
                : ['nullable', 'string', 'size:26'],
            'public_id' => ['prohibited'],
            'reservation_id' => ['prohibited'],
            'medical_request_id' => ['prohibited'],
            'author_user_id' => ['prohibited'],
            'author_name_snapshot' => ['prohibited'],
            'status' => ['prohibited'],
            'published_at' => ['prohibited'],
            'retention_until' => ['prohibited'],
            'archived_by' => ['prohibited'],
            'archive_reason' => ['prohibited'],
        ];
    }
}
