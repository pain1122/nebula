<?php

namespace App\Policies;

use App\Models\Checkup;
use App\Models\User;

class CheckupPolicy
{
    public function archive(User $user, Checkup $checkup): bool
    {
        return $user->canAccessAdminPanel();
    }
}
