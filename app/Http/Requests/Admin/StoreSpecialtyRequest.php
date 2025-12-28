<?php
namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSpecialtyRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->hasRole('admin'); }

    public function rules(): array {
        return [
            'name' => ['required','string','max:190','unique:specialties,name'],
            'slug' => ['nullable','string','max:190','unique:specialties,slug'],
            'parent_id' => ['nullable', Rule::exists('specialties','id')],
        ];
    }
}
