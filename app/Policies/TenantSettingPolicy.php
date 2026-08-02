<?php

namespace App\Policies;

use Illuminate\Support\Facades\DB;

class TenantSettingPolicy
{
    public function update(int $actorId): bool
    {
        return DB::connection('tenant')->table('users')
            ->join('model_has_roles', 'model_has_roles.model_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('users.id', $actorId)
            ->where('users.account_state', 'active')
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->where('roles.name', 'admin')
            ->where('roles.guard_name', 'sanctum')
            ->exists();
    }
}
