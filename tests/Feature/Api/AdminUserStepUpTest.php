<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserStepUpTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_user_create_requires_recent_password_confirmation(): void
    {
        $admin = $this->adminUser();

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession([])
            ->postJson('/api/admin/users', $this->adminUserPayload([
                'email' => 'needs-step-up@example.test',
            ]))
            ->assertStatus(423)
            ->assertJsonPath('message', 'Recent password confirmation required.');

        $this->assertDatabaseMissing('users', [
            'email' => 'needs-step-up@example.test',
        ]);
    }

    public function test_api_step_up_keeps_json_response_without_an_accept_header(): void
    {
        $admin = $this->adminUser();

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession([])
            ->post('/api/admin/users', $this->adminUserPayload([
                'email' => 'plain-request-step-up@example.test',
            ]))
            ->assertStatus(423)
            ->assertJsonPath('message', 'Recent password confirmation required.');

        $this->assertDatabaseMissing('users', [
            'email' => 'plain-request-step-up@example.test',
        ]);
    }

    public function test_admin_user_update_requires_recent_password_confirmation(): void
    {
        $admin = $this->adminUser();
        $target = User::factory()->create([
            'email' => 'before-update-step-up@example.test',
        ]);
        $target->syncRoles([UserRole::Patient->value]);

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession([])
            ->putJson('/api/admin/users/'.$target->id, $this->adminUserPayload([
                'email' => 'after-update-step-up@example.test',
            ]))
            ->assertStatus(423)
            ->assertJsonPath('message', 'Recent password confirmation required.');

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'email' => 'before-update-step-up@example.test',
        ]);
    }

    public function test_confirm_password_endpoint_rejects_invalid_password(): void
    {
        $admin = $this->adminUser();

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession([])
            ->postJson('/api/auth/confirm-password', [
                'password' => 'not-the-password',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Invalid password.');
    }

    public function test_confirm_password_endpoint_requires_session_backed_authentication(): void
    {
        $admin = $this->adminUser();

        $this
            ->actingAs($admin, 'sanctum')
            ->postJson('/api/auth/confirm-password', [
                'password' => 'password',
            ])
            ->assertStatus(409)
            ->assertJsonPath('message', 'Session-backed authentication is required for password confirmation.');
    }

    public function test_confirm_password_endpoint_stores_recent_confirmation(): void
    {
        $admin = $this->adminUser();

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession([])
            ->postJson('/api/auth/confirm-password', [
                'password' => 'password',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Password confirmed.')
            ->assertSessionHas('auth.password_confirmed_at');
    }

    public function test_admin_user_create_accepts_recent_password_confirmation(): void
    {
        $admin = $this->adminUser();

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->postJson('/api/admin/users', $this->adminUserPayload([
                'email' => 'confirmed-step-up@example.test',
            ]))
            ->assertOk();

        $this->assertDatabaseHas('users', [
            'email' => 'confirmed-step-up@example.test',
        ]);
    }

    public function test_expired_password_confirmation_is_rejected(): void
    {
        config(['auth.high_authority_password_timeout' => 900]);

        $admin = $this->adminUser();

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession(['auth.password_confirmed_at' => time() - 901])
            ->postJson('/api/admin/users', $this->adminUserPayload([
                'email' => 'expired-step-up@example.test',
            ]))
            ->assertStatus(423)
            ->assertJsonPath('message', 'Recent password confirmation required.');

        $this->assertDatabaseMissing('users', [
            'email' => 'expired-step-up@example.test',
        ]);
    }

    private function adminUser(): User
    {
        $admin = User::factory()->create();
        $admin->syncRoles([UserRole::Admin->value]);

        return $admin;
    }

    private function actingAsStatefulAdmin(User $admin)
    {
        return $this
            ->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function adminUserPayload(array $overrides = []): array
    {
        return array_merge([
            'role' => UserRole::Patient->value,
            'first_name' => 'Step',
            'last_name' => 'Target',
            'phone' => '09888888888',
            'email' => 'step-up-target@example.test',
            'birth_date' => '1990-01-01',
            'NID' => '8888888888',
            'city' => 'Tehran',
            'country' => 'Iran',
            'zip_code' => '1234567890',
            'bio' => 'Step-up test user',
            'patient_status' => 'free',
        ], $overrides);
    }
}
