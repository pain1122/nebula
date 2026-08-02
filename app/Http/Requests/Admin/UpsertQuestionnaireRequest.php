<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpsertQuestionnaireRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canAccessAdminPanel() ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('questionnaires', 'slug')->ignore($this->route('questionnaire')),
            ],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'cover_image_url' => ['nullable', 'string', 'max:1024'],
            'content_html' => ['nullable', 'string'],
            'reason' => ['required', 'string', 'max:1000'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*' => ['array:text,sort_order,choices'],
            'questions.*.text' => ['required', 'string'],
            'questions.*.sort_order' => ['nullable', 'integer'],
            'questions.*.choices' => ['required', 'array', 'min:1'],
            'questions.*.choices.*' => ['array:text,score,sort_order'],
            'questions.*.choices.*.text' => ['required', 'string'],
            'questions.*.choices.*.score' => ['required', 'integer'],
            'questions.*.choices.*.sort_order' => ['nullable', 'integer'],
            'recommendations' => ['nullable', 'array'],
            'recommendations.*' => ['array:min_score,max_score,title,body_html,priority,conditions'],
            'recommendations.*.min_score' => ['required_with:recommendations', 'integer'],
            'recommendations.*.max_score' => ['required_with:recommendations', 'integer'],
            'recommendations.*.title' => ['required_with:recommendations', 'string', 'max:255'],
            'recommendations.*.body_html' => ['nullable', 'string'],
            'recommendations.*.priority' => ['nullable', 'integer'],
            'recommendations.*.conditions' => ['nullable', 'array'],
        ];
    }
}
