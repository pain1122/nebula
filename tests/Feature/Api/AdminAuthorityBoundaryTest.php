<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthorityBoundaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_normal_admin_cannot_list_show_create_or_update_admin_identities(): void
    {
        $actor = $this->userWithRole(UserRole::Admin);
        $admin = $this->userWithRole(UserRole::Admin, [
            'email' => 'existing-admin@example.test',
        ]);

        $this->actingAsStateful($actor)
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonMissing(['id' => $admin->id]);

        $this->actingAsStateful($actor)
            ->getJson('/api/admin/users/'.$admin->id)
            ->assertForbidden();

        $this->actingAsStateful($actor)
            ->withSession($this->recentPasswordConfirmation())
            ->postJson('/api/admin/users', $this->userPayload([
                'role' => UserRole::Admin->value,
                'email' => 'created-admin@example.test',
            ]))
            ->assertForbidden();

        $this->actingAsStateful($actor)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$admin->id, $this->userPayload([
                'role' => UserRole::Patient->value,
                'email' => $admin->email,
                'phone' => $admin->phone,
                'NID' => $admin->NID,
            ]))
            ->assertForbidden();

        $this->assertDatabaseMissing('users', [
            'email' => 'created-admin@example.test',
        ]);
        $this->assertTrue($admin->fresh()->hasRole(UserRole::Admin->value));
    }

    public function test_root_admin_can_create_and_manage_admin_identities(): void
    {
        $rootAdmin = $this->userWithRole(UserRole::RootAdmin);

        $response = $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->postJson('/api/admin/users', $this->userPayload([
                'role' => UserRole::Admin->value,
                'email' => 'managed-admin@example.test',
            ]))
            ->assertOk();

        $admin = User::query()->findOrFail($response->json('data.user.id'));

        $this->assertTrue($admin->hasRole(UserRole::Admin->value));

        $this->actingAsStateful($rootAdmin)
            ->getJson('/api/admin/users/'.$admin->id)
            ->assertOk()
            ->assertJsonPath('data.user.role', UserRole::Admin->value);
    }

    private function userWithRole(UserRole $role, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
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

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function userPayload(array $overrides = []): array
    {
        return array_merge([
            'role' => UserRole::Patient->value,
            'first_name' => 'Authority',
            'last_name' => 'Target',
            'phone' => '09777777777',
            'email' => 'authority-target@example.test',
            'birth_date' => '1990-01-01',
            'NID' => '7777777777',
            'city' => 'Tehran',
            'country' => 'Iran',
            'zip_code' => '1234567890',
            'bio' => 'Authority boundary test user',
            'patient_status' => 'free',
        ], $overrides);
    }
}
