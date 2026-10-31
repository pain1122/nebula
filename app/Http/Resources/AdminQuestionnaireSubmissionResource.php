<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class AdminQuestionnaireSubmissionResource extends QuestionnaireSubmissionResource
{
    public function toArray(Request $request): array
    {
        $retained = $this->retention_until === null || $this->retention_until->isFuture();

        return parent::toArray($request) + [
            'questionnaire_id' => $this->questionnaire_id,
            'questionnaire_version' => $this->questionnaire_version,
            'user_id' => $this->user_id,
            'owner_type' => $this->user_id === null ? 'guest' : 'account',
            'submitter_name' => $this->submitter_name,
            'submitter_phone' => null,
            'answers_available' => $this->when($request->route('submission') !== null, $retained),
            'answers' => $this->when($request->route('submission') !== null, fn () => collect($retained ? $this->answers_json : [])->map(fn ($answer) => [
                'question_text' => $answer['question_text'] ?? null,
                'choice_text' => $answer['choice_text'] ?? null,
                'score' => $answer['score'] ?? null,
            ])->values()),
            // Rich text is presented as text by the admin client; never expose token/meta internals.
            'result_body_html' => $this->when($request->route('submission') !== null, $retained ? $this->result_body_html : null),
        ];
    }
}
