<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminMedicalRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $reservation = $this->reservation;

        return [
            'public_id' => (string) $this->public_id,
            'reservation' => ['id' => $reservation->id, 'public_id' => (string) $reservation->public_id],
            'patient' => ['id' => $reservation->user_id, 'name' => $reservation->user?->name],
            'doctor' => ['id' => $reservation->doctor_profile_id, 'name' => $reservation->doctor?->user?->name],
            'title' => $this->title,
            'instructions' => $this->instructions,
            'request_type' => $this->request_type,
            'status' => $this->status->value,
            'requested_by' => ['id' => $this->requested_by, 'name' => $this->requester?->name],
            'received_count' => (int) $this->files_count,
            'awaiting_checks_count' => (int) $this->awaiting_checks_count,
            'eligible_count' => ($this->retention_until === null || $this->retention_until->isFuture()) ? (int) $this->eligible_count : 0,
            'published_count' => (int) $this->published_count,
            'due_at' => $this->due_at?->toISOString(),
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'closed_at' => $this->closed_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'retention_until' => $this->retention_until?->toISOString(),
        ];
    }
}
