<?php

namespace Tests\Feature\Api;

use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\QuestionnaireSubmission;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class AdminDashboardReadContractTest extends TestCase
{
    use IsolatedProfileApplication, RefreshDatabase;

    private const URL = '/api/admin/dashboard';

    public function test_calendar_is_fresh_role_guarded_read_only_and_rejects_unbounded_or_extra_fields(): void
    {
        $path = self::URL.'/appointments';
        $this->getJson($path.'?from=2026-10-01&until=2026-11-01')->assertUnauthorized();
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($role);
            $this->getJson($path.'?from=2026-10-01&until=2026-11-01')->assertForbidden();
        }
        foreach (['admin', 'root-admin'] as $role) {
            $actor = $this->actor($role);
            $this->getJson($path.'?from=2026-10-01&until=2026-11-01')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonPath('meta.read_only', true)->assertJsonPath('data.appointments', [])->assertJsonPath('data.has_more', false);
            foreach (['', '?from=2026-10-01', '?from=2026-02-30&until=2026-03-01', '?from=2026-10-02&until=2026-10-01', '?from=2026-10-01&until=2026-10-01', '?from=2026-10-01&until=2026-11-13', '?from=2026-10-01&until=2026-11-01&patient_id=7'] as $query) {
                $this->getJson($path.$query)->assertUnprocessable();
            }
            $actor->load('roles');
            User::findOrFail($actor->id)->syncRoles(['patient']);
            $this->getJson($path.'?from=2026-10-01&until=2026-11-01')->assertForbidden();
        }
        foreach (['reservations', 'audit_events', 'outbox_events', 'jobs', 'setting_values'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_calendar_uses_appointment_overlap_and_tehran_exclusive_bounds_without_creation_cohort(): void
    {
        $this->actor();
        foreach ([
            ['2026-10-10 19:30:00', '2026-10-10 20:30:00'],
            ['2026-10-10 20:00:00', '2026-10-10 21:00:00'],
            ['2026-10-10 20:30:00', '2026-10-10 21:30:00'],
            ['2026-10-11 20:29:00', '2026-10-11 21:00:00'],
            ['2026-10-11 20:30:00', '2026-10-11 21:30:00'],
        ] as [$start, $end]) {
            $this->reservation(['starts_at' => $start, 'ends_at' => $end, 'created_at' => '2026-01-01 00:00:00']);
        }
        $this->getJson(self::URL.'/appointments?from=2026-10-11&until=2026-10-12')->assertOk()
            ->assertJsonCount(3, 'data.appointments')->assertJsonPath('data.appointments.0.id', 2)
            ->assertJsonPath('data.appointments.2.id', 4)->assertJsonPath('data.timezone', 'Asia/Tehran');
    }

    public function test_calendar_excludes_privileged_owners_and_clinical_or_private_fields(): void
    {
        $this->actor();
        $hidden = $this->reservation(['user_id' => User::factory()->rootAdmin()->create()->id, 'starts_at' => '2026-10-11 04:30:00', 'ends_at' => '2026-10-11 05:30:00']);
        $hiddenDoctor = $this->reservation(['starts_at' => '2026-10-11 04:30:00', 'ends_at' => '2026-10-11 05:30:00']);
        $hiddenDoctor->doctor->user->syncRoles(['admin']);
        $visible = $this->reservation(['starts_at' => '2026-10-11 04:30:00', 'ends_at' => '2026-10-11 05:30:00']);
        $response = $this->getJson(self::URL.'/appointments?from=2026-10-01&until=2026-11-01')->assertOk()
            ->assertJsonCount(1, 'data.appointments')->assertJsonPath('data.appointments.0.id', $visible->id)
            ->assertJsonMissing(['public_id' => $hidden->public_id])->assertJsonMissing(['public_id' => $hiddenDoctor->public_id]);
        foreach (['email', 'phone', 'password', 'instructions', 'body_html', 'price_snapshot', 'provider', 'answers'] as $field) {
            $this->assertStringNotContainsString('"'.$field.'"', $response->getContent());
        }
    }

    public function test_calendar_has_deterministic_cap_and_explicit_overflow(): void
    {
        $this->actor();
        $row = $this->reservation(['starts_at' => '2026-10-11 04:30:00', 'ends_at' => '2026-10-11 05:30:00']);
        for ($i = 0; $i < 200; $i++) {
            $this->reservation(['user_id' => $row->user_id, 'doctor_profile_id' => $row->doctor_profile_id, 'checkup_id' => $row->checkup_id,
                'starts_at' => '2026-10-11 04:30:00', 'ends_at' => '2026-10-11 05:30:00']);
        }
        $response = $this->getJson(self::URL.'/appointments?from=2026-10-01&until=2026-11-01')->assertOk()
            ->assertJsonCount(200, 'data.appointments')->assertJsonPath('data.has_more', true)->assertJsonPath('data.limit', 200);
        $this->assertSame(range(1, 200), $response->json('data.appointments.*.id'));
    }

    public function test_calendar_refuses_mid_read_change_and_revoked_authority(): void
    {
        $actor = $this->actor();
        $reservation = $this->reservation(['starts_at' => '2026-10-11 04:30:00', 'ends_at' => '2026-10-11 05:30:00']);
        $changed = false;
        DB::listen(function ($query) use (&$changed, $reservation): void {
            if (! $changed && str_contains($query->sql, 'select') && str_contains($query->sql, 'reservations')) {
                $changed = true;
                Reservation::whereKey($reservation->id)->update(['status' => 'cancelled']);
            }
        });
        $this->getJson(self::URL.'/appointments?from=2026-10-01&until=2026-11-01')->assertConflict();
        $revoked = false;
        DB::listen(function ($query) use (&$revoked, $actor): void {
            if (! $revoked && str_contains($query->sql, 'select') && str_contains($query->sql, 'reservations')) {
                $revoked = true;
                User::findOrFail($actor->id)->syncRoles(['patient']);
            }
        });
        $this->getJson(self::URL.'/appointments?from=2026-10-01&until=2026-11-01')->assertForbidden();
    }

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated dashboard acceptance only.');
        }
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-16T10:30:00Z'));
    }

    private function actor(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);
        $this->actingAs($user)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000']);

        return $user;
    }

    private function reservation(array $fields = []): Reservation
    {
        return Reservation::factory()->create($fields + ['created_at' => now()->subDay(), 'checkup_title_snapshot' => 'Synthetic service']);
    }

    public function test_admin_and_root_get_zero_reports_without_provisioning_or_fabricating_updates_geography(): void
    {
        foreach (['admin', 'root-admin'] as $role) {
            $this->actor($role);
            $this->getJson(self::URL)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonPath('meta.filters_supported', false)->assertJsonPath('meta.read_only', true)
                ->assertJsonPath('data.reservations.created', 0)->assertJsonPath('data.payments.by_currency', [])
                ->assertJsonPath('data.locations.available', false)->assertJsonPath('data.updates.reserved', true)
                ->assertJsonCount(30, 'data.trends.dates')->assertJsonCount(30, 'data.trends.bookings');
        }
        foreach (['reservations', 'audit_events', 'outbox_events', 'jobs', 'setting_values'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_guest_patient_doctor_and_revoked_or_suspended_admin_are_denied(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($role);
            $this->getJson(self::URL)->assertForbidden();
        }
        $user = $this->actor();
        $user->load('roles');
        User::findOrFail($user->id)->syncRoles(['patient']);
        $this->getJson(self::URL)->assertForbidden();
        User::findOrFail($user->id)->syncRoles(['admin']);
        User::whereKey($user->id)->update(['account_state' => 'suspended']);
        $this->getJson(self::URL)->assertForbidden();
    }

    public function test_all_client_filters_paging_scope_and_sort_overrides_are_refused(): void
    {
        $this->actor();
        foreach (['q=x', 'doctor_id=2', 'patient_id=7', 'from=2026-10-01', 'period=year', 'page=1', 'scope_type=site', 'sort_dir=asc'] as $query) {
            $this->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
    }

    public function test_tehran_boundaries_and_daily_cohorts_exclude_future_and_old_creations(): void
    {
        $this->actor();
        foreach (['2026-09-16 20:29:59', '2026-09-16 20:30:00', '2026-10-16 10:29:59', '2026-10-16 10:30:00'] as $date) {
            $this->reservation(['created_at' => $date]);
        }
        $response = $this->getJson(self::URL)->assertOk()->assertJsonPath('data.period.from', '2026-09-17')
            ->assertJsonPath('data.period.through', '2026-10-16')->assertJsonPath('data.reservations.created', 2);
        $this->assertSame(1, $response->json('data.trends.bookings.0'));
        $this->assertSame(1, $response->json('data.trends.bookings.29'));
        $this->assertSame(2, array_sum($response->json('data.trends.bookings')));
    }

    public function test_latest_and_rankings_have_deterministic_limits_and_safe_display_metadata(): void
    {
        $this->actor();
        $first = $this->reservation();
        for ($i = 0; $i < 7; $i++) {
            $this->reservation(['checkup_id' => $first->checkup_id, 'doctor_profile_id' => $first->doctor_profile_id]);
        }
        $response = $this->getJson(self::URL)->assertOk()->assertJsonPath('data.reservations.created', 8)
            ->assertJsonCount(5, 'data.latest_reservations')->assertJsonPath('data.rankings.checkups.0.reservations', 8)
            ->assertJsonPath('data.rankings.doctors.0.reservations', 8);
        $ids = $response->json('data.latest_reservations.*.id');
        $this->assertSame([8, 7, 6, 5, 4], $ids);
        foreach (['email', 'phone', 'password', 'answers_json', 'body_html', 'provider_ref', 'idempotency_key', 'instructions'] as $private) {
            $this->assertStringNotContainsString('"'.$private.'"', $response->getContent());
        }
    }

    public function test_privileged_patient_or_doctor_rows_are_excluded_from_all_aggregates_and_previews(): void
    {
        $other = User::factory()->rootAdmin()->create();
        $hidden = $this->reservation(['user_id' => $other->id]);
        $hiddenDoctor = $this->reservation();
        $hiddenDoctor->doctor->user->syncRoles(['admin']);
        $visible = $this->reservation();
        foreach (['admin', 'root-admin'] as $role) {
            $this->actor($role);
            $this->getJson(self::URL)->assertOk()->assertJsonPath('data.reservations.created', 1)
                ->assertJsonPath('data.latest_reservations.0.public_id', $visible->public_id)
                ->assertJsonMissing(['public_id' => $hidden->public_id])->assertJsonMissing(['public_id' => $hiddenDoctor->public_id]);
        }
    }

    public function test_medical_and_questionnaire_reports_exclude_archives_and_private_bodies(): void
    {
        $this->actor();
        $reservation = $this->reservation();
        $request = ReservationMedicalRequest::factory()->create(['reservation_id' => $reservation->id, 'created_at' => now()->subHour(), 'instructions' => 'PRIVATE CLINICAL']);
        $archived = ReservationMedicalRequest::factory()->create(['reservation_id' => $reservation->id, 'created_at' => now()->subHour()]);
        $archived->delete();
        QuestionnaireSubmission::factory()->create(['user_id' => $reservation->user_id, 'created_at' => now()->subHour(), 'result_body_html' => 'PRIVATE CLINICAL']);
        $response = $this->getJson(self::URL)->assertOk()->assertJsonPath('data.medical_requests.created', 1)
            ->assertJsonPath('data.submissions.created', 1);
        $this->assertStringNotContainsString('PRIVATE', $response->getContent());
        $this->assertSame(1, array_sum($response->json('data.trends.submissions')));
        $this->assertSame('open', $request->fresh()->status->value);
    }

    public function test_paid_reports_require_canonical_binding_keep_exact_money_and_separate_currencies(): void
    {
        $this->actor();
        foreach ([['IRR', 9007199254740993], ['IRR', 9007199254740993], ['EUR', 123]] as [$currency, $amount]) {
            $this->paid($currency, $amount);
        }
        $invalid = $this->paid('IRR', 45);
        $invalid->successfulAttempt->forceFill(['currency' => 'USD'])->save();
        $response = $this->getJson(self::URL)->assertOk()->assertJsonPath('data.payments.paid', 3)
            ->assertJsonPath('data.payments.inconsistent_paid', 1)->assertJsonPath('data.payments.by_currency.0.currency', 'EUR')
            ->assertJsonPath('data.payments.by_currency.0.amount', '123')->assertJsonPath('data.payments.by_currency.1.amount', '18014398509481986');
        $this->assertStringNotContainsString('provider_ref', $response->getContent());
    }

    private function paid(string $currency, int $amount): Payment
    {
        $payment = Payment::factory()->create(['currency' => $currency, 'amount' => $amount, 'status' => 'paid', 'created_at' => now()->subHour()]);
        $attempt = PaymentAttempt::factory()->create(['payment_summary_id' => $payment->id, 'currency' => $currency, 'amount' => $amount, 'status' => 'succeeded']);
        $payment->forceFill(['successful_attempt_id' => $attempt->id])->save();

        return $payment->fresh();
    }

    public function test_mid_read_authority_revocation_refuses_response(): void
    {
        $root = $this->actor('root-admin');
        $changed = false;
        DB::listen(function ($query) use (&$changed, $root): void {
            if (! $changed && str_contains($query->sql, 'reservations')) {
                $changed = true;
                User::findOrFail($root->id)->syncRoles(['patient']);
            }
        });
        $this->getJson(self::URL)->assertForbidden();
        $this->assertTrue($changed);
    }

    public function test_mid_read_data_change_refuses_mixed_reports(): void
    {
        $this->actor();
        $row = $this->reservation();
        $changed = false;
        DB::listen(function ($query) use (&$changed, $row): void {
            if (! $changed && str_contains($query->sql, 'reservations')) {
                $changed = true;
                Reservation::whereKey($row->id)->update(['status' => 'cancelled']);
            }
        });
        $this->getJson(self::URL)->assertConflict();
        $this->assertTrue($changed);
    }

    public function test_reads_preserve_business_identity_audit_outbox_and_queue_rows(): void
    {
        $this->actor();
        $this->paid('IRR', 123);
        $tables = ['users', 'reservations', 'reservation_payment_summaries', 'payment_attempts', 'payment_adjustments',
            'reservation_medical_requests', 'questionnaire_submissions', 'audit_events', 'outbox_events', 'jobs'];
        $before = [];
        foreach ($tables as $table) {
            $before[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        $this->getJson(self::URL)->assertOk();
        foreach ($tables as $table) {
            $this->assertSame($before[$table], DB::table($table)->orderBy('id')->get()->toJson());
        }
    }
}
