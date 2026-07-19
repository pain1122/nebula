<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function changeAccountState(User $actor, User $target): bool
    {
        return $actor->isRootAdmin()
            && ! $target->isRootAdmin()
            && ! $actor->is($target);
    }
}
