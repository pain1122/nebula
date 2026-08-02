<?php

namespace App\Policies;

use App\Models\ReservationRatingOption;
use App\Models\User;

class ReservationRatingOptionPolicy
{
    public function create(User $user): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function update(User $user, ReservationRatingOption $option): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function delete(User $user, ReservationRatingOption $option): bool
    {
        return $user->canAccessAdminPanel();
    }
}
