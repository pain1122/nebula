<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationReportResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'public_id' => (string) $this->public_id,
            'medical_request_public_id' => (string) $this->medicalRequest?->public_id,
            'status' => $this->status->value,
            'body' => $this->body,
            'body_format' => 'plain_text',
            'author_name' => $this->author_name_snapshot,
            'published_at' => $this->published_at?->toISOString(),
            'supersedes_report_public_id' => $this->supersedes?->public_id,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
