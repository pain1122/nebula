<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SetTenantFeatureOverrideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isRootAdmin() ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
