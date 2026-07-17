<?php

namespace Tests\Feature\Database;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use App\Services\BookingService;
use App\Services\SchedulingService;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationBookingPaymentSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_and_payment_baseline_replaces_legacy_tables(): void
    {
        $this->assertFalse(Schema::hasTable('checkup_doctor'));
        $this->assertFalse(Schema::hasTable('payments'));
        $this->assertTrue(Schema::hasTable('doctor_workplace_checkup'));
        $this->assertTrue(Schema::hasTable('doctor_working_windows'));
        $this->assertTrue(Schema::hasTable('reservation_schedule_changes'));
        $this->assertTrue(Schema::hasTable('reservation_payment_summaries'));
        $this->assertTrue(Schema::hasTable('payment_attempts'));
        $this->assertTrue(Schema::hasTable('payment_provider_events'));
        $this->assertTrue(Schema::hasTable('payment_adjustments'));

        $this->assertTrue(Schema::hasColumns('reservations', [
            'public_id',
            'doctor_workplace_id',
            'duration_minutes',
            'timezone',
            'hold_expires_at',
            'hospital_name_snapshot',
            'doctor_name_snapshot',
            'checkup_title_snapshot',
            'price_snapshot',
            'currency_snapshot',
            'cancelled_at',
            'completed_at',
            'expired_at',
        ]));
    }

    public function test_booking_creates_a_live_hold_snapshot_and_one_payment_summary(): void
    {
        [$patient, $doctor, $workplace, $checkup] = $this->bookableGraph();
        $start = $this->futureMonday();

        [$reservation, $summary] = app(BookingService::class)->createReservation(
            user: $patient,
            checkup: $checkup,
            doctor: $doctor,
            start: $start,
            durationMinutes: 30,
            workplace: $workplace,
            idempotencyKey: 'booking-foundation-test'
        );

        $this->assertSame(ReservationStatus::Pending, $reservation->status);
        $this->assertTrue($reservation->hold_expires_at->between(now()->addMinutes(59), now()->addMinutes(61)));
        $this->assertSame('Foundation Hospital', $reservation->hospital_name_snapshot);
        $this->assertSame($doctor->user->name, $reservation->doctor_name_snapshot);
        $this->assertSame($checkup->title, $reservation->checkup_title_snapshot);
        $this->assertSame($checkup->price, $reservation->price_snapshot);
        $this->assertSame($checkup->currency, $reservation->currency_snapshot);
        $this->assertSame($reservation->id, $summary->reservation_id);
        $this->assertDatabaseCount('reservation_payment_summaries', 1);
        $this->assertDatabaseCount('payment_attempts', 0);
    }

    public function test_only_live_pending_or_confirmed_reservations_block_a_slot(): void
    {
        [$patient, $doctor, $workplace, $checkup] = $this->bookableGraph();
        $start = $this->futureMonday();
        $end = $start->copy()->addMinutes(30);
        $base = $this->reservationAttributes($patient, $doctor, $workplace, $checkup, $start);

        Reservation::query()->create(array_merge($base, [
            'status' => ReservationStatus::Pending,
            'hold_expires_at' => now()->subMinute(),
        ]));

        $this->assertFalse(SchedulingService::hasConflict($doctor->id, $start, $end));

        Reservation::query()->create(array_merge($base, [
            'booking_idempotency_key' => 'second-hold',
            'status' => ReservationStatus::Pending,
            'hold_expires_at' => now()->addHour(),
        ]));

        $this->assertTrue(SchedulingService::hasConflict($doctor->id, $start, $end));
    }

    public function test_payment_summary_allows_retries_but_rejects_duplicate_provider_idempotency(): void
    {
        [$patient, $doctor, $workplace, $checkup] = $this->bookableGraph();
        [$reservation, $summary] = app(BookingService::class)->createReservation(
            $patient,
            $checkup,
            $doctor,
            $this->futureMonday(),
            30,
            $workplace
        );

        PaymentAttempt::query()->create([
            'payment_summary_id' => $summary->id,
            'reservation_id' => $reservation->id,
            'provider' => 'sandbox',
            'idempotency_key' => 'attempt-1',
            'amount' => $summary->amount,
            'currency' => $summary->currency,
        ]);
        PaymentAttempt::query()->create([
            'payment_summary_id' => $summary->id,
            'reservation_id' => $reservation->id,
            'provider' => 'sandbox',
            'idempotency_key' => 'attempt-2',
            'amount' => $summary->amount,
            'currency' => $summary->currency,
        ]);

        $this->assertDatabaseCount('reservation_payment_summaries', 1);
        $this->assertDatabaseCount('payment_attempts', 2);

        $this->expectException(QueryException::class);

        PaymentAttempt::query()->create([
            'payment_summary_id' => $summary->id,
            'reservation_id' => $reservation->id,
            'provider' => 'sandbox',
            'idempotency_key' => 'attempt-2',
            'amount' => $summary->amount,
            'currency' => $summary->currency,
        ]);
    }

    /**
     * @return array{User, DoctorProfile, DoctorWorkplace, Checkup}
     */
    private function bookableGraph(): array
    {
        $patient = User::factory()->create();
        $doctorUser = User::factory()->create(['name' => 'Foundation Doctor']);
        $specialty = Specialty::query()->create([
            'name' => 'Foundation Specialty '.uniqid(),
            'slug' => 'foundation-specialty-'.uniqid(),
        ]);
        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'verified' => true,
        ]);
        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Foundation Hospital',
            'slug' => 'foundation-hospital-'.uniqid(),
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $category = CheckupCategory::query()->create([
            'name' => 'Foundation Category',
            'slug' => 'foundation-category-'.uniqid(),
        ]);
        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => 'Foundation Checkup',
            'slug' => 'foundation-checkup-'.uniqid(),
            'price' => 750_000,
        ]);
        $workplace->checkups()->attach($checkup->id);
        DoctorWorkingWindow::query()->create([
            'doctor_workplace_id' => $workplace->id,
            'weekday' => Carbon::MONDAY,
            'starts_at' => '09:00',
            'ends_at' => '12:00',
        ]);

        return [$patient, $doctor, $workplace, $checkup];
    }

    /**
     * @return array<string, mixed>
     */
    private function reservationAttributes(
        User $patient,
        DoctorProfile $doctor,
        DoctorWorkplace $workplace,
        Checkup $checkup,
        Carbon $start
    ): array {
        return [
            'user_id' => $patient->id,
            'doctor_profile_id' => $doctor->id,
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'starts_at' => $start,
            'ends_at' => $start->copy()->addMinutes(30),
            'duration_minutes' => 30,
            'timezone' => 'Asia/Tehran',
            'booking_idempotency_key' => 'first-hold',
            'hospital_name_snapshot' => $workplace->hospital->name,
            'doctor_name_snapshot' => $doctor->user->name,
            'checkup_title_snapshot' => $checkup->title,
            'price_snapshot' => $checkup->price,
            'currency_snapshot' => $checkup->currency,
        ];
    }

    private function futureMonday(): Carbon
    {
        return Carbon::now()->addWeeks(2)->startOfWeek(Carbon::MONDAY)->setTime(10, 0);
    }
}
