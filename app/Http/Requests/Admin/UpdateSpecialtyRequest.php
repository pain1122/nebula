<?php
namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Enums\UserRole;

class UpdateSpecialtyRequest extends FormRequest
{
    public function authorize(): bool { return auth()->check() && auth()->user()->canAccessAdminPanel(); }

    public function rules(): array {
        $id = $this->route('specialty')->id ?? null;
        return [
            'name' => ['required','string','max:190', Rule::unique('specialties','name')->ignore($id)],
            'slug' => ['nullable','string','max:190', Rule::unique('specialties','slug')->ignore($id)],
            'parent_id' => ['nullable', Rule::exists('specialties','id')->whereNot('id',$id)],
        ];
    }
}
