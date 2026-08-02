<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;

class ReservationPolicy
{
    public function view(User $user, Reservation $reservation): bool
    {
        return $user->canAccessAdminPanel()
            || $reservation->user_id === $user->id
            || $reservation->doctor?->user_id === $user->id;
    }

    public function update(User $user, Reservation $reservation): bool
    {
        // فعلاً: ادمین یا خود دکتر
        return $user->canAccessAdminPanel()
            || $reservation->doctor?->user_id === $user->id;
    }

    public function cancel(User $user, Reservation $reservation): bool
    {
        if (in_array($reservation->status, [
            ReservationStatus::Completed,
            ReservationStatus::Cancelled,
            ReservationStatus::Expired,
        ], true)) {
            return false;
        }

        return $user->canAccessAdminPanel()
            || $reservation->doctor?->user_id === $user->id
            || $reservation->user_id === $user->id;
    }

    public function reschedule(User $user, Reservation $reservation): bool
    {
        if (in_array($reservation->status, [
            ReservationStatus::Completed,
            ReservationStatus::Cancelled,
            ReservationStatus::Expired,
        ], true)) {
            return false;
        }

        return $user->canAccessAdminPanel()
            || $reservation->doctor?->user_id === $user->id;
    }

    public function overrideStatus(User $user, Reservation $reservation): bool
    {
        return $user->isRootAdmin();
    }
}
