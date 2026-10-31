<?php

namespace App\Policies;

use App\Enums\UserRole;
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
        return $reservation->user_id === $user->id;
    }

    public function complete(User $user, Reservation $reservation): bool
    {
        return $reservation->doctor?->user_id === $user->id;
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
            || ($user->hasRole(UserRole::Doctor->value) && $reservation->doctor?->user_id === $user->id);
    }

    public function overrideStatus(User $user, Reservation $reservation): bool
    {
        return $user->isRootAdmin();
    }
}
