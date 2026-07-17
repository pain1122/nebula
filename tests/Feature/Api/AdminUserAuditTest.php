<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class AdminUserAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_user_create_writes_audit_event_without_sensitive_fields(): void
    {
        $admin = $this->adminUser();

        $response = $this
            ->actingAsStatefulAdmin($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->withHeader('User-Agent', 'AuditTest/1.0')
            ->postJson('/api/admin/users', $this->adminUserPayload([
                'role' => UserRole::Doctor->value,
                'password' => 'SecretPass123!',
            ]));

        $response->assertOk();

        $createdUser = User::query()->where('email', 'created-audit@example.test')->firstOrFail();
        $event = AuditEvent::query()->firstOrFail();

        $this->assertSame($admin->id, $event->actor_user_id);
        $this->assertSame('admin.user.created', $event->action);
        $this->assertSame(User::class, $event->subject_type);
        $this->assertSame($createdUser->id, $event->subject_id);
        $this->assertSame('critical', $event->risk_level);
        $this->assertNull($event->batch_id);
        $this->assertNull($event->before);
        $this->assertSame('POST /api/admin/users', $event->route);
        $this->assertSame('AuditTest/1.0', $event->user_agent);
        $this->assertSame('created-audit@example.test', $event->after['email']);
        $this->assertSame([UserRole::Doctor->value], $event->after['roles']);

        $encodedAfter = json_encode($event->after);
        $this->assertIsString($encodedAfter);
        $this->assertStringNotContainsString('SecretPass123!', $encodedAfter);
        $this->assertArrayNotHasKey('password', $event->after);
    }

    public function test_admin_user_update_writes_before_and_after_audit_event(): void
    {
        $admin = $this->adminUser();
        $target = User::factory()->create([
            'email' => 'before-audit@example.test',
            'phone' => '09111111111',
            'NID' => '1111111111',
            'patient_status' => 'free',
        ]);
        $target->syncRoles([UserRole::Patient->value]);

        $response = $this
            ->actingAsStatefulAdmin($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->putJson('/api/admin/users/'.$target->id, $this->adminUserPayload([
                'role' => UserRole::Doctor->value,
                'email' => 'after-audit@example.test',
                'phone' => '09222222222',
                'NID' => '2222222222',
                'patient_status' => 'active',
            ]));

        $response->assertOk();

        $event = AuditEvent::query()->firstOrFail();

        $this->assertSame('admin.user.updated', $event->action);
        $this->assertSame($target->id, $event->subject_id);
        $this->assertSame('before-audit@example.test', $event->before['email']);
        $this->assertSame('after-audit@example.test', $event->after['email']);
        $this->assertSame([UserRole::Patient->value], $event->before['roles']);
        $this->assertSame([UserRole::Doctor->value], $event->after['roles']);
        $this->assertNull($event->after['patient_status']);
    }

    public function test_admin_user_create_rolls_back_when_audit_write_fails(): void
    {
        $admin = $this->adminUser();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')
                ->once()
                ->andThrow(new RuntimeException('audit failed'));
        });

        $this
            ->actingAsStatefulAdmin($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->postJson('/api/admin/users', $this->adminUserPayload([
                'email' => 'rollback-audit@example.test',
            ]))
            ->assertStatus(500);

        $this->assertDatabaseMissing('users', [
            'email' => 'rollback-audit@example.test',
        ]);
        $this->assertDatabaseCount('audit_events', 0);
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
     * @return array<string, int>
     */
    private function recentPasswordConfirmation(): array
    {
        return ['auth.password_confirmed_at' => time()];
    }

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function adminUserPayload(array $overrides = []): array
    {
        return array_merge([
            'role' => UserRole::Patient->value,
            'first_name' => 'Audit',
            'last_name' => 'Target',
            'phone' => '09999999999',
            'email' => 'created-audit@example.test',
            'birth_date' => '1990-01-01',
            'NID' => '9999999999',
            'city' => 'Tehran',
            'country' => 'Iran',
            'zip_code' => '1234567890',
            'bio' => 'Audit test user',
            'patient_status' => 'free',
        ], $overrides);
    }
}
