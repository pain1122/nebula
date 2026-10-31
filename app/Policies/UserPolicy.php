<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function createAdminIdentity(User $actor): bool
    {
        return $actor->isRootAdmin();
    }

    public function updateAdminIdentity(User $actor, User $target): bool
    {
        return $actor->isRootAdmin()
            && ! $target->isRootAdmin()
            && ! $actor->is($target);
    }

    public function changeAccountState(User $actor, User $target): bool
    {
        return $actor->isRootAdmin()
            && ! $target->isRootAdmin()
            && ! $actor->is($target);
    }
}
