<?php

namespace App\Http\Requests\Doctor;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check() && auth()->user()->hasRole(UserRole::Doctor->value);
    }

    public function rules(): array
    {
        return [
            'phone' => ['nullable', 'string', 'max:50'],
            'specialty_id' => [
                'nullable',
                Rule::exists('specialties', 'id'),
            ],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:80'],
            'fee' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'availability' => ['nullable', 'array'],
            'availability.*.day' => ['required_with:availability', 'in:sat,sun,mon,tue,wed,thu,fri'],
            'availability.*.windows' => ['required_with:availability', 'array'],
            'availability.*.windows.*' => ['array'],
            'availability.*.windows.*.checkup_id' => ['required', 'integer'],
            'availability.*.windows.*.start' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.end' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.duration_minutes' => ['required', 'integer', 'min:5', 'max:720'],
            'availability.*.windows.*.price_override' => ['nullable', 'integer', 'min:0'],
            'availability.*.windows.*.currency_override' => ['nullable', 'string', 'size:3'],
            'availability.*.windows.*.effective_from' => ['nullable', 'date_format:Y-m-d'],
            'availability.*.windows.*.effective_until' => ['nullable', 'date_format:Y-m-d'],
            'availability.*.windows.*.breaks' => ['nullable', 'array'],
            'availability.*.windows.*.breaks.*.start' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.breaks.*.end' => ['required', 'date_format:H:i'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('availability') && is_string($this->availability)) {
            $decoded = json_decode($this->availability, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $this->merge(['availability' => $decoded]);
            }
        }
    }
}
