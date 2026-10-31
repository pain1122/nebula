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
            // Retain nullable wire keys for older clients, never their private values.
            'email' => null,
            'phone' => null,
            'birth_date' => null,
            'NID' => null,
            'city' => null,
            'country' => null,
            'zip_code' => null,
            'bio' => null,
            'patient_status' => $this->patient_status,
            'account_state' => $this->account_state?->value,
            'created_at' => $this->created_at?->toISOString(),
            // Directory metadata only; never serialize the profile model or contact fields.
            'doctor_profile' => $this->relationLoaded('doctorProfile') && $this->hasRole('doctor') && $this->doctorProfile ? [
                'id' => $this->doctorProfile->id,
                'verified' => (bool) $this->doctorProfile->verified,
                'specialty' => $this->doctorProfile->specialty?->name,
                'active_workplaces_count' => (int) $this->doctorProfile->active_workplaces_count,
            ] : null,
        ];
    }
}
