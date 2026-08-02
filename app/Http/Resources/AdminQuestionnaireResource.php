<?php

namespace App\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminQuestionnaireResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => (string) $this->public_id,
            'title' => $this->title,
            'slug' => $this->slug,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'cover_image_url' => $this->cover_image_url,
            'content_html' => $this->content_html,
            'version' => $this->version,
            'published_at' => $this->published_at?->toISOString(),
            'questions_count' => $this->whenCounted('questions'),
            'questions' => $this->whenLoaded('questions', fn () => $this->questions->map(fn ($question) => [
                'id' => $question->id,
                'public_id' => (string) $question->public_id,
                'text' => $question->text,
                'sort_order' => $question->sort_order,
                'choices' => $question->relationLoaded('choices')
                    ? $question->choices->map(fn ($choice) => [
                        'id' => $choice->id,
                        'public_id' => (string) $choice->public_id,
                        'text' => $choice->text,
                        'score' => $choice->score,
                        'sort_order' => $choice->sort_order,
                    ])->values()
                    : [],
            ])->values()),
            'recommendations' => $this->whenLoaded('recommendations', fn () => $this->recommendations->map(fn ($recommendation) => [
                'id' => $recommendation->id,
                'public_id' => (string) $recommendation->public_id,
                'min_score' => $recommendation->min_score,
                'max_score' => $recommendation->max_score,
                'title' => $recommendation->title,
                'body_html' => $recommendation->body_html,
                'priority' => $recommendation->priority,
                'conditions' => $recommendation->conditions,
            ])->values()),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
