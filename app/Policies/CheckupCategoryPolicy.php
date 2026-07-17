<?php

namespace App\Policies;

use App\Models\CheckupCategory;
use App\Models\User;

class CheckupCategoryPolicy
{
    public function archive(User $user, CheckupCategory $checkupCategory): bool
    {
        return $user->canAccessAdminPanel();
    }
}
