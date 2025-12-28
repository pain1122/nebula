<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCheckupRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->hasRole('admin'); }

    public function rules(): array {
        $id = $this->route('checkup')->id ?? null;
        return [
            'checkup_category_id' => ['required','exists:checkup_categories,id'],
            'title' => ['required','string','max:190'],
            'slug' => ['required','string','max:190', Rule::unique('checkups','slug')->ignore($id)],
            'description' => ['nullable','string','max:5000'],
            'price' => ['required','integer','min:0'],
        ];
    }
}
