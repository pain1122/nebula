<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\User;

class ReservationFilePolicy
{
    public function upload(User $user, Reservation $reservation): bool
    {
        return $user->canAccessAdminPanel()
            || $reservation->user_id === $user->id
            || $reservation->doctor?->user_id === $user->id;
    }

    public function view(User $user, ReservationFile $file): bool
    {
        return $this->upload($user, $file->reservation);
    }

    public function archive(User $user, ReservationFile $file): bool
    {
        return $this->view($user, $file);
    }
}
