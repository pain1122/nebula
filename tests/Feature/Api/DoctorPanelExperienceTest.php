<?php

namespace Tests\Feature\Api;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class DoctorPanelExperienceTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $environment = getenv('LARAVEL_STORAGE_PATH');
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
            || getenv('DB_URL') || posix_geteuid() !== 33 || ! is_string($environment)
            || ! str_starts_with($environment, '/tmp/checkupino-doctor-panel-') || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || ! is_dir($environment) || file_exists($environment.'/config.php') || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')
            || ! is_file($environment.'/empty.environment') || filesize($environment.'/empty.environment') !== 0) {
            throw new RuntimeException('Doctor panel tests require explicit SQLite memory, UID33, empty isolated environment and no project cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment)->loadEnvironmentFrom('empty.environment');
        $app->make(Kernel::class)->bootstrap();
        // Public synthetic key for isolated stateful fixtures only; no project key is read or changed.
        config(['app.key' => 'base64:'.base64_encode(str_repeat('i', 32))]);
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:' || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective isolated database guard failed before schema setup.');
        }

        return $app;
    }

    private function fixture(): array
    {
        config(['scheduling.materialization_days' => 7]);
        $this->travelTo(now()->setDate(2026, 10, 18)->startOfDay());
        $user = User::factory()->doctor()->create();
        $specialty = Specialty::factory()->create();
        $profile = DoctorProfile::factory()->create(['user_id' => $user->id, 'specialty_id' => $specialty->id, 'verified' => true]);
        $profile->specialties()->attach($specialty->id, ['is_primary' => true]);
        $hospital = MarketplaceHospital::factory()->create(['timezone' => 'Asia/Tehran']);
        $workplace = DoctorWorkplace::factory()->create(['doctor_profile_id' => $profile->id, 'marketplace_hospital_id' => $hospital->id]);
        $checkup = Checkup::factory()->create(['price' => 100000, 'currency' => 'IRR', 'description' => 'Synthetic service description']);
        $workplace->checkups()->attach($checkup->id, ['is_active' => true, 'price_override' => 120000, 'currency_override' => 'IRR']);

        return [$user, $profile, $workplace, $checkup];
    }

    private function stateful(User $actor): static
    {
        return $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withHeader('Referer', 'http://localhost:3000');
    }

    private function payload(): array
    {
        $data = $this->getJson('/api/doctor/practice')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data');

        return ['mode' => 'professional', ...$data['professional'], 'experience_years' => 12, 'expected_revision' => $data['revision'], 'confirmed' => true, 'reason' => 'Synthetic professional update'];
    }

    private function reservation(DoctorWorkplace $workplace, Checkup $checkup, string $status, bool $paid = true): Reservation
    {
        $rule = DoctorWorkingWindow::factory()->create(['doctor_workplace_id' => $workplace->id, 'checkup_id' => $checkup->id]);
        $slot = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'doctor_workplace_id' => $workplace->id, 'checkup_id' => $checkup->id, 'starts_at' => '2026-10-19 09:00:00', 'ends_at' => '2026-10-19 09:30:00']);
        $reservation = Reservation::factory()->create(['doctor_visit_slot_id' => $slot->id, 'status' => $status]);
        $payment = Payment::factory()->create(['reservation_id' => $reservation->id, 'status' => $paid ? 'paid' : 'unpaid']);
        if ($paid) {
            $attempt = PaymentAttempt::forceCreate(['payment_summary_id' => $payment->id, 'reservation_id' => $reservation->id, 'provider' => 'sandbox', 'idempotency_key' => (string) Str::uuid(), 'amount' => $payment->amount, 'currency' => $payment->currency, 'status' => 'succeeded']);
            $payment->forceFill(['successful_attempt_id' => $attempt->id])->save();
        }

        return $reservation;
    }

    public function test_calendar_returns_only_owned_confirmed_canonical_paid_appointments(): void
    {
        [$user, $profile, $workplace, $checkup] = $this->fixture();
        $own = $this->reservation($workplace, $checkup, 'confirmed');
        foreach (['pending', 'completed', 'cancelled', 'expired'] as $status) {
            $this->reservation($workplace, $checkup, $status);
        }
        $this->reservation($workplace, $checkup, 'confirmed', false);
        [, , $otherWorkplace, $otherCheckup] = $this->fixture();
        $this->reservation($otherWorkplace, $otherCheckup, 'confirmed');
        $url = '/api/doctor/dashboard/appointments?from=2026-10-01&until=2026-11-01';
        $response = $this->actingAs($user, 'sanctum')->getJson($url)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.owner_id', $user->id)->assertJsonCount(1, 'data.appointments')->assertJsonPath('data.appointments.0.public_id', $own->public_id)
            ->assertJsonPath('data.appointments.0.status', 'confirmed')->assertJsonPath('data.scope', 'doctor_confirmed');
        $response->assertJsonMissingPath('data.appointments.0.patient_email')->assertJsonMissingPath('data.appointments.0.user_id');
        $otherPayment = Payment::where('reservation_id', '!=', $own->id)->firstOrFail();
        $own->payment->successfulAttempt->forceFill(['payment_summary_id' => $otherPayment->id])->save();
        $this->getJson($url)->assertOk()->assertJsonPath('data.appointments', []);
        $this->getJson($url.'&doctor_id='.$profile->id)->assertUnprocessable();
        $this->getJson('/api/doctor/dashboard/appointments?from=2026-10-01&until=2026-12-01')->assertUnprocessable();
        foreach (['patient', 'admin', 'root-admin'] as $role) {
            $actor = User::factory()->create();
            $actor->syncRoles([$role]);
            $this->actingAs($actor, 'sanctum')->getJson($url)->assertForbidden();
        }
    }

    public function test_professional_save_requires_step_up_fresh_revision_confirmation_and_atomic_audit(): void
    {
        [$user, $profile] = $this->fixture();
        $this->stateful($user);
        $payload = $this->payload();
        $this->putJson('/api/doctor/practice', $payload)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        $this->putJson('/api/doctor/practice', [...$payload, 'confirmed' => false])->assertUnprocessable();
        $this->putJson('/api/doctor/practice', [...$payload, 'reason' => ' '])->assertUnprocessable();
        $this->putJson('/api/doctor/practice', [...$payload, 'verified' => true])->assertUnprocessable();
        $this->putJson('/api/doctor/profile', [...$payload, 'expected_revision' => str_repeat('0', 64)])->assertConflict();
        $saved = $this->putJson('/api/doctor/practice', $payload)->assertOk()->assertJsonPath('data.professional.experience_years', 12)->json('data');
        $this->assertNotSame($payload['expected_revision'], $saved['revision']);
        $this->assertTrue($profile->fresh()->verified);
        $this->assertSame(1, DB::table('audit_events')->where('action', 'doctor.practice.updated')->count());
        $this->putJson('/api/doctor/practice', $payload)->assertConflict();
        $next = [...$this->payload(), 'experience_years' => 13];
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit failure'));
        $this->putJson('/api/doctor/practice', $next)->assertStatus(500);
        $this->assertSame(12, $profile->fresh()->experience_years);
    }

    public function test_weekly_rules_keep_booked_slots_and_money_and_can_close_all_future_windows(): void
    {
        [$user, , $workplace, $checkup] = $this->fixture();
        $reservation = $this->reservation($workplace, $checkup, 'confirmed');
        $originalRule = DoctorWorkingWindow::findOrFail($reservation->visitSlot->doctor_working_window_id);
        $stable = $reservation->fresh()->getAttributes();
        $money = $reservation->payment->fresh()->getAttributes();
        $this->stateful($user)->withSession(['auth.password_confirmed_at' => time()]);
        $read = $this->getJson('/api/doctor/practice')->assertOk()->json('data');
        $selection = ['mode' => 'weekly', 'workplace_id' => $workplace->id, 'confirmed' => true, 'reason' => 'Synthetic weekly schedule', 'availability' => [['day' => 'mon', 'windows' => [['checkup_id' => $checkup->id, 'start' => '10:00', 'end' => '11:00', 'duration_minutes' => 30, 'breaks' => []]]]]];
        $saved = $this->putJson('/api/doctor/practice', $selection + ['expected_revision' => $read['revision']])->assertOk()->json('data');
        $this->assertSame('mon', $saved['workplaces'][0]['availability'][0]['day']);
        $this->assertSame($stable, $reservation->fresh()->getAttributes());
        $this->assertSame($money, $reservation->payment->fresh()->getAttributes());
        $this->putJson('/api/doctor/practice', [...$selection, 'expected_revision' => $saved['revision'], 'availability' => []])->assertOk()->assertJsonPath('data.workplaces.0.availability', []);
        $this->assertSame($stable, $reservation->fresh()->getAttributes());
        $this->assertTrue($reservation->visitSlot->fresh()->is_active);
        $this->assertFalse($originalRule->fresh()->is_active);
    }

    public function test_full_shift_lunch_and_sequential_service_breaks_materialize_real_appointments(): void
    {
        [$user, $profile, $workplace, $checkup] = $this->fixture();
        $second = Checkup::factory()->create(['price' => 200000, 'currency' => 'IRR']);
        $workplace->checkups()->attach($second->id, ['is_active' => true]);
        $this->stateful($user)->withSession(['auth.password_confirmed_at' => time()]);
        $revision = $this->getJson('/api/doctor/practice')->assertOk()->json('data.revision');
        $this->putJson('/api/doctor/practice', [
            'mode' => 'weekly', 'workplace_id' => $workplace->id, 'expected_revision' => $revision,
            'reason' => 'Synthetic full working day with lunch and two services', 'confirmed' => true,
            'availability' => [
                ['day' => 'mon', 'windows' => [
                    ['checkup_id' => $checkup->id, 'start' => '08:00', 'end' => '16:00', 'duration_minutes' => 30,
                        'breaks' => [['start' => '12:00', 'end' => '13:00']]],
                ]],
                ['day' => 'tue', 'windows' => [
                    ['checkup_id' => $checkup->id, 'start' => '08:00', 'end' => '10:00', 'duration_minutes' => 30,
                        'breaks' => [['start' => '09:50', 'end' => '10:00']]],
                    ['checkup_id' => $second->id, 'start' => '10:00', 'end' => '12:00', 'duration_minutes' => 20,
                        'breaks' => [['start' => '10:00', 'end' => '10:20']]],
                ]],
            ],
        ])->assertOk();
        $times = fn (string $date) => DoctorVisitSlot::query()->where('doctor_workplace_id', $workplace->id)
            ->orderBy('starts_at')->get()->filter(fn ($slot) => $slot->starts_at->copy()->timezone('Asia/Tehran')->toDateString() === $date)
            ->map(fn ($slot) => $slot->starts_at->copy()->timezone('Asia/Tehran')->format('H:i'))->values()->all();
        $this->assertSame(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'], $times('2026-10-19'));
        $this->assertSame(['08:00', '08:30', '09:00', '10:20', '10:40', '11:00', '11:20', '11:40'], $times('2026-10-20'));
        $this->assertDatabaseHas('audit_events', ['action' => 'doctor.practice.updated']);
    }

    public function test_weekly_rules_reject_foreign_workplaces_unoffered_services_and_invalid_overlaps(): void
    {
        [$user, , $workplace, $checkup] = $this->fixture();
        [, , $other] = $this->fixture();
        $this->stateful($user)->withSession(['auth.password_confirmed_at' => time()]);
        $revision = $this->getJson('/api/doctor/practice')->assertOk()->json('data.revision');
        $window = ['checkup_id' => $checkup->id, 'start' => '09:00', 'end' => '10:00', 'duration_minutes' => 30];
        $data = ['mode' => 'weekly', 'workplace_id' => $workplace->id, 'expected_revision' => $revision, 'confirmed' => true, 'reason' => 'Synthetic rejection', 'availability' => [['day' => 'mon', 'windows' => [$window]]]];
        $this->putJson('/api/doctor/practice', [...$data, 'workplace_id' => $other->id])->assertNotFound();
        $this->putJson('/api/doctor/practice', [...$data, 'availability' => [['day' => 'mon', 'windows' => [$window, $window]]]])->assertUnprocessable();
        $this->putJson('/api/doctor/practice', [...$data, 'availability' => [['day' => 'mon', 'windows' => [[...$window, 'checkup_id' => Checkup::factory()->create()->id]]]]])->assertUnprocessable();
        $this->assertSame(0, DB::table('audit_events')->where('action', 'doctor.practice.updated')->count());
        $this->assertSame(0, $workplace->workingWindows()->count());
    }

    public function test_booking_cards_expose_only_real_professional_metadata_and_location_price_ranges(): void
    {
        [$user, $profile, , $checkup] = $this->fixture();
        $profile->forceFill(['experience_years' => 14, 'phone' => 'PRIVATE PHONE', 'bio' => 'PRIVATE BIO'])->save();
        $this->actingAs(User::factory()->patient()->create(), 'sanctum');
        $doctor = $this->getJson('/api/checkups/'.$checkup->id.'/doctors')->assertOk()->json('data.0');
        $this->assertSame($user->name, $doctor['doctor_name']);
        $this->assertSame(14, $doctor['experience_years']);
        $this->assertNull($doctor['rating']);
        $this->assertNull($doctor['photo_url']);
        $this->assertSame(['currency' => 'IRR', 'min' => 120000, 'max' => 120000], $doctor['price_ranges'][0]);
        $this->assertArrayNotHasKey('phone', $doctor);
        $this->assertArrayNotHasKey('bio', $doctor);
        $this->getJson('/api/checkups/'.$checkup->id.'/doctors?q=PRIVATE%20BIO')->assertOk()->assertJsonPath('data', []);
        $this->getJson('/api/checkups')->assertOk()->assertJsonFragment(['description' => 'Synthetic service description']);
        $profile->user->forceFill(['account_state' => 'suspended'])->save();
        $this->getJson('/api/checkups/'.$checkup->id.'/doctors')->assertOk()->assertJsonPath('data', []);
        $checkup->forceFill(['is_active' => false])->save();
        $this->getJson('/api/checkups/'.$checkup->id.'/doctors')->assertNotFound();
    }

    public function test_practice_authority_is_fresh_and_other_roles_and_guests_are_refused(): void
    {
        [$user] = $this->fixture();
        $this->getJson('/api/doctor/practice')->assertUnauthorized();
        foreach (['patient', 'admin', 'root-admin'] as $role) {
            $actor = User::factory()->create();
            $actor->syncRoles([$role]);
            $this->actingAs($actor, 'sanctum')->getJson('/api/doctor/practice')->assertForbidden();
        }
        $this->actingAs($user, 'sanctum')->getJson('/api/doctor/practice')->assertOk();
        User::findOrFail($user->id)->syncRoles(['patient']);
        $this->getJson('/api/doctor/practice')->assertForbidden();
    }

    public function test_same_second_professional_round_trip_does_not_revive_an_old_revision(): void
    {
        [$user] = $this->fixture();
        $this->stateful($user)->withSession(['auth.password_confirmed_at' => time()]);
        $start = $this->getJson('/api/doctor/practice')->assertOk()->json('data');
        $first = $this->payload();
        $middle = $this->putJson('/api/doctor/practice', $first)->assertOk()->json('data');
        $last = $this->putJson('/api/doctor/practice', [...$first, ...$start['professional'], 'expected_revision' => $middle['revision']])->assertOk()->json('data');
        $this->assertNotSame($start['revision'], $last['revision']);
        $this->putJson('/api/doctor/practice', $first)->assertConflict();
    }

    public function test_weekly_audit_failure_rolls_back_windows_and_materialized_slots(): void
    {
        [$user, , $workplace, $checkup] = $this->fixture();
        $this->stateful($user)->withSession(['auth.password_confirmed_at' => time()]);
        $revision = $this->getJson('/api/doctor/practice')->assertOk()->json('data.revision');
        $slotCount = DoctorVisitSlot::count();
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic weekly audit failure'));
        $this->putJson('/api/doctor/practice', ['mode' => 'weekly', 'workplace_id' => $workplace->id, 'expected_revision' => $revision,
            'confirmed' => true, 'reason' => 'Synthetic atomic schedule', 'availability' => [['day' => 'mon', 'windows' => [[
                'checkup_id' => $checkup->id, 'start' => '09:00', 'end' => '10:00', 'duration_minutes' => 30,
            ]]]]])->assertStatus(500);
        $this->assertSame(0, $workplace->workingWindows()->count());
        $this->assertSame($slotCount, DoctorVisitSlot::count());
    }
}
