<?php

namespace App\Http\Requests\Doctor;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReservationMedicalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'request_type' => ['required', 'string', 'max:60', 'regex:/^[a-z][a-z0-9_]{1,59}$/'],
            'title' => ['required', 'string', 'max:255'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'due_at' => ['nullable', 'date', 'after:now'],
            'attachment_categories' => ['sometimes', 'required', 'array', 'list', 'min:1', 'max:4'],
            'attachment_categories.*' => ['required', 'string', 'distinct:strict', 'in:document,media,archive,multimedia'],
            'attachment_rules' => ['sometimes', Rule::prohibitedIf($this->has('attachment_categories')), 'array:max_bytes,allowed_mime_types'],
            'attachment_rules.max_bytes' => ['sometimes', 'required', 'integer', 'min:1'],
            'attachment_rules.allowed_mime_types' => ['sometimes', 'required', 'array', 'list', 'min:1'],
            'attachment_rules.allowed_mime_types.*' => ['required', 'string', 'distinct:strict'],
            'attachment_policy' => ['prohibited'],
            'attachment_policy_revision' => ['prohibited'],
            'public_id' => ['prohibited'],
            'reservation_id' => ['prohibited'],
            'requested_by' => ['prohibited'],
            'status' => ['prohibited'],
            'reviewed_at' => ['prohibited'],
            'closed_at' => ['prohibited'],
            'retention_until' => ['prohibited'],
            'archived_by' => ['prohibited'],
            'archive_reason' => ['prohibited'],
        ];
    }
}
