<?php

namespace Tests\Feature\Services;

use App\Enums\AccountState;
use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\User;
use App\Services\AccountStateService;
use App\Services\AuditLogger;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class AccountStateServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_suspension_records_metadata_revokes_tokens_and_writes_audit(): void
    {
        $actor = $this->rootAdmin();
        $target = User::factory()->create();
        $target->createToken('phone');
        $target->createToken('tablet');
        $this->createSession('target-phone', $target);
        $this->createSession('target-tablet', $target);
        $otherUser = User::factory()->create();
        $this->createSession('other-user', $otherUser);

        $updated = app(AccountStateService::class)->change(
            request: $this->requestFor($target),
            actor: $actor,
            target: $target,
            newState: AccountState::Suspended,
            reason: '  Repeated policy violations  ',
        );

        $this->assertSame(AccountState::Suspended, $updated->account_state);
        $this->assertSame($actor->id, $updated->account_state_changed_by);
        $this->assertSame('Repeated policy violations', $updated->account_state_reason);
        $this->assertNotNull($updated->account_state_changed_at);
        $this->assertNull($updated->closed_at);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('sessions', ['id' => 'target-phone']);
        $this->assertDatabaseMissing('sessions', ['id' => 'target-tablet']);
        $this->assertDatabaseHas('sessions', ['id' => 'other-user']);

        $event = AuditEvent::query()->sole();
        $this->assertSame('admin.user.account_state.changed', $event->action);
        $this->assertSame('Repeated policy violations', $event->reason);
        $this->assertSame(AccountState::Active->value, $event->before['account_state']);
        $this->assertSame(AccountState::Suspended->value, $event->after['account_state']);
    }

    public function test_suspended_account_can_be_reactivated(): void
    {
        $actor = $this->rootAdmin();
        $target = User::factory()->create([
            'account_state' => AccountState::Suspended,
            'account_state_changed_at' => now()->subDay(),
            'account_state_changed_by' => $actor->id,
            'account_state_reason' => 'Previous reason',
        ]);

        $updated = app(AccountStateService::class)->change(
            $this->requestFor($target),
            $actor,
            $target,
            AccountState::Active,
            'Appeal approved',
        );

        $this->assertSame(AccountState::Active, $updated->account_state);
        $this->assertSame('Appeal approved', $updated->account_state_reason);
        $this->assertNull($updated->closed_at);
    }

    public function test_closure_is_permanent_and_records_closed_timestamp(): void
    {
        $actor = $this->rootAdmin();
        $target = User::factory()->create();

        $closed = app(AccountStateService::class)->change(
            $this->requestFor($target),
            $actor,
            $target,
            AccountState::Closed,
            'Verified closure request',
        );

        $this->assertSame(AccountState::Closed, $closed->account_state);
        $this->assertNotNull($closed->closed_at);

        $this->expectException(DomainException::class);

        app(AccountStateService::class)->change(
            $this->requestFor($closed),
            $actor,
            $closed,
            AccountState::Active,
            'Attempted reopening',
        );
    }

    public function test_empty_reason_and_same_state_are_rejected(): void
    {
        $actor = $this->rootAdmin();
        $target = User::factory()->create();

        try {
            app(AccountStateService::class)->change(
                $this->requestFor($target),
                $actor,
                $target,
                AccountState::Suspended,
                '   ',
            );

            $this->fail('An empty reason should be rejected.');
        } catch (InvalidArgumentException) {
            $this->assertSame(AccountState::Active, $target->fresh()->account_state);
        }

        $this->expectException(DomainException::class);

        app(AccountStateService::class)->change(
            $this->requestFor($target),
            $actor,
            $target,
            AccountState::Active,
            'No-op transition',
        );
    }

    public function test_audit_failure_rolls_back_state_metadata_and_token_revocation(): void
    {
        $actor = $this->rootAdmin();
        $target = User::factory()->create();
        $target->createToken('phone');
        $this->createSession('rollback-session', $target);

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')
                ->once()
                ->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(AccountStateService::class)->change(
                $this->requestFor($target),
                $actor,
                $target,
                AccountState::Suspended,
                'Security review',
            );

            $this->fail('The audit failure should escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $target->refresh();

        $this->assertSame(AccountState::Active, $target->account_state);
        $this->assertNull($target->account_state_changed_at);
        $this->assertNull($target->account_state_changed_by);
        $this->assertNull($target->account_state_reason);
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertDatabaseHas('sessions', ['id' => 'rollback-session']);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_non_database_session_driver_fails_closed(): void
    {
        config(['session.driver' => 'redis']);

        $actor = $this->rootAdmin();
        $target = User::factory()->create();
        $target->createToken('phone');

        try {
            app(AccountStateService::class)->change(
                $this->requestFor($target),
                $actor,
                $target,
                AccountState::Suspended,
                'Driver mismatch check',
            );

            $this->fail('A non-database session driver should fail closed.');
        } catch (LogicException $exception) {
            $this->assertSame(
                'Account-wide browser-session revocation requires the database session driver.',
                $exception->getMessage()
            );
        }

        $this->assertSame(AccountState::Active, $target->fresh()->account_state);
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function rootAdmin(): User
    {
        $user = User::factory()->create();
        $user->syncRoles([UserRole::RootAdmin->value]);

        return $user;
    }

    private function requestFor(User $target): Request
    {
        return Request::create(
            '/api/admin/users/'.$target->id.'/account-state',
            'PUT',
        );
    }

    private function createSession(string $id, User $user): void
    {
        DB::table('sessions')->insert([
            'id' => $id,
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Account state service test',
            'payload' => base64_encode('session payload'),
            'last_activity' => now()->timestamp,
        ]);
    }
}
