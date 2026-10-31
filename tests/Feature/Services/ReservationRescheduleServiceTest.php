<?php

namespace Tests\Feature\Services;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\BookingService;
use App\Services\ReservationRescheduleService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class ReservationRescheduleServiceTest extends TestCase
{
    use IsolatedProfileApplication;
    use RefreshDatabase;

    public function test_revoked_cached_admin_authority_leaves_schedule_and_audit_unchanged(): void
    {
        $graph = $this->reservationGraph();
        $admin = User::factory()->admin()->create();
        $admin->load('roles');
        User::query()->findOrFail($admin->id)->syncRoles(['patient']);
        $this->assertTrue($admin->canAccessAdminPanel());
        $this->assertAuthorityRejected($graph, $admin);
    }

    public function test_revoked_cached_doctor_role_cannot_authorize_an_assigned_reservation(): void
    {
        $graph = $this->reservationGraph();
        $doctor = $graph['doctor_user'];
        $doctor->load('roles');
        User::query()->findOrFail($doctor->id)->syncRoles(['patient']);
        $this->assertTrue($doctor->hasRole('doctor'));
        $this->assertAuthorityRejected($graph, $doctor);
    }

    public function test_suspended_and_closed_assigned_doctors_cannot_move_reservations(): void
    {
        foreach (['suspended', 'closed'] as $index => $state) {
            $graph = $this->reservationGraph($index + 2);
            User::query()->whereKey($graph['doctor_user']->id)->update(['account_state' => $state]);
            $this->assertTrue($graph['doctor_user']->permitsAuthentication());
            $this->assertAuthorityRejected($graph, $graph['doctor_user']);
        }
    }

    public function test_cached_original_assignment_cannot_authorize_a_reassigned_reservation(): void
    {
        $graph = $this->reservationGraph();
        $other = $this->reservationGraph(3);
        $graph['reservation']->load('doctor');
        Reservation::query()->whereKey($graph['reservation']->id)->update([
            'doctor_profile_id' => $other['doctor']->id,
        ]);
        $this->assertSame($graph['doctor_user']->id, $graph['reservation']->doctor->user_id);
        $this->assertAuthorityRejected($graph, $graph['doctor_user']);
    }

    public function test_admin_must_refresh_when_the_reservation_doctor_assignment_changed(): void
    {
        $graph = $this->reservationGraph();
        $other = $this->reservationGraph(3);
        Reservation::query()->whereKey($graph['reservation']->id)->update([
            'doctor_profile_id' => $other['doctor']->id,
        ]);
        $before = $graph['reservation']->fresh()->getAttributes();
        $auditCount = \App\Models\AuditEvent::query()->count();
        try {
            app(ReservationRescheduleService::class)->reschedule(
                Request::create('/api/admin/reservations/schedule', 'PUT'),
                User::factory()->admin()->create(),
                $graph['reservation'],
                $graph['replacement_slot']->public_id,
                'Synthetic reassignment rejection.',
            );
            $this->fail('A changed doctor assignment requires a fresh read.');
        } catch (DomainException $exception) {
            $this->assertSame('Reservation assignment changed; refresh before rescheduling.', $exception->getMessage());
            $this->assertSame($before, $graph['reservation']->fresh()->getAttributes());
            $this->assertDatabaseCount('reservation_schedule_changes', 0);
            $this->assertDatabaseCount('audit_events', $auditCount);
        }
    }

    /** @param array<string, mixed> $graph */
    private function assertAuthorityRejected(array $graph, User $actor): void
    {
        $before = $graph['reservation']->fresh()->getAttributes();
        $auditCount = \App\Models\AuditEvent::query()->count();
        $payment = $graph['reservation']->payment->getAttributes();
        try {
            app(ReservationRescheduleService::class)->reschedule(
                Request::create('/api/admin/reservations/schedule', 'PUT'),
                $actor,
                $graph['reservation'],
                $graph['replacement_slot']->public_id,
                'Synthetic authority rejection.',
            );
            $this->fail('Changed actor or assignment must be rejected under lock.');
        } catch (AuthorizationException) {
            $this->assertSame($before, $graph['reservation']->fresh()->getAttributes());
            $this->assertSame($payment, $graph['reservation']->payment()->firstOrFail()->getAttributes());
            $this->assertDatabaseCount('reservation_schedule_changes', 0);
            $this->assertDatabaseCount('audit_events', $auditCount);
        }
    }

    public function test_assigned_doctor_moves_by_slot_id_and_preserves_all_money_facts(): void
    {
        $graph = $this->reservationGraph();
        $originalPayment = $graph['reservation']->payment;
        $graph['replacement_slot']->update(['price' => 2_000_000]);

        $rescheduled = $this->reschedule($graph, $graph['doctor_user'], 'Doctor selected the replacement slot.');

        $this->assertSame($graph['replacement_slot']->id, $rescheduled->doctor_visit_slot_id);
        $this->assertTrue($rescheduled->starts_at->equalTo($graph['replacement_slot']->starts_at));
        $this->assertSame(75, $rescheduled->duration_minutes);
        $this->assertSame(1_200_000, $rescheduled->price_snapshot);
        $this->assertSame('IRR', $rescheduled->currency_snapshot);
        $this->assertSame($originalPayment->id, $rescheduled->payment->id);
        $this->assertSame($originalPayment->amount, $rescheduled->payment->amount);
        $this->assertSame($originalPayment->status, $rescheduled->payment->status);
        $this->assertDatabaseHas('reservation_schedule_changes', [
            'reservation_id' => $rescheduled->id,
            'actor_id' => $graph['doctor_user']->id,
            'previous_doctor_visit_slot_id' => $graph['original_slot']->id,
            'new_doctor_visit_slot_id' => $graph['replacement_slot']->id,
            'previous_duration_minutes' => 30,
            'new_duration_minutes' => 75,
            'reason' => 'Doctor selected the replacement slot.',
        ]);
        $this->assertDatabaseHas('audit_events', [
            'action' => 'reservation.rescheduled',
            'subject_id' => $rescheduled->id,
        ]);
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_admin_is_authorized_but_patient_is_not(): void
    {
        $graph = $this->reservationGraph();
        $admin = User::factory()->admin()->create();

        $rescheduled = $this->reschedule($graph, $admin, 'Admin selected a replacement slot.');
        $this->assertSame($graph['replacement_slot']->id, $rescheduled->doctor_visit_slot_id);

        $secondGraph = $this->reservationGraph(3);
        $this->expectException(AuthorizationException::class);
        $this->reschedule($secondGraph, $secondGraph['patient'], 'Patient attempted a move.');
    }

    public function test_confirmed_reservation_can_move_without_conflicting_with_itself(): void
    {
        $graph = $this->reservationGraph();
        $graph['reservation']->forceFill([
            'status' => ReservationStatus::Confirmed,
            'hold_expires_at' => null,
        ])->save();
        $graph['reservation']->payment->forceFill(['status' => 'paid'])->save();

        $rescheduled = $this->reschedule($graph, $graph['doctor_user'], 'Confirmed visit replacement.');

        $this->assertSame(ReservationStatus::Confirmed, $rescheduled->status);
        $this->assertSame($graph['replacement_slot']->id, $rescheduled->doctor_visit_slot_id);
        $this->assertSame('paid', $rescheduled->payment->status->value);
    }

    public function test_terminal_past_and_inactive_offering_moves_are_rejected(): void
    {
        $terminal = $this->reservationGraph();
        $terminal['reservation']->forceFill(['status' => ReservationStatus::Cancelled])->save();
        $this->assertRejected($terminal);

        $past = $this->reservationGraph(3);
        $pastSlot = DoctorVisitSlot::query()->create([
            'doctor_working_window_id' => $past['replacement_slot']->doctor_working_window_id,
            'doctor_workplace_id' => $past['workplace']->id,
            'checkup_id' => $past['checkup']->id,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->subDay()->addMinutes(75),
            'price' => 1_200_000,
            'currency' => 'IRR',
        ]);
        $past['replacement_slot'] = $pastSlot;
        $this->assertRejected($past);

        $inactive = $this->reservationGraph(4);
        $inactive['workplace']->checkups()->updateExistingPivot($inactive['checkup']->id, ['is_active' => false]);
        $this->assertRejected($inactive);
    }

    public function test_conflict_and_audit_failures_leave_schedule_history_unchanged(): void
    {
        $conflict = $this->reservationGraph();
        Reservation::factory()->create([
            'doctor_visit_slot_id' => $conflict['replacement_slot']->id,
            'doctor_profile_id' => $conflict['doctor']->id,
            'doctor_workplace_id' => $conflict['workplace']->id,
            'checkup_id' => $conflict['checkup']->id,
            'starts_at' => $conflict['replacement_slot']->starts_at,
            'ends_at' => $conflict['replacement_slot']->ends_at,
            'status' => ReservationStatus::Confirmed,
            'hold_expires_at' => null,
        ]);
        $this->assertRejected($conflict);
        $this->assertSame($conflict['original_slot']->id, $conflict['reservation']->fresh()->doctor_visit_slot_id);

        $audit = $this->reservationGraph(3);
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            $this->reschedule($audit, $audit['doctor_user'], 'This must roll back.');
            $this->fail('Expected audit failure to escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertSame($audit['original_slot']->id, $audit['reservation']->fresh()->doctor_visit_slot_id);
        $this->assertDatabaseCount('reservation_schedule_changes', 0);
    }

    /** @return array<string, mixed> */
    private function reservationGraph(int $weeksAhead = 2): array
    {
        $patient = User::factory()->patient()->create();
        $doctorUser = User::factory()->doctor()->create();
        $specialty = Specialty::query()->create(['name' => uniqid('Specialty '), 'slug' => uniqid('specialty-')]);
        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'verified' => true,
        ]);
        $hospital = MarketplaceHospital::query()->create([
            'name' => uniqid('Hospital '),
            'slug' => uniqid('hospital-'),
            'timezone' => 'Asia/Tehran',
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $category = CheckupCategory::query()->create(['name' => uniqid('Category '), 'slug' => uniqid('category-')]);
        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => uniqid('Checkup '),
            'slug' => uniqid('checkup-'),
            'price' => 1_000_000,
            'currency' => 'IRR',
        ]);
        $workplace->checkups()->attach($checkup->id, [
            'price_override' => 1_200_000,
            'currency_override' => 'IRR',
            'is_active' => true,
        ]);
        $originalStart = Carbon::now()->addWeeks($weeksAhead)->startOfWeek(Carbon::MONDAY)->setTime(10, 0);
        $replacementStart = $originalStart->copy()->setTime(11, 0);
        $originalRule = DoctorWorkingWindow::factory()->create([
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'weekday' => Carbon::MONDAY,
            'starts_at' => '10:00',
            'ends_at' => '10:30',
            'visit_duration_minutes' => 30,
        ]);
        $replacementRule = DoctorWorkingWindow::factory()->create([
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'weekday' => Carbon::MONDAY,
            'starts_at' => '11:00',
            'ends_at' => '12:15',
            'visit_duration_minutes' => 75,
        ]);
        $originalSlot = DoctorVisitSlot::query()->create([
            'doctor_working_window_id' => $originalRule->id,
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'starts_at' => $originalStart,
            'ends_at' => $originalStart->copy()->addMinutes(30),
            'price' => 1_200_000,
            'currency' => 'IRR',
        ]);
        $replacementSlot = DoctorVisitSlot::query()->create([
            'doctor_working_window_id' => $replacementRule->id,
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'starts_at' => $replacementStart,
            'ends_at' => $replacementStart->copy()->addMinutes(75),
            'price' => 1_500_000,
            'currency' => 'IRR',
        ]);
        [$reservation] = app(BookingService::class)->createReservation($patient, $originalSlot->public_id);

        return compact(
            'patient',
            'doctorUser',
            'doctor',
            'workplace',
            'checkup',
            'reservation',
            'originalSlot',
            'replacementSlot',
        ) + [
            'doctor_user' => $doctorUser,
            'original_slot' => $originalSlot,
            'replacement_slot' => $replacementSlot,
        ];
    }

    /** @param array<string, mixed> $graph */
    private function reschedule(array $graph, User $actor, string $reason): Reservation
    {
        return app(ReservationRescheduleService::class)->reschedule(
            Request::create('/api/reservations/schedule', 'PUT'),
            $actor,
            $graph['reservation']->fresh(),
            $graph['replacement_slot']->public_id,
            $reason,
        );
    }

    /** @param array<string, mixed> $graph */
    private function assertRejected(array $graph): void
    {
        try {
            $this->reschedule($graph, $graph['doctor_user'], 'Expected rejection.');
            $this->fail('Expected rescheduling to be rejected.');
        } catch (DomainException|AuthorizationException|ValidationException) {
            $this->assertTrue(true);
        }
    }
}
