<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\User;
use App\Enums\UserRole;


class ReservationPolicy
{
    public function view(User $user, Reservation $reservation): bool
    {
        return $user->hasRole(UserRole::Admin->value)
            || $reservation->user_id === $user->id
            || $reservation->doctor?->user_id === $user->id;
    }

    public function update(User $user, Reservation $reservation): bool
    {
        // فعلاً: ادمین یا خود دکتر
        return $user->hasRole(UserRole::Admin->value)
            || $reservation->doctor?->user_id === $user->id;
    }

    public function cancel(User $user, Reservation $reservation): bool
    {
        if ($reservation->status === 'done' || $reservation->status === 'canceled') {
            return false;
        }

        return $user->hasRole(UserRole::Admin->value)
            || $reservation->doctor?->user_id === $user->id
            || $reservation->user_id === $user->id;
    }

    public function reschedule(User $user, Reservation $reservation): bool
    {
        if ($reservation->status === 'done' || $reservation->status === 'canceled') {
            return false;
        }

        return $user->hasRole(UserRole::Admin->value)
            || $reservation->doctor?->user_id === $user->id;
    }
}
