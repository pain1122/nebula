<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use InvalidArgumentException;

/** Explicit administrative entry; ordinary doctor/patient policies remain unchanged. */
final class AdminClinicalScope
{
    public static function authorize(User $actor, ?string $reason): bool
    {
        if ($reason === null) {
            return false;
        }
        if (! $actor->canAccessAdminPanel()) {
            throw new AuthorizationException;
        }
        if (trim($reason) === '' || mb_strlen($reason) > 1000) {
            throw new InvalidArgumentException('Administrative clinical actions require a reason.');
        }

        return true;
    }
}
