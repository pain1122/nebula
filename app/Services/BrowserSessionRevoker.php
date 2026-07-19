<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use LogicException;

class BrowserSessionRevoker
{
    public function revokeAll(User $user): int
    {
        if (config('session.driver') !== 'database') {
            throw new LogicException('Account-wide browser-session revocation requires the database session driver.');
        }

        $sessionConnection = config('session.connection');

        if ($sessionConnection !== null && $sessionConnection !== config('database.default')) {
            throw new LogicException('Browser sessions must use the default database connection for atomic revocation.');
        }

        return DB::table(config('session.table'))
            ->where('user_id', $user->getKey())
            ->delete();
    }
}
