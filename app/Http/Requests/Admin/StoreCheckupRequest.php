<?php

namespace App\Http\Requests\Admin;

use App\Models\Checkup;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreCheckupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return Gate::allows('create', Checkup::class);
    }

    public function rules(): array
    {
        return [
            'checkup_category_id' => [
                'required',
                Rule::exists('checkup_categories', 'id')->whereNull('deleted_at'),
            ],
            'title' => ['required', 'string', 'max:190'],
            'slug' => ['required', 'string', 'max:190', 'unique:checkups,slug'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['required', 'string', 'size:3', 'uppercase', 'regex:/^[A-Z]{3}$/'],
            'default_duration_minutes' => ['required', 'integer', 'min:5', 'max:720'],
            'reason' => ['required', 'string', 'max:1000'],
        ];
    }
}
