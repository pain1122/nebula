<?php

namespace App\Policies;

use App\Models\TenantInstance;
use App\Models\User;

class TenantInstancePolicy
{
    public function update(User $user, TenantInstance $tenantInstance): bool
    {
        return $user->isRootAdmin();
    }

    public function manageFeatures(User $user, TenantInstance $tenantInstance): bool
    {
        return $user->isRootAdmin();
    }
}
