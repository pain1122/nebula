<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Enums\UserRole;

class UpdateCheckupCategoryRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->hasRole(UserRole::Admin->value); }

    public function rules(): array {
        $id = $this->route('checkup_category')->id ?? null;
        return [
            'name' => ['required','string','max:190'],
            'slug' => ['required','string','max:190', Rule::unique('checkup_categories','slug')->ignore($id)],
            'description' => ['nullable','string','max:2000'],
        ];
    }
}
