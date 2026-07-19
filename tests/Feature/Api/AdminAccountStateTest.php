<?php

namespace Tests\Feature\Api;

use App\Enums\AccountState;
use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAccountStateTest extends TestCase
{
    use RefreshDatabase;

    public function test_root_admin_can_suspend_an_account_with_recent_password_confirmation(): void
    {
        $rootAdmin = $this->userWithRole(UserRole::RootAdmin);
        $target = $this->userWithRole(UserRole::Patient);
        $target->createToken('first');
        $target->createToken('second');

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => AccountState::Suspended->value,
                'reason' => 'Repeated abuse reports.',
            ])
            ->assertOk()
            ->assertJsonPath('data.user.account_state', AccountState::Suspended->value)
            ->assertJsonPath('data.user.account_state_changed_by', $rootAdmin->id)
            ->assertJsonPath('data.user.account_state_reason', 'Repeated abuse reports.');

        $target->refresh();

        $this->assertSame(AccountState::Suspended, $target->account_state);
        $this->assertNotNull($target->account_state_changed_at);
        $this->assertSame($rootAdmin->id, $target->account_state_changed_by);
        $this->assertSame(0, $target->tokens()->count());
        $this->assertDatabaseHas('audit_events', [
            'actor_user_id' => $rootAdmin->id,
            'subject_id' => $target->id,
            'action' => 'admin.user.account_state.changed',
            'reason' => 'Repeated abuse reports.',
        ]);
    }

    public function test_normal_admin_cannot_change_account_state(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $target = $this->userWithRole(UserRole::Patient);

        $this->actingAsStateful($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => AccountState::Suspended->value,
                'reason' => 'Attempted unauthorized suspension.',
            ])
            ->assertForbidden();

        $this->assertSame(AccountState::Active, $target->fresh()->account_state);
        $this->assertSame(0, AuditEvent::query()->count());
    }

    public function test_root_admin_cannot_change_another_root_admin_account_state(): void
    {
        $actor = $this->userWithRole(UserRole::RootAdmin);
        $target = $this->userWithRole(UserRole::RootAdmin);

        $this->actingAsStateful($actor)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => AccountState::Suspended->value,
                'reason' => 'Root account change attempt.',
            ])
            ->assertForbidden();

        $this->assertSame(AccountState::Active, $target->fresh()->account_state);
    }

    public function test_account_state_change_requires_recent_password_confirmation(): void
    {
        $rootAdmin = $this->userWithRole(UserRole::RootAdmin);
        $target = $this->userWithRole(UserRole::Patient);

        $this->actingAsStateful($rootAdmin)
            ->withSession([])
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => AccountState::Suspended->value,
                'reason' => 'No recent confirmation.',
            ])
            ->assertStatus(423)
            ->assertJsonPath('message', 'Recent password confirmation required.');

        $this->assertSame(AccountState::Active, $target->fresh()->account_state);
    }

    public function test_account_state_and_reason_are_validated(): void
    {
        $rootAdmin = $this->userWithRole(UserRole::RootAdmin);
        $target = $this->userWithRole(UserRole::Patient);

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => 'disabled',
                'reason' => '',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['account_state', 'reason']);

        $this->assertSame(AccountState::Active, $target->fresh()->account_state);
    }

    public function test_closed_account_cannot_be_reactivated(): void
    {
        $rootAdmin = $this->userWithRole(UserRole::RootAdmin);
        $target = $this->userWithRole(UserRole::Patient);

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => AccountState::Closed->value,
                'reason' => 'Account closure requested.',
            ])
            ->assertOk();

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id.'/account-state', [
                'account_state' => AccountState::Active->value,
                'reason' => 'Attempted reopening.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['account_state']);

        $target->refresh();

        $this->assertSame(AccountState::Closed, $target->account_state);
        $this->assertNotNull($target->closed_at);
    }

    private function userWithRole(UserRole $role): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role->value]);

        return $user;
    }

    private function actingAsStateful(User $user)
    {
        return $this
            ->actingAs($user)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }

    /**
     * @return array<string, int>
     */
    private function recentPasswordConfirmation(): array
    {
        return ['auth.password_confirmed_at' => time()];
    }
}
