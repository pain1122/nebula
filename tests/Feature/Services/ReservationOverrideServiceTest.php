<?php

namespace Tests\Feature\Services;

use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ReservationOverrideService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use RuntimeException;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class ReservationOverrideServiceTest extends TestCase
{
    use IsolatedProfileApplication;
    use RefreshDatabase;

    public function test_revoked_cached_root_authority_cannot_write_or_audit(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $root->load('roles');
        User::query()->findOrFail($root->id)->syncRoles(['admin']);
        $this->assertTrue($root->isRootAdmin());
        $this->assertActorRejected($root);
    }

    public function test_suspended_and_closed_cached_root_actors_cannot_write_or_audit(): void
    {
        foreach (['suspended', 'closed'] as $state) {
            $root = User::factory()->rootAdmin()->create();
            $root->load('roles');
            User::query()->whereKey($root->id)->update(['account_state' => $state]);
            $this->assertTrue($root->permitsAuthentication());
            $this->assertActorRejected($root);
        }
    }

    private function assertActorRejected(User $actor): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Pending]);
        $before = $reservation->fresh()->getAttributes();
        try {
            app(ReservationOverrideService::class)->changeStatus(
                Request::create('/api/admin/reservations/status', 'PUT'),
                $actor,
                $reservation,
                ReservationStatus::Cancelled,
                'Synthetic authority rejection.',
            );
            $this->fail('Changed actor authority must be rejected under lock.');
        } catch (AuthorizationException) {
            $this->assertSame($before, $reservation->fresh()->getAttributes());
            $this->assertDatabaseCount('audit_events', 0);
        }
    }

    public function test_only_root_admin_can_apply_valid_reasoned_override_with_audit(): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Pending]);
        $service = app(ReservationOverrideService::class);

        try {
            $service->changeStatus(
                Request::create('/api/admin/reservations/status', 'PUT'),
                User::factory()->admin()->create(),
                $reservation,
                ReservationStatus::Cancelled,
                'Patient requested cancellation',
            );
            $this->fail('Ordinary admin override must fail.');
        } catch (AuthorizationException) {
            $this->assertSame(ReservationStatus::Pending, $reservation->fresh()->status);
        }

        $updated = $service->changeStatus(
            Request::create('/api/admin/reservations/status', 'PUT'),
            User::factory()->rootAdmin()->create(),
            $reservation,
            ReservationStatus::Cancelled,
            'Patient requested cancellation',
        );

        $this->assertSame(ReservationStatus::Cancelled, $updated->status);
        $event = AuditEvent::query()->sole();
        $this->assertSame('admin.reservation.status_overridden', $event->action);
        $this->assertSame('Patient requested cancellation', $event->reason);
    }

    public function test_invalid_transition_and_audit_failure_roll_back(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Pending]);
        $service = app(ReservationOverrideService::class);

        try {
            $service->changeStatus(
                Request::create('/override', 'PUT'),
                $root,
                $reservation,
                ReservationStatus::Completed,
                'Invalid completion',
            );
            $this->fail('Invalid transition must fail.');
        } catch (DomainException) {
            $this->assertSame(ReservationStatus::Pending, $reservation->fresh()->status);
        }

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(ReservationOverrideService::class)->changeStatus(
                Request::create('/override', 'PUT'),
                $root,
                $reservation,
                ReservationStatus::Cancelled,
                'Cancellation',
            );
            $this->fail('Audit failure must escape transaction.');
        } catch (RuntimeException) {
            $this->assertSame(ReservationStatus::Pending, $reservation->fresh()->status);
        }
    }
}
