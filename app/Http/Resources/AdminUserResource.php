<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => (string) $this->public_id,
            'role' => $this->roles->pluck('name')->first(),
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'birth_date' => $this->birth_date?->format('Y-m-d'),
            'NID' => $this->NID,
            'city' => $this->city,
            'country' => $this->country,
            'zip_code' => $this->zip_code,
            'bio' => $this->bio,
            'patient_status' => $this->patient_status,
            'account_state' => $this->account_state?->value,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
