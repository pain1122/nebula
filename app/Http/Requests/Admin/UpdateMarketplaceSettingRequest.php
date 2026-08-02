<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMarketplaceSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isRootAdmin() ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'scope_type' => ['required', 'string'],
            'scope_key' => ['required', 'string', 'max:191'],
            'value' => ['present'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
