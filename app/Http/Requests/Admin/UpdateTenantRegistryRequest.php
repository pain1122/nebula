<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTenantRegistryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isRootAdmin() ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'changes' => [
                'required',
                'array:display_name,domain,state,plan_key,subscription_status,feature_set_version',
                'min:1',
            ],
            'changes.display_name' => ['sometimes', 'required', 'string', 'max:255'],
            'changes.domain' => ['sometimes', 'required', 'string', 'max:191'],
            'changes.state' => ['sometimes', 'required', 'string'],
            'changes.plan_key' => ['sometimes', 'nullable', 'string', 'max:100'],
            'changes.subscription_status' => ['sometimes', 'nullable', 'string'],
            'changes.feature_set_version' => ['sometimes', 'nullable', 'string', 'max:100'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
