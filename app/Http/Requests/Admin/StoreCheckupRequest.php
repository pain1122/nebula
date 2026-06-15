<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;

class StoreCheckupRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->canAccessAdminPanel(); }

    public function rules(): array {
        return [
            'checkup_category_id' => ['required','exists:checkup_categories,id'],
            'title' => ['required','string','max:190'],
            'slug' => ['required','string','max:190','unique:checkups,slug'],
            'description' => ['nullable','string','max:5000'],
            'price' => ['required','integer','min:0'],
        ];
    }
}
