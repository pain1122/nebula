<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\User;

class ReservationMedicalRequestPolicy
{
    public function create(User $user, Reservation $reservation): bool
    {
        return $reservation->doctor?->user_id === $user->id;
    }

    public function view(User $user, ReservationMedicalRequest $medicalRequest): bool
    {
        return $medicalRequest->reservation?->user_id === $user->id
            || $medicalRequest->reservation?->doctor?->user_id === $user->id;
    }

    public function upload(User $user, ReservationMedicalRequest $medicalRequest): bool
    {
        return $medicalRequest->reservation?->user_id === $user->id;
    }

    public function review(User $user, ReservationMedicalRequest $medicalRequest): bool
    {
        return $medicalRequest->reservation?->doctor?->user_id === $user->id;
    }
}
