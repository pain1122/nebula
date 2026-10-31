<?php

namespace App\Policies;

use App\Models\Checkup;
use App\Models\User;

class CheckupPolicy
{
    public function create(User $user): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function update(User $user, Checkup $checkup): bool
    {
        return $user->canAccessAdminPanel() && ! $checkup->trashed();
    }

    public function archive(User $user, Checkup $checkup): bool
    {
        return $user->canAccessAdminPanel();
    }
}
