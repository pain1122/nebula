<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BookingPaymentRiskTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_requires_checkup_doctor_pivot_membership(): void
    {
        $patient = $this->patientUser();
        [$checkup, $doctor] = $this->bookablePair(attachPivot: false);

        $this
            ->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations', ['slot_id' => (string) Str::ulid()])
            ->assertStatus(422);

        $this->assertDatabaseCount('reservations', 0);
        $this->assertDatabaseCount('reservation_payment_summaries', 0);
    }

    public function test_booking_requires_a_generated_future_slot(): void
    {
        $patient = $this->patientUser();
        [, , $slot] = $this->bookablePair(attachPivot: true);

        $this
            ->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations', ['slot_id' => (string) Str::ulid()])
            ->assertStatus(422);

        $pastSlot = DoctorVisitSlot::query()->create([
            'doctor_working_window_id' => $slot->doctor_working_window_id,
            'doctor_workplace_id' => $slot->doctor_workplace_id,
            'checkup_id' => $slot->checkup_id,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->subDay()->addMinutes(30),
            'price' => $slot->price,
            'currency' => $slot->currency,
        ]);

        $this
            ->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations', ['slot_id' => $pastSlot->public_id])
            ->assertStatus(422);

        $this->assertDatabaseCount('reservations', 0);
        $this->assertDatabaseCount('reservation_payment_summaries', 0);
    }

    public function test_admin_cannot_mark_unpaid_reservation_as_paid_without_verified_payment(): void
    {
        $rootAdmin = User::factory()->rootAdmin()->create();
        [$checkup, $doctor, $slot] = $this->bookablePair(attachPivot: true);
        $patient = $this->patientUser();

        $reservation = Reservation::query()->create([
            'doctor_visit_slot_id' => $slot->id,
            'user_id' => $patient->id,
            'doctor_profile_id' => $doctor->id,
            'doctor_workplace_id' => $doctor->workplaces()->value('id'),
            'checkup_id' => $checkup->id,
            'starts_at' => $this->futureMonday(),
            'ends_at' => $this->futureMonday()->addMinutes(30),
            'duration_minutes' => 30,
            'timezone' => 'Asia/Tehran',
            'hold_expires_at' => now()->addHour(),
            'hospital_name_snapshot' => 'Test Hospital',
            'doctor_name_snapshot' => $doctor->user->name,
            'checkup_title_snapshot' => $checkup->title,
            'price_snapshot' => $checkup->price,
            'currency_snapshot' => 'IRR',
            'status' => ReservationStatus::Pending,
        ]);

        Payment::query()->create([
            'reservation_id' => $reservation->id,
            'amount' => $checkup->price,
            'currency' => 'IRR',
            'status' => 'unpaid',
            'provider' => 'stripe',
        ]);

        $this
            ->actingAs($rootAdmin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/reservations/'.$reservation->id.'/status', [
                'status' => ReservationStatus::Confirmed->value,
                'reason' => 'Confirm only after a verified payment',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.status.0', 'invalid_transition');

        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => ReservationStatus::Pending->value,
        ]);
    }

    public function test_patient_cannot_cancel_another_patients_reservation(): void
    {
        $owner = $this->patientUser();
        $attacker = $this->patientUser();
        $reservation = Reservation::factory()->for($owner)->create();

        $this
            ->actingAs($attacker, 'sanctum')
            ->postJson('/api/reservations/'.$reservation->id.'/cancel')
            ->assertNotFound();

        $this->assertSame(
            ReservationStatus::Pending,
            $reservation->fresh()->status
        );
    }

    public function test_client_cannot_inject_reservation_ownership_or_state(): void
    {
        $patient = $this->patientUser();
        $otherPatient = $this->patientUser();
        [$checkup, $doctor, $slot] = $this->bookablePair(attachPivot: true);

        $response = $this
            ->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations', $this->reservationPayload(
                $slot,
                [
                    'user_id' => $otherPatient->id,
                    'tenant_id' => 999,
                    'status' => ReservationStatus::Completed->value,
                    'price_snapshot' => 1,
                ]
            ))
            ->assertCreated();

        $reservation = Reservation::query()->findOrFail(
            $response->json('data.reservation.id')
        );

        $this->assertSame($patient->id, $reservation->user_id);
        $this->assertSame(ReservationStatus::Pending, $reservation->status);
        $this->assertSame($checkup->price, $reservation->price_snapshot);
    }

    public function test_active_hold_cap_is_enforced_after_idempotent_retries_are_resolved(): void
    {
        config(['payments.max_active_holds_per_user' => 1]);
        $patient = $this->patientUser();
        [, , $slot, $secondSlot] = $this->bookablePair(attachPivot: true);
        $payload = $this->reservationPayload($slot);

        $this->actingAs($patient, 'sanctum')
            ->withHeader('Idempotency-Key', 'hold-cap-first-request')
            ->withHeader('X-Device-ID', 'test-device')
            ->postJson('/api/reservations', $payload)
            ->assertCreated();

        $this->actingAs($patient, 'sanctum')
            ->withHeader('Idempotency-Key', 'hold-cap-first-request')
            ->withHeader('X-Device-ID', 'test-device')
            ->postJson('/api/reservations', $payload)
            ->assertCreated();

        $this->actingAs($patient, 'sanctum')
            ->withHeader('Idempotency-Key', 'hold-cap-second-request')
            ->withHeader('X-Device-ID', 'test-device')
            ->postJson('/api/reservations', $this->reservationPayload($secondSlot))
            ->assertUnprocessable()
            ->assertJsonPath('errors.reservation.0', 'active_hold_limit_reached');

        $this->assertDatabaseCount('reservations', 1);
    }

    private function patientUser(): User
    {
        $patient = User::factory()->create();
        $patient->syncRoles([UserRole::Patient->value]);

        return $patient;
    }

    /**
     * @return array{0: Checkup, 1: DoctorProfile, 2: DoctorVisitSlot|null, 3: DoctorVisitSlot|null}
     */
    private function bookablePair(bool $attachPivot): array
    {
        $specialty = Specialty::query()->create([
            'name' => 'Cardiology',
            'slug' => 'cardiology-'.uniqid(),
            'level' => 0,
        ]);

        $category = CheckupCategory::query()->create([
            'name' => 'Cardiology checkups',
            'slug' => 'cardiology-checkups-'.uniqid(),
            'description' => null,
        ]);

        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => 'Heart screening',
            'slug' => 'heart-screening-'.uniqid(),
            'description' => null,
            'price' => 100000,
        ]);

        $doctorUser = User::factory()->create();
        $doctorUser->syncRoles([UserRole::Doctor->value]);

        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'phone' => '021'.random_int(10000000, 99999999),
            'experience_years' => 5,
            'fee' => 50000,
            'bio' => null,
            'availability' => [
                ['day' => 'mon', 'slots' => [['09:00', '12:00']]],
            ],
            'verified' => true,
        ]);

        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Test Hospital',
            'slug' => 'test-hospital-'.uniqid(),
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $slot = null;
        $secondSlot = null;
        if ($attachPivot) {
            $workplace->checkups()->attach($checkup->id);
            $rule = DoctorWorkingWindow::query()->create([
                'doctor_workplace_id' => $workplace->id,
                'checkup_id' => $checkup->id,
                'weekday' => Carbon::MONDAY,
                'starts_at' => '10:00',
                'ends_at' => '10:30',
            ]);
            $slot = DoctorVisitSlot::query()->create([
                'doctor_working_window_id' => $rule->id,
                'doctor_workplace_id' => $workplace->id,
                'checkup_id' => $checkup->id,
                'starts_at' => $this->futureMonday(),
                'ends_at' => $this->futureMonday()->addMinutes(30),
                'price' => $checkup->price,
                'currency' => $checkup->currency,
            ]);
            $secondSlot = DoctorVisitSlot::query()->create([
                'doctor_working_window_id' => $rule->id,
                'doctor_workplace_id' => $workplace->id,
                'checkup_id' => $checkup->id,
                'starts_at' => $this->futureMonday()->addMinutes(30),
                'ends_at' => $this->futureMonday()->addHour(),
                'price' => $checkup->price,
                'currency' => $checkup->currency,
            ]);
        }

        return [$checkup, $doctor, $slot, $secondSlot];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function reservationPayload(DoctorVisitSlot $slot, array $overrides = []): array
    {
        return array_merge([
            'slot_id' => $slot->public_id,
        ], $overrides);
    }

    private function futureMonday(): Carbon
    {
        return Carbon::now()
            ->addWeeks(2)
            ->startOfWeek(Carbon::MONDAY)
            ->setTime(10, 0);
    }
}
