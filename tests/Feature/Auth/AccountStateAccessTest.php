<?php

namespace Tests\Feature\Auth;

use App\Enums\AccountState;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountStateAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_suspended_user_cannot_start_a_browser_session(): void
    {
        $user = User::factory()->create([
            'account_state' => AccountState::Suspended,
        ]);

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_closed_user_cannot_receive_an_api_token(): void
    {
        $user = User::factory()->create([
            'account_state' => AccountState::Closed,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'test',
        ])
            ->assertForbidden()
            ->assertJsonPath('errors.account.0', 'account_inactive');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_existing_tokens_are_revoked_when_account_becomes_suspended(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;
        $user->forceFill([
            'account_state' => AccountState::Suspended,
            'account_state_changed_at' => now(),
        ])->save();

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'account_inactive');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_active_user_keeps_normal_authenticated_access(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me')
            ->assertOk();
    }
}
