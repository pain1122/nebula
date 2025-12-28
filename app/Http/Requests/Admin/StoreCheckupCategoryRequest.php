<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCheckupCategoryRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->hasRole('admin'); }

    public function rules(): array {
        return [
            'name' => ['required','string','max:190'],
            'slug' => ['required','string','max:190','unique:checkup_categories,slug'],
            'description' => ['nullable','string','max:2000'],
        ];
    }
}
