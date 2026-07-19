<?php

namespace App\Jobs;

use App\Jobs\Middleware\EnsureUserAccountIsActive;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

abstract class UserSensitiveJob implements ShouldQueue
{
    use Queueable;

    /**
     * @return list<object>
     */
    final public function middleware(): array
    {
        return [new EnsureUserAccountIsActive($this->accountStateUserId())];
    }

    abstract protected function accountStateUserId(): int|string;
}
