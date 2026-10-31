<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateCheckupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('update', $this->route('checkup'));
    }

    public function rules(): array
    {
        $id = $this->route('checkup')->id ?? null;

        return [
            'checkup_category_id' => [
                'nullable',
                Rule::exists('checkup_categories', 'id')->whereNull('deleted_at'),
            ],
            'title' => ['required', 'string', 'max:190'],
            'slug' => ['required', 'string', 'max:190', Rule::unique('checkups', 'slug')->ignore($id)],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['required', 'string', 'size:3', 'uppercase', 'regex:/^[A-Z]{3}$/'],
            'default_duration_minutes' => ['required', 'integer', 'min:5', 'max:720'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
