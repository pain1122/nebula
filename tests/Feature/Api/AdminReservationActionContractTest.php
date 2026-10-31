<?php

namespace Tests\Feature\Api;

use App\Models\DoctorVisitSlot;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Support\ReservationRevision;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class AdminReservationActionContractTest extends TestCase
{
    use IsolatedProfileApplication;
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated reservation-action contract only.');
        }
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-13T10:00:00Z'));
    }

    public function test_admin_root_eligibility_is_current_private_and_read_only(): void
    {
        $reservation = $this->reservation();
        $before = $this->fingerprints();
        foreach ([User::factory()->admin()->create(), User::factory()->rootAdmin()->create()] as $actor) {
            $response = $this->actingAs($actor, 'sanctum')->getJson($this->path($reservation))->assertOk();
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            $this->assertMatchesRegularExpression('/\A[a-f0-9]{64}\z/', $response->json('data.actions.revision'));
            $this->assertTrue($response->json('data.actions.can_reschedule'));
            $this->assertSame($actor->isRootAdmin() ? ['cancelled'] : [], $response->json('data.actions.allowed_statuses'));
            $response->assertJsonMissingPath('data.files')->assertJsonMissingPath('data.notes')
                ->assertJsonMissingPath('data.payment.successful_attempt_id')->assertJsonPath('data.patient.email', null);
        }
        $this->assertSame($before, $this->fingerprints());
    }

    public function test_patient_doctor_and_guest_cannot_read_admin_action_slots(): void
    {
        $reservation = $this->reservation();
        $this->getJson($this->slotPath($reservation))->assertUnauthorized();
        foreach ([User::factory()->patient()->create(), $reservation->doctor->user] as $actor) {
            $this->actingAs($actor, 'sanctum')->getJson($this->slotPath($reservation))->assertForbidden();
            $this->getJson($this->path($reservation))->assertForbidden();
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_slots_exclude_current_inactive_past_other_offerings_and_blocking_conflicts(): void
    {
        $reservation = $this->reservation();
        $available = $this->slot($reservation, '2026-10-14T06:00:00Z');
        $this->slot($reservation, '2026-10-12T06:00:00Z');
        $inactive = $this->slot($reservation, '2026-10-14T07:00:00Z');
        $inactive->update(['is_active' => false]);
        $blocked = $this->slot($reservation, '2026-10-14T08:00:00Z');
        $this->block($reservation, $blocked, ReservationStatus::Confirmed);
        $held = $this->slot($reservation, '2026-10-14T09:00:00Z');
        $this->block($reservation, $held, ReservationStatus::Pending);
        DoctorVisitSlot::factory()->create(['starts_at' => $available->starts_at, 'ends_at' => $available->ends_at]);
        $before = $this->fingerprints();
        $response = $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson($this->slotPath($reservation))->assertOk()->assertJsonPath('data.pagination.total', 1);
        $this->assertSame([$available->public_id], array_column($response->json('data.items'), 'slot_id'));
        $this->assertSame(['slot_id', 'starts_at', 'ends_at', 'duration_minutes'], array_keys($response->json('data.items.0')));
        $this->assertSame($reservation->price_snapshot, $response->json('data.booked_amount'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertSame($before, $this->fingerprints());
    }

    public function test_slots_ignore_current_reservation_and_expired_or_cancelled_holds(): void
    {
        $reservation = $this->reservation();
        $overlap = $this->slot($reservation, '2026-10-14T05:15:00Z');
        $expired = $this->slot($reservation, '2026-10-14T07:00:00Z');
        $this->block($reservation, $expired, ReservationStatus::Pending)->update(['hold_expires_at' => now()->subSecond()]);
        $cancelled = $this->slot($reservation, '2026-10-14T08:00:00Z');
        $this->block($reservation, $cancelled, ReservationStatus::Cancelled);
        $response = $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson($this->slotPath($reservation))->assertOk();
        $this->assertSame([$overlap->public_id, $expired->public_id, $cancelled->public_id], array_column($response->json('data.items'), 'slot_id'));
    }

    public function test_slot_days_are_inclusive_tehran_dates_and_pages_are_stable(): void
    {
        $reservation = $this->reservation();
        $this->slot($reservation, '2026-10-13T20:29:59Z');
        $first = $this->slot($reservation, '2026-10-13T20:30:00Z');
        $second = $this->slot($reservation, '2026-10-14T20:29:59Z');
        $this->slot($reservation, '2026-10-14T20:30:00Z');
        $this->actingAs(User::factory()->admin()->create(), 'sanctum');
        $base = $this->path($reservation).'/reschedule-slots?from=2026-10-14&to=2026-10-14&per_page=1';
        $this->getJson($base)->assertOk()->assertJsonPath('data.pagination.total', 2)
            ->assertJsonPath('data.items.0.slot_id', $first->public_id);
        $this->getJson($base.'&page=2')->assertOk()->assertJsonPath('data.items.0.slot_id', $second->public_id);
    }

    public function test_slot_reader_rejects_unbounded_malformed_and_forged_scope_queries(): void
    {
        $reservation = $this->reservation();
        $this->actingAs(User::factory()->admin()->create(), 'sanctum');
        foreach (['from[]=2026-10-14&to=2026-10-14', 'from=2026-10-14&to[]=2026-10-14', 'from=2026-02-30&to=2026-10-14',
            'from=2026-10-14&to=2026-10-13', 'from=2026-10-14&to=2026-11-14',
            'from=2026-10-14&to=2026-10-14&per_page=101', 'from=2026-10-14&to=2026-10-14&page=1001',
            'from=2026-10-14&to=2026-10-14&doctor_id=1'] as $query) {
            $this->getJson($this->path($reservation).'/reschedule-slots?'.$query)->assertUnprocessable();
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_terminal_expired_hold_and_inactive_offering_are_truthfully_unavailable(): void
    {
        $reservation = $this->reservation();
        $this->actingAs(User::factory()->rootAdmin()->create(), 'sanctum');
        $reservation->update(['hold_expires_at' => now()->subSecond()]);
        $this->getJson($this->path($reservation))->assertOk()->assertJsonPath('data.actions.can_reschedule', false)
            ->assertJsonPath('data.actions.allowed_statuses', ['cancelled', 'expired']);
        $this->getJson($this->slotPath($reservation))->assertUnprocessable();
        $reservation->update(['status' => ReservationStatus::Completed]);
        $this->getJson($this->path($reservation))->assertOk()->assertJsonPath('data.actions.allowed_statuses', []);
        $other = $this->reservation();
        $other->doctor->update(['verified' => false]);
        $this->getJson($this->path($other))->assertOk()->assertJsonPath('data.actions.can_reschedule', false);
        $this->getJson($this->slotPath($other))->assertUnprocessable();
    }

    public function test_override_requires_password_revision_reason_and_root_without_unknown_fields(): void
    {
        $reservation = $this->reservation();
        $root = User::factory()->rootAdmin()->create();
        $this->stateful($root)->putJson($this->path($reservation).'/status', [])->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        $this->putJson($this->path($reservation).'/status', ['status' => 'cancelled', 'reason' => 'Synthetic rejection.'])
            ->assertUnprocessable()->assertJsonValidationErrors('expected_revision');
        $payload = ['status' => 'cancelled', 'reason' => 'Synthetic ordinary cancellation.',
            'expected_revision' => $this->revision($reservation)];
        $this->putJson($this->path($reservation).'/status', $payload + ['password' => null])->assertUnprocessable();
        $this->stateful(User::factory()->admin()->create())->withSession(['auth.password_confirmed_at' => time()])
            ->putJson($this->path($reservation).'/status', $payload)->assertForbidden();
        $this->stateful($root)->withSession(['auth.password_confirmed_at' => time()])
            ->putJson($this->path($reservation).'/status', $payload)->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->putJson($this->path($reservation).'/status', $payload)->assertStatus(409)->assertJsonPath('code', 'conflict');
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_revision_rejects_payment_changes_and_same_second_state_reversion(): void
    {
        $reservation = $this->reservation();
        $original = $reservation->fresh()->getAttributes();
        $revision = $this->revision($reservation);
        $this->stateful(User::factory()->rootAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
        $reservation->payment->update(['status' => 'reconciliation']);
        $this->putJson($this->path($reservation).'/status', ['status' => 'cancelled', 'reason' => 'Synthetic stale money.',
            'expected_revision' => $revision])->assertStatus(409);
        $this->assertSame($original, $reservation->fresh()->getAttributes());
        $reservation->payment->update(['status' => 'unpaid']);
        $fresh = $this->revision($reservation);
        $this->putJson($this->path($reservation).'/status', ['status' => 'cancelled', 'reason' => 'Synthetic same-second change.',
            'expected_revision' => $fresh])->assertOk();
        // Isolated fixture restores the row; append-only audit still invalidates its old token.
        DB::table('reservations')->where('id', $reservation->id)->update($original);
        $this->assertNotSame($fresh, $this->revision($reservation));
        $this->putJson($this->path($reservation).'/status', ['status' => 'cancelled', 'reason' => 'Synthetic stale replay.',
            'expected_revision' => $fresh])->assertStatus(409);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_reschedule_preserves_money_returns_safe_detail_and_rejects_duplicate_delivery(): void
    {
        $reservation = $this->reservation();
        $slot = $this->slot($reservation, '2026-10-14T07:00:00Z');
        $slot->update(['price' => 9999999]);
        $payment = $reservation->payment->getAttributes();
        $payload = ['slot_id' => $slot->public_id, 'reason' => 'Synthetic supported slot move.',
            'expected_revision' => $this->revision($reservation)];
        $this->stateful(User::factory()->admin()->create())->withSession(['auth.password_confirmed_at' => time()]);
        $this->putJson($this->path($reservation).'/schedule', $payload + ['price' => null])->assertUnprocessable();
        $response = $this->putJson($this->path($reservation).'/schedule', $payload)->assertOk()
            ->assertJsonPath('data.booked_amount', $reservation->price_snapshot)
            ->assertJsonMissingPath('data.schedule_changes')->assertJsonMissingPath('data.payment.successful_attempt_id');
        $this->assertNotSame($payload['expected_revision'], $response->json('data.actions.revision'));
        $this->assertSame($payment, $reservation->payment()->firstOrFail()->getAttributes());
        $this->putJson($this->path($reservation).'/schedule', $payload)->assertStatus(409);
        $this->assertDatabaseCount('reservation_schedule_changes', 1);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_slot_read_is_advisory_and_a_new_conflict_refuses_the_write(): void
    {
        $reservation = $this->reservation();
        $slot = $this->slot($reservation, '2026-10-14T07:00:00Z');
        $this->stateful(User::factory()->admin()->create())->withSession(['auth.password_confirmed_at' => time()]);
        $this->getJson($this->slotPath($reservation))->assertOk()->assertJsonPath('data.items.0.slot_id', $slot->public_id);
        $revision = $this->revision($reservation);
        $this->block($reservation, $slot, ReservationStatus::Confirmed);
        $before = $this->fingerprints();
        $this->putJson($this->path($reservation).'/schedule', ['slot_id' => $slot->public_id,
            'reason' => 'Synthetic concurrent availability change.', 'expected_revision' => $revision])->assertUnprocessable();
        $this->assertSame($before, $this->fingerprints());
    }

    public function test_a_removed_offering_after_slot_read_refuses_without_schedule_or_audit_writes(): void
    {
        foreach (['inactive', 'deleted'] as $change) {
            $reservation = $this->reservation();
            $slot = $this->slot($reservation, '2026-10-14T07:00:00Z');
            $this->stateful(User::factory()->admin()->create())->withSession(['auth.password_confirmed_at' => time()]);
            $this->getJson($this->slotPath($reservation))->assertOk()->assertJsonPath('data.items.0.slot_id', $slot->public_id);
            $revision = $this->revision($reservation);
            if ($change === 'inactive') {
                $reservation->checkup->forceFill(['is_active' => false])->save();
            } else {
                $reservation->checkup->delete();
            }
            $before = $this->fingerprints();
            $this->putJson($this->path($reservation).'/schedule', ['slot_id' => $slot->public_id,
                'reason' => 'Synthetic offering changed.', 'expected_revision' => $revision])->assertUnprocessable();
            $this->assertSame($before, $this->fingerprints());
        }
    }

    private function reservation(): Reservation
    {
        $start = CarbonImmutable::parse('2026-10-14T05:00:00Z');
        $slot = DoctorVisitSlot::factory()->create(['starts_at' => $start, 'ends_at' => $start->addMinutes(30)]);
        $reservation = Reservation::factory()->create(['doctor_visit_slot_id' => $slot->id]);
        Payment::factory()->create(['reservation_id' => $reservation->id, 'status' => 'unpaid']);

        return $reservation->fresh(['payment']);
    }

    private function slot(Reservation $reservation, string $time): DoctorVisitSlot
    {
        $start = CarbonImmutable::parse($time);

        return DoctorVisitSlot::factory()->create([
            'doctor_working_window_id' => $reservation->visitSlot->doctor_working_window_id,
            'doctor_workplace_id' => $reservation->doctor_workplace_id, 'checkup_id' => $reservation->checkup_id,
            'starts_at' => $start, 'ends_at' => $start->addMinutes(30),
        ]);
    }

    private function block(Reservation $original, DoctorVisitSlot $slot, ReservationStatus $status): Reservation
    {
        return Reservation::factory()->create([
            'doctor_visit_slot_id' => $slot->id, 'doctor_profile_id' => $original->doctor_profile_id,
            'doctor_workplace_id' => $original->doctor_workplace_id, 'checkup_id' => $original->checkup_id,
            'starts_at' => $slot->starts_at, 'ends_at' => $slot->ends_at, 'status' => $status,
        ]);
    }

    private function path(Reservation $reservation): string
    {
        return '/api/admin/reservations/'.$reservation->id;
    }

    private function slotPath(Reservation $reservation): string
    {
        return $this->path($reservation).'/reschedule-slots?from=2026-10-13&to=2026-10-15';
    }

    private function revision(Reservation $reservation): string
    {
        $fresh = $reservation->fresh(['payment']);

        return ReservationRevision::token($fresh, $fresh->payment);
    }

    private function stateful(User $actor): static
    {
        return $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withHeader('Referer', 'http://localhost:3000');
    }

    private function fingerprints(): array
    {
        $hashes = [];
        foreach (['reservations', 'reservation_payment_summaries', 'reservation_schedule_changes', 'audit_events', 'outbox_events', 'jobs'] as $table) {
            $hashes[$table] = hash('sha256', json_encode(DB::table($table)->orderBy('id')->get(), JSON_THROW_ON_ERROR));
        }

        return $hashes;
    }
}
