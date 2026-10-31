<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationMedicalRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'public_id' => (string) $this->public_id,
            'reservation_public_id' => (string) $this->reservation?->public_id,
            'request_type' => $this->request_type,
            'title' => $this->title,
            'instructions' => $this->instructions,
            'status' => $this->status->value,
            'attachment_rules' => app(\App\Services\MedicalAttachmentPolicy::class)->describe($request->user(), $this->resource),
            'upload_progress' => $this->when(
                $request->user() !== null
                    && $request->user()->id === $this->reservation?->user_id
                    && isset($this->patient_received_count, $this->patient_awaiting_checks_count),
                fn (): array => [
                    'received_count' => (int) $this->patient_received_count,
                    'awaiting_checks_count' => (int) $this->patient_awaiting_checks_count,
                ],
            ),
            'due_at' => $this->due_at?->toISOString(),
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
