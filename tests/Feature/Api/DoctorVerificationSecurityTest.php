<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\DoctorProfile;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class DoctorVerificationSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_verification_requires_recent_password_reason_and_writes_audit(): void
    {
        $admin = User::factory()->admin()->create();
        $doctor = DoctorProfile::factory()->create(['verified' => false, 'verified_at' => null]);

        $this->statefulAs($admin)
            ->putJson('/api/admin/doctors/'.$doctor->id.'/verify', ['verified' => true, 'reason' => 'Credentials checked'])
            ->assertStatus(423);

        $this->statefulAs($admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/doctors/'.$doctor->id.'/verify', ['verified' => true])
            ->assertUnprocessable();

        $this->statefulAs($admin)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/doctors/'.$doctor->id.'/verify', [
                'verified' => true,
                'reason' => 'Credentials checked',
            ])
            ->assertOk();

        $this->assertTrue($doctor->fresh()->verified);
        $event = AuditEvent::query()->sole();
        $this->assertSame('admin.doctor.verification_changed', $event->action);
        $this->assertSame('Credentials checked', $event->reason);
        $this->assertFalse($event->before['verified']);
        $this->assertTrue($event->after['verified']);
    }

    public function test_patient_is_denied_and_audit_failure_rolls_back_verification(): void
    {
        $doctor = DoctorProfile::factory()->create(['verified' => false, 'verified_at' => null]);

        $this->statefulAs(User::factory()->patient()->create())
            ->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/doctors/'.$doctor->id.'/verify', [
                'verified' => true,
                'reason' => 'Unauthorized',
            ])
            ->assertForbidden();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        $this->statefulAs(User::factory()->rootAdmin()->create())
            ->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/doctors/'.$doctor->id.'/verify', [
                'verified' => true,
                'reason' => 'Credentials checked',
            ])
            ->assertStatus(500);

        $this->assertFalse($doctor->fresh()->verified);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function statefulAs(User $user): static
    {
        return $this->actingAs($user)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }
}
