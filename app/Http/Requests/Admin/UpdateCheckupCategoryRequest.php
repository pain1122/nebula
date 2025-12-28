<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCheckupCategoryRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->hasRole('admin'); }

    public function rules(): array {
        $id = $this->route('checkup_category')->id ?? null;
        return [
            'name' => ['required','string','max:190'],
            'slug' => ['required','string','max:190', Rule::unique('checkup_categories','slug')->ignore($id)],
            'description' => ['nullable','string','max:2000'],
        ];
    }
}
