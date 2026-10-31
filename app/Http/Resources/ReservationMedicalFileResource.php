<?php

namespace App\Http\Resources;

use App\Enums\ReservationFileScanStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationMedicalFileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'public_id' => (string) $this->public_id,
            'label' => $this->label,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'available' => ! $this->trashed()
                && $this->scan_status === ReservationFileScanStatus::Clean
                && ($this->retention_until === null || $this->retention_until->isFuture()),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
