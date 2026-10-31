<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitQuestionnaireRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'answers' => ['required', 'array', 'min:1', 'max:100'],
            'answers.*' => ['array:question_id,choice_id'],
            'answers.*.question_id' => ['required', 'integer', 'distinct:strict'],
            'answers.*.choice_id' => ['required', 'integer', 'distinct:strict'],
            'submitter_name' => ['required', 'string', 'max:255'],
            'submitter_phone' => ['required', 'string', 'max:30'],
            'questionnaire_id' => ['prohibited'],
            'questionnaire_version' => ['prohibited'],
            'user_id' => ['prohibited'],
            'total_score' => ['prohibited'],
            'result_title' => ['prohibited'],
            'result_body_html' => ['prohibited'],
            'recommendation' => ['prohibited'],
        ];
    }
}
