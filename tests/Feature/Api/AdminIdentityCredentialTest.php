<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminIdentityCredentialTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    public function test_admin_created_identity_requires_a_confirmed_long_password(): void
    {
        $rootAdmin = User::factory()->rootAdmin()->create();

        foreach ([
            ['password' => null, 'password_confirmation' => null],
            ['password' => 'only-fourteen!', 'password_confirmation' => 'only-fourteen!'],
            ['password' => 'correct horse battery staple', 'password_confirmation' => 'different long passphrase'],
            ['password' => str_repeat('a', 65), 'password_confirmation' => str_repeat('a', 65)],
            ['password' => 'password-password', 'password_confirmation' => 'password-password'],
            ['password' => 'invalid-password-5@example.test', 'password_confirmation' => 'invalid-password-5@example.test'],
        ] as $index => $credentials) {
            $payload = $this->payload([
                'email' => "invalid-password-{$index}@example.test",
                'phone' => '0911111111'.($index + 1),
                'NID' => '111111111'.($index + 1),
                ...$credentials,
            ]);

            $this->actingAsStateful($rootAdmin)
                ->withSession($this->recentPasswordConfirmation())
                ->postJson('/api/admin/users', $payload)
                ->assertUnprocessable()
                ->assertJsonValidationErrors('password');
        }

        $this->assertDatabaseMissing('users', [
            'email' => 'invalid-password-0@example.test',
        ]);
    }

    public function test_root_admin_may_use_or_override_a_passphrase_suggestion_without_plaintext_exposure(): void
    {
        $rootAdmin = User::factory()->rootAdmin()->create();
        $passphrase = 'cedar lantern valley compass';

        $response = $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->postJson('/api/admin/users', $this->payload([
                'password' => $passphrase,
                'password_confirmation' => $passphrase,
            ]))
            ->assertOk()
            ->assertJsonMissing(['password' => $passphrase]);

        $created = User::query()->findOrFail($response->json('data.user.id'));
        $event = AuditEvent::query()->where('subject_id', $created->id)->firstOrFail();

        $this->assertTrue(Hash::check($passphrase, $created->password));
        $this->assertNotSame($passphrase, $created->password);
        $this->assertSame('Create the operations administrator.', $event->reason);
        $this->assertStringNotContainsString($passphrase, $response->getContent());
        $this->assertStringNotContainsString($passphrase, json_encode($event->toArray(), JSON_THROW_ON_ERROR));
    }

    public function test_admin_identity_creation_and_update_require_a_reason(): void
    {
        $rootAdmin = User::factory()->rootAdmin()->create();
        $admin = User::factory()->admin()->create([
            'email' => 'existing-admin-reason@example.test',
        ]);

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->postJson('/api/admin/users', $this->payload(['reason' => null]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$admin->id, [
                'role' => 'admin', 'first_name' => 'Updated', 'last_name' => 'Display',
                'expected_revision' => app(\App\Services\PanelProfileService::class)->revision($admin),
                'reason' => null,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_general_identity_update_cannot_replace_a_password(): void
    {
        $rootAdmin = User::factory()->rootAdmin()->create();
        $admin = User::factory()->admin()->create();
        $originalHash = $admin->password;

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$admin->id, [
                'role' => 'admin', 'first_name' => 'Updated', 'last_name' => 'Display',
                'expected_revision' => app(\App\Services\PanelProfileService::class)->revision($admin),
                'password' => 'replacement password phrase',
                'password_confirmation' => 'replacement password phrase',
                'reason' => 'Update the administrator profile.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'password_confirmation']);

        $this->assertSame($originalHash, $admin->fresh()->password);
    }

    public function test_root_admin_can_update_admin_identity_with_reason_without_changing_credentials(): void
    {
        $rootAdmin = User::factory()->rootAdmin()->create();
        $admin = User::factory()->admin()->create([
            'email' => 'admin-before-update@example.test',
        ]);
        $originalHash = $admin->password;

        $this->actingAsStateful($rootAdmin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$admin->id, [
                'role' => 'admin', 'first_name' => 'Updated', 'last_name' => 'Display',
                'expected_revision' => app(\App\Services\PanelProfileService::class)->revision($admin),
                'reason' => 'Correct the marketplace administrator profile.',
            ])
            ->assertOk()
            ->assertJsonPath('data.user.email', null);

        $admin->refresh();
        $event = AuditEvent::query()->where('subject_id', $admin->id)->firstOrFail();

        $this->assertTrue($admin->hasRole(UserRole::Admin->value));
        $this->assertSame($originalHash, $admin->password);
        $this->assertSame('admin-before-update@example.test', $admin->email);
        $this->assertSame('Correct the marketplace administrator profile.', $event->reason);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'role' => UserRole::Admin->value,
            'first_name' => 'Credential',
            'last_name' => 'Target',
            'phone' => '09111111110',
            'email' => 'credential-target@example.test',
            'birth_date' => '1990-01-01',
            'NID' => '1111111110',
            'city' => 'Tehran',
            'country' => 'Iran',
            'zip_code' => '1234567890',
            'bio' => 'Credential contract test user',
            'patient_status' => null,
            'password' => 'cedar lantern valley compass',
            'password_confirmation' => 'cedar lantern valley compass',
            'reason' => 'Create the operations administrator.',
        ], $overrides);
    }

    private function actingAsStateful(User $user)
    {
        return $this->actingAs($user)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }

    /** @return array{auth.password_confirmed_at: int} */
    private function recentPasswordConfirmation(): array
    {
        return ['auth.password_confirmed_at' => time()];
    }
}
