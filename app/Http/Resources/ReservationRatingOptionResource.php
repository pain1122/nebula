<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservationRatingOptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => (string) $this->public_id,
            'type' => $this->type,
            'label' => $this->label,
            'slug' => $this->slug,
            'description' => $this->description,
            'active' => (bool) $this->active,
            'sort_order' => $this->sort_order,
        ];
    }
}
