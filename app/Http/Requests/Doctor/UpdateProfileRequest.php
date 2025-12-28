<?php

namespace App\Http\Requests\Doctor;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->hasRole('doctor'); }

    public function rules(): array {
        return [
          'phone' => ['nullable','string','max:50'],
          'specialty_id' => [
              'nullable',
              Rule::exists('specialties','id')
          ],
          'experience_years' => ['nullable','integer','min:0','max:80'],
          'fee' => ['nullable','integer','min:0','max:100000000'],
          'bio' => ['nullable','string','max:2000'],
          'availability' => ['nullable','array'],
          'availability.*.day' => ['required_with:availability','in:sat,sun,mon,tue,wed,thu,fri'],
          'availability.*.slots' => ['required_with:availability','array'],
          'availability.*.slots.*' => ['array','size:2'],
          'availability.*.slots.*.*' => ['date_format:H:i'],
        ];
    }

    protected function prepareForValidation(): void {
        if ($this->has('availability') && is_string($this->availability)) {
            $decoded = json_decode($this->availability, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $this->merge(['availability' => $decoded]);
            }
        }
    }
}
