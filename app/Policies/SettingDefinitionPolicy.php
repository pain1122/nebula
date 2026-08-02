<?php

namespace App\Policies;

use App\Models\SettingDefinition;
use App\Models\User;

class SettingDefinitionPolicy
{
    public function update(User $user, SettingDefinition $settingDefinition): bool
    {
        return $user->isRootAdmin();
    }
}
