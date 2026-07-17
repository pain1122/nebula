<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCheckupRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->canAccessAdminPanel(); }

    public function rules(): array {
        return [
            'checkup_category_id' => [
                'required',
                Rule::exists('checkup_categories', 'id')->whereNull('deleted_at'),
            ],
            'title' => ['required','string','max:190'],
            'slug' => ['required','string','max:190','unique:checkups,slug'],
            'description' => ['nullable','string','max:5000'],
            'price' => ['required','integer','min:0'],
        ];
    }
}
