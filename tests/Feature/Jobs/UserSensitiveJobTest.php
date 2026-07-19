<?php

namespace Tests\Feature\Jobs;

use App\Enums\AccountState;
use App\Jobs\UserSensitiveJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserSensitiveJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_users_user_sensitive_job_executes(): void
    {
        $user = User::factory()->create();
        $job = new AccountStateAwareTestJob($user->id);

        $this->runThroughMiddleware($job);

        $this->assertTrue($job->handled);
    }

    public function test_job_rechecks_and_skips_user_suspended_after_dispatch(): void
    {
        $user = User::factory()->create();
        $job = new AccountStateAwareTestJob($user->id);

        $user->forceFill(['account_state' => AccountState::Suspended])->save();

        $this->runThroughMiddleware($job);

        $this->assertFalse($job->handled);
    }

    public function test_job_fails_closed_when_user_no_longer_exists(): void
    {
        $user = User::factory()->create();
        $job = new AccountStateAwareTestJob($user->id);

        $user->delete();

        $this->runThroughMiddleware($job);

        $this->assertFalse($job->handled);
    }

    private function runThroughMiddleware(AccountStateAwareTestJob $job): void
    {
        $job->middleware()[0]->handle(
            $job,
            static fn (AccountStateAwareTestJob $job) => $job->handle(),
        );
    }
}

class AccountStateAwareTestJob extends UserSensitiveJob
{
    public bool $handled = false;

    public function __construct(private readonly int|string $userId) {}

    public function handle(): void
    {
        $this->handled = true;
    }

    protected function accountStateUserId(): int|string
    {
        return $this->userId;
    }
}
