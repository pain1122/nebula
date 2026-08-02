<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuestionnaireSubmissionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'public_id' => (string) $this->public_id,
            'questionnaire' => [
                'public_id' => $this->questionnaire?->public_id,
                'title' => $this->questionnaire_title,
                'slug' => $this->questionnaire_slug,
            ],
            'total_score' => $this->total_score,
            'result_title' => $this->result_title,
            'submitted_at' => $this->created_at?->toISOString(),
            'retention_until' => $this->retention_until?->toISOString(),
        ];
    }
}
