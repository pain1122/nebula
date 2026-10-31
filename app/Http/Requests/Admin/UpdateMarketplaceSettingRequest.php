<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use App\Services\GeneralMarketplaceSettings;
use App\Services\UploadPolicySettings;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMarketplaceSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        $actor = $this->user() instanceof User ? User::with('roles')->find($this->user()->id) : null;

        return $actor !== null && $actor->permitsAuthentication() && $actor->isRootAdmin();
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        if (in_array((string) $this->route('settingKey'), GeneralMarketplaceSettings::KEYS, true)) {
            return [
                'scope_type' => ['required', \Illuminate\Validation\Rule::in(['platform', 'site'])],
                'scope_key' => ['required', 'string', 'max:191'],
                'operation' => ['sometimes', \Illuminate\Validation\Rule::in(['set', 'reset'])],
                'value' => $this->input('operation') === 'reset' ? ['prohibited'] : ['present'],
                'reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted'],
                'expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
            ];
        }

        return [
            'scope_type' => ['required', 'string'],
            'scope_key' => ['required', 'string', 'max:191'],
            'value' => ['present'],
            'reason' => ['required', 'string', 'max:1000'],
            'expected_revision' => [
                UploadPolicySettings::isSetting((string) $this->route('settingKey')) ? 'required' : 'nullable',
                'string', 'regex:/^[a-f0-9]{64}$/D',
            ],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (in_array((string) $this->route('settingKey'), GeneralMarketplaceSettings::KEYS, true)) {
            abort_if($this->query() !== [] || array_diff(array_keys($this->all()), [
                'scope_type', 'scope_key', 'operation', 'value', 'reason', 'confirmed', 'expected_revision',
            ]), 422, 'Unsupported setting fields.');
            abort_if($this->input('operation') === 'reset' && array_key_exists('value', $this->all()), 422, 'Reset takes no value.');
        }
    }
}
