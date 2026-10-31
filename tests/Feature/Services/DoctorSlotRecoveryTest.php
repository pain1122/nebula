<?php

namespace Tests\Feature\Services;

use App\Models\AuditEvent;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\User;
use App\Services\BookingService;
use App\Services\DoctorVisitSlotControlService;
use App\Services\ReservationRescheduleService;
use App\Support\ScheduleControlConflict;
use DomainException;
use Illuminate\Database\Events\TransactionRolledBack;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PDOException;
use RuntimeException;
use Tests\TestCase;

class DoctorSlotRecoveryTest extends TestCase
{
    use DatabaseMigrations;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Isolated recovery checks only.');
        }
        parent::setUp();
    }

    private function graph(): array
    {
        $rule = DoctorWorkingWindow::factory()->create();
        $actor = $rule->workplace->doctorProfile->user;
        $actor->syncRoles(['doctor']);
        $slot = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id,
            'starts_at' => now()->addWeeks(2)->startOfDay()->addHours(5),
            'ends_at' => now()->addWeeks(2)->startOfDay()->addHours(5)->addMinutes(30), 'price' => 1000]);

        return [$actor, $slot, $rule];
    }

    private function change(User $actor, DoctorVisitSlot $slot, string $scope = 'slot')
    {
        return app(DoctorVisitSlotControlService::class)->change(Request::create('/synthetic-doctor-control', 'PATCH'),
            $actor, $slot->workplace, $slot->checkup, $scope,
            $slot->starts_at->copy()->setTimezone('Asia/Tehran'), $scope === 'slot' ? $slot : null,
            false, 2500, 'Synthetic recovery acceptance.');
    }

    private function databaseError(string $state = '40001', int $number = 1213): QueryException
    {
        $previous = new PDOException($number === 1205 ? 'Lock wait timeout exceeded; try restarting transaction' : 'Synthetic database refusal.', (int) $state);
        $previous->errorInfo = [$state, $number, 'SYNTHETIC_PRIVATE_SQL_DETAILS'];

        return new QueryException('sqlite', 'SYNTHETIC_PRIVATE_SQL', [], $previous);
    }

    public function test_two_rolled_back_deadlocks_then_one_complete_audited_save(): void
    {
        [$actor, $slot] = $this->graph();
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            if (++$attempts < 3) {
                throw $this->databaseError();
            }
        });
        $this->change($actor, $slot);
        $this->assertSame(3, $attempts);
        $this->assertSame(2500, $slot->fresh()->price);
        $this->assertFalse($slot->fresh()->is_active);
        $this->assertDatabaseCount('audit_events', 1);
        $this->assertSame([1000], AuditEvent::sole()->before['prices']);
        $this->assertSame([2500], AuditEvent::sole()->after['prices']);
        $this->assertSame(0, DB::transactionLevel());
    }

    public function test_exhausted_slot_conflict_is_private_409_and_no_partial_save(): void
    {
        [$actor, $slot] = $this->graph();
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw $this->databaseError();
        });
        $response = $this->actingAs($actor)->patchJson('/api/doctor/visit-slots/'.$slot->public_id,
            ['price' => 2500, 'reason' => 'Synthetic conflict.']);
        $response->assertStatus(409)->assertJsonPath('success', false)->assertJsonPath('errors.slot_id.0', 'slot_control_conflict');
        $this->assertStringContainsString('Refresh availability', $response->json('message'));
        $this->assertStringNotContainsString('SYNTHETIC_PRIVATE', $response->getContent());
        $this->assertSame(3, $attempts);
        $this->assertSame(1000, $slot->fresh()->price);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_exhausted_range_timeout_is_private_409_after_three_attempts(): void
    {
        [$actor, $slot] = $this->graph();
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw $this->databaseError('HY000', 1205);
        });
        $this->actingAs($actor)->patchJson('/api/doctor/workplaces/'.$slot->workplace->getRouteKey().'/visit-slots',
            ['checkup_id' => $slot->checkup_id, 'scope' => 'day', 'date' => $slot->starts_at->copy()->setTimezone('Asia/Tehran')->toDateString(),
                'is_active' => false, 'reason' => 'Synthetic conflict.'])
            ->assertStatus(409)->assertJsonPath('errors.date.0', 'slot_control_conflict');
        $this->assertSame(3, $attempts);
        $this->assertTrue($slot->fresh()->is_active);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_retry_rechecks_revoked_role_despite_cached_actor(): void
    {
        [$actor, $slot] = $this->graph();
        $actor->load('roles', 'doctorProfile');
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw $this->databaseError();
        });
        Event::listen(TransactionRolledBack::class, function ($event) use ($actor): void {
            if ($event->connection->transactionLevel() === 0) {
                DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $actor->id)->delete();
            }
        });
        try {
            $this->change($actor, $slot);
            $this->fail('Revoked authority must stop recovery.');
        } catch (DomainException) {
            $this->assertSame(1, $attempts);
            $this->assertSame(1000, $slot->fresh()->price);
            $this->assertDatabaseCount('audit_events', 0);
        }
    }

    public function test_suspended_actor_and_reassigned_workplace_cannot_use_cached_ownership(): void
    {
        [$actor, $slot] = $this->graph();
        $actor->load('roles', 'doctorProfile');
        User::whereKey($actor->id)->update(['account_state' => 'suspended']);
        try {
            $this->change($actor, $slot);
            $this->fail('Suspended actor must be refused.');
        } catch (DomainException) {
            $this->assertSame(1000, $slot->fresh()->price);
        }
        User::whereKey($actor->id)->update(['account_state' => 'active']);
        $otherRule = DoctorWorkingWindow::factory()->create();
        $slot->workplace->forceFill(['doctor_profile_id' => $otherRule->workplace->doctor_profile_id])->save();
        $this->expectException(DomainException::class);
        $this->change($actor, $slot);
    }

    public function test_previously_rescheduled_slot_remains_protected(): void
    {
        [$actor, $slot] = $this->graph();
        $patient = User::factory()->patient()->create();
        [$reservation, $payment] = app(BookingService::class)->createReservation($patient, $slot->public_id);
        $replacement = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $slot->doctor_working_window_id,
            'starts_at' => $slot->starts_at->copy()->addHour(), 'ends_at' => $slot->ends_at->copy()->addHour(), 'price' => 1000]);
        app(ReservationRescheduleService::class)->reschedule(Request::create('/synthetic-reschedule'), $actor, $reservation, $replacement->public_id, 'Synthetic history.');
        try {
            $this->change($actor, $slot);
            $this->fail('Historical occurrence must remain protected.');
        } catch (DomainException) {
            $this->assertSame(1000, $slot->fresh()->price);
            $this->assertTrue($slot->fresh()->is_active);
            $this->assertSame(1000, $reservation->fresh()->price_snapshot);
            $this->assertSame(1000, $payment->fresh()->amount);
            $this->assertDatabaseCount('reservation_schedule_changes', 1);
        }
    }

    public function test_audit_failure_is_not_retried(): void
    {
        [$actor, $slot] = $this->graph();
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw new RuntimeException('Synthetic audit unavailable.');
        });
        try {
            $this->change($actor, $slot);
            $this->fail('Audit failure must escape.');
        } catch (RuntimeException $error) {
            $this->assertNotInstanceOf(ScheduleControlConflict::class, $error);
            $this->assertSame(1, $attempts);
            $this->assertSame(1000, $slot->fresh()->price);
        }
    }

    public function test_non_concurrency_sql_failure_is_not_translated_to_retryable_conflict(): void
    {
        [$actor, $slot] = $this->graph();
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw $this->databaseError('23000', 1452);
        });
        try {
            $this->change($actor, $slot);
            $this->fail('Unrelated SQL failure must escape.');
        } catch (QueryException) {
            $this->assertSame(1, $attempts);
            $this->assertSame(1000, $slot->fresh()->price);
            $this->assertDatabaseCount('audit_events', 0);
        }
    }

    public function test_nested_deadlock_requires_outer_rollback_without_inner_replay(): void
    {
        [$actor, $slot] = $this->graph();
        $attempts = 0;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw $this->databaseError();
        });
        try {
            DB::transaction(fn () => $this->change($actor, $slot));
            $this->fail('Inner deadlock must unwind through the outer owner.');
        } catch (ScheduleControlConflict) {
            $this->assertSame(1, $attempts);
            $this->assertSame(0, DB::transactionLevel());
            $this->assertSame(1000, $slot->fresh()->price);
            $this->assertDatabaseCount('audit_events', 0);
        }
    }

    public function test_retry_protects_a_booking_committed_after_the_rollback(): void
    {
        [$actor, $slot] = $this->graph();
        $patient = User::factory()->patient()->create();
        $attempts = 0;
        $booked = false;
        AuditEvent::creating(function () use (&$attempts): void {
            $attempts++;
            throw $this->databaseError();
        });
        Event::listen(TransactionRolledBack::class, function ($event) use ($patient, $slot, &$booked): void {
            if (! $booked && $event->connection->transactionLevel() === 0) {
                $booked = true;
                app(BookingService::class)->createReservation($patient, $slot->public_id);
            }
        });
        try {
            $this->change($actor, $slot);
            $this->fail('Retry must see the newly committed booking.');
        } catch (DomainException) {
            $this->assertSame(1, $attempts);
            $this->assertSame(1000, $slot->fresh()->price);
            $this->assertSame(1000, $slot->reservations()->sole()->price_snapshot);
            $this->assertDatabaseCount('reservation_payment_summaries', 1);
            $this->assertDatabaseCount('outbox_events', 1);
            $this->assertDatabaseCount('audit_events', 0);
        }
    }

    public function test_cross_workplace_booking_blocks_overlapping_unreserved_occurrence(): void
    {
        [$actor, $slot] = $this->graph();
        app(BookingService::class)->createReservation(User::factory()->patient()->create(), $slot->public_id);
        $otherRule = DoctorWorkingWindow::factory()->create();
        $otherRule->workplace->forceFill(['doctor_profile_id' => $slot->workplace->doctor_profile_id])->save();
        $overlap = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $otherRule->id,
            'starts_at' => $slot->starts_at, 'ends_at' => $slot->ends_at, 'price' => 1000]);
        try {
            $this->change($actor, $overlap);
            $this->fail('A blocking doctor range must remain protected across workplaces.');
        } catch (DomainException) {
            $this->assertSame(1000, $overlap->fresh()->price);
            $this->assertTrue($overlap->fresh()->is_active);
            $this->assertDatabaseCount('audit_events', 0);
        }
    }

    public function test_oversized_range_refuses_before_any_target_change(): void
    {
        [$actor, $slot, $rule] = $this->graph();
        for ($i = 1; $i <= 250; $i++) {
            DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id,
                'starts_at' => $slot->starts_at->copy()->addMinutes($i),
                'ends_at' => $slot->ends_at->copy()->addMinutes($i), 'price' => 1000]);
        }
        try {
            $this->change($actor, $slot, 'day');
            $this->fail('Bounded range must refuse more than 250 candidates.');
        } catch (DomainException $error) {
            $this->assertStringContainsString('250', $error->getMessage());
            $this->assertSame([1000], DoctorVisitSlot::pluck('price')->unique()->values()->all());
            $this->assertDatabaseCount('audit_events', 0);
        }
    }
}
