<?php

namespace App\Policies;

use App\Models\DoctorProfile;
use App\Models\User;

class DoctorProfilePolicy
{
    public function verify(User $user, DoctorProfile $doctorProfile): bool
    {
        return $user->canAccessAdminPanel();
    }
}
