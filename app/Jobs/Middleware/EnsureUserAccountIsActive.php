<?php

namespace App\Jobs\Middleware;

use App\Models\User;
use Closure;

class EnsureUserAccountIsActive
{
    public function __construct(private readonly int|string $userId) {}

    public function handle(object $job, Closure $next): void
    {
        $user = User::query()->find($this->userId);

        if (! $user?->permitsAuthentication()) {
            return;
        }

        $next($job);
    }
}
