<?php

namespace Tests\Feature\Api;

use App\Models\Payment;
use App\Models\PaymentAdjustment;
use App\Models\PaymentAttempt;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminPaymentReadContractTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated payment-read acceptance only.');
        }
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-15T08:00:00Z'));
    }

    private function actor(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);
        $this->actingAs($user)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000']);

        return $user;
    }

    private function graph(): array
    {
        $payment = Payment::factory()->create(['amount' => 9007199254740993, 'provider_ref' => 'PRIVATE PROVIDER REFERENCE']);
        $reservation = $payment->reservation;
        $reservation->forceFill(['status' => 'completed', 'price_snapshot' => 9007199254740993, 'checkup_title_snapshot' => 'Synthetic checkup', 'hospital_name_snapshot' => 'Synthetic hospital'])->save();
        $reservation->user->forceFill(['name' => 'Synthetic patient'])->save();
        $reservation->doctor->user->forceFill(['name' => 'Synthetic doctor'])->save();
        $attempt = PaymentAttempt::factory()->create(['payment_summary_id' => $payment->id, 'amount' => 9007199254740993, 'status' => 'succeeded',
            'provider_ref' => 'PRIVATE ATTEMPT REFERENCE '.Str::ulid(), 'idempotency_key' => 'PRIVATE KEY '.Str::ulid(), 'metadata' => ['private' => 'PRIVATE METADATA'],
            'failure_code' => 'PRIVATE CODE', 'failure_message' => 'PRIVATE MESSAGE']);
        $payment->forceFill(['status' => 'paid', 'successful_attempt_id' => $attempt->id, 'paid_at' => now()])->save();
        $adjustment = new PaymentAdjustment;
        $adjustment->forceFill(['payment_summary_id' => $payment->id, 'payment_attempt_id' => $attempt->id, 'actor_id' => $reservation->user_id,
            'type' => 'refund', 'status' => 'pending', 'amount' => 123, 'currency' => 'IRR', 'provider_ref' => 'PRIVATE ADJUSTMENT REF', 'reason' => 'PRIVATE REASON'])->save();
        $this->event($attempt);

        return [$payment->fresh(), $attempt, $adjustment];
    }

    private function event(PaymentAttempt $attempt, array $extra = []): string
    {
        $id = (string) Str::ulid();
        DB::table('payment_provider_events')->insert($extra + ['public_id' => $id, 'payment_attempt_id' => $attempt->id, 'provider' => $attempt->provider,
            'external_event_id' => (string) Str::ulid(), 'event_type' => 'payment.succeeded', 'signature_verified' => true,
            'received_at' => now(), 'processed_at' => now(), 'sanitized_payload' => json_encode(['private' => 'PRIVATE CALLBACK']), 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }

    private function paths(Payment $payment): array
    {
        $base = '/api/admin/payments/'.$payment->public_id;

        return ['/api/admin/payments', $base, $base.'/attempts', $base.'/adjustments', $base.'/events'];
    }

    public function test_admin_and_root_read_safe_exact_money_canonical_and_separate_reservation_state(): void
    {
        [$payment, $attempt] = $this->graph();
        foreach (['admin', 'root-admin'] as $role) {
            $this->actor($role);
            foreach ($this->paths($payment) as $path) {
                $response = $this->getJson($path)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('meta.read_only', true)->assertJsonPath('meta.adjustments_execute_provider', false);
                $this->assertStringNotContainsString('PRIVATE', $response->getContent());
                if (in_array($path, array_slice($this->paths($payment), 2), true)) {
                    $response->assertJsonPath('meta.payment_public_id', $payment->public_id);
                }
                $this->assertStringNotContainsString($payment->reservation->user->email, $response->getContent());
                foreach (['provider_ref', 'idempotency_key', 'sanitized_payload', 'external_event_id', 'password', 'metadata', 'failure_message', 'failure_code'] as $key) {
                    $this->assertStringNotContainsString('"'.$key.'"', $response->getContent());
                }
            }
            $this->getJson($this->paths($payment)[1])->assertOk()->assertJsonPath('data.amount', '9007199254740993')
                ->assertJsonPath('data.reservation.booked_amount', '9007199254740993')->assertJsonPath('data.status', 'paid')
                ->assertJsonPath('data.reservation.status', 'completed')->assertJsonPath('data.canonical_attempt.public_id', $attempt->public_id)
                ->assertJsonPath('data.canonical_consistent', true)->assertJsonPath('data.counts.pending_adjustments', 1);
            $this->getJson($this->paths($payment)[3])->assertOk()->assertJsonPath('data.0.status', 'pending')->assertJsonPath('data.0.reason_recorded', true)->assertJsonPath('meta.pending_is_request_only', true);
        }
    }

    public function test_composed_identity_status_and_exact_public_id_filters(): void
    {
        [$payment] = $this->graph();
        Payment::factory()->create();
        $this->actor();
        $filters = ['doctor_id' => $payment->reservation->doctor_profile_id, 'patient_id' => $payment->reservation->user_id,
            'workplace_id' => $payment->reservation->doctor_workplace_id, 'checkup_id' => $payment->reservation->checkup_id,
            'status' => 'paid', 'reservation_status' => 'completed', 'attempt_status' => 'succeeded', 'provider' => 'sandbox', 'adjustment_status' => 'pending'];
        $this->getJson('/api/admin/payments?'.http_build_query($filters))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.public_id', $payment->public_id);
        foreach ([$payment->public_id, strtoupper($payment->public_id), $payment->reservation->public_id, 'Synthetic patient', 'Synthetic doctor', 'Synthetic checkup'] as $term) {
            $this->getJson('/api/admin/payments?q='.urlencode($term))->assertOk()->assertJsonPath('meta.pagination.total', 1);
        }
        $this->getJson('/api/admin/payments?'.http_build_query($filters + ['q' => 'no match']))->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_provider_and_attempt_state_are_bound_to_the_same_attempt(): void
    {
        [$payment] = $this->graph();
        PaymentAttempt::factory()->create(['payment_summary_id' => $payment->id, 'provider' => 'other', 'status' => 'failed']);
        $this->actor();
        $this->getJson('/api/admin/payments?provider=sandbox&attempt_status=failed')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/admin/payments?provider=other&attempt_status=failed')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/payments?provider=other')->assertOk()->assertJsonPath('meta.pagination.total', 1);
    }

    public function test_search_is_literal_and_never_searches_private_identity_or_provider_fields(): void
    {
        [$payment] = $this->graph();
        $this->actor();
        foreach (['%', '_', 'PRIVATE', $payment->reservation->user->email] as $term) {
            $this->getJson('/api/admin/payments?q='.urlencode($term))->assertOk()->assertJsonPath('meta.pagination.total', 0);
        }
        $payment->reservation->forceFill(['checkup_title_snapshot' => 'Literal 50%_! test'])->save();
        $this->getJson('/api/admin/payments?q='.urlencode('50%_!'))->assertOk()->assertJsonPath('meta.pagination.total', 1);
    }

    public function test_payment_creation_local_dates_are_inclusive_and_distinct_from_appointment_dates(): void
    {
        [$payment] = $this->graph();
        $this->actor();
        $payment->forceFill(['created_at' => '2026-10-14 20:30:00'])->save();
        $this->getJson('/api/admin/payments?from=2026-10-15&to=2026-10-15')->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('meta.period.field', 'payment_created_at');
        $payment->forceFill(['created_at' => '2026-10-15 20:29:59'])->save();
        $this->getJson('/api/admin/payments?from=2026-10-15&to=2026-10-15')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $payment->forceFill(['created_at' => '2026-10-15 20:30:00'])->save();
        $this->getJson('/api/admin/payments?from=2026-10-15&to=2026-10-15')->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_attempt_adjustment_and_event_histories_are_scoped_filtered_and_paged(): void
    {
        [$payment, $attempt] = $this->graph();
        [$other, $otherAttempt] = $this->graph();
        $failed = PaymentAttempt::factory()->create(['payment_summary_id' => $payment->id, 'status' => 'failed']);
        $unknown = $this->event($failed, ['event_type' => 'PRIVATE EVENT TYPE', 'signature_verified' => false, 'processed_at' => null]);
        $this->actor();
        $base = '/api/admin/payments/'.$payment->public_id;
        $this->getJson($base.'/attempts?status=failed')->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.public_id', $failed->public_id)->assertJsonPath('data.0.is_canonical', false);
        $this->getJson($base.'/attempts?per_page=1&page=1')->assertOk()->assertJsonPath('meta.pagination.total', 2)->assertJsonPath('data.0.public_id', $failed->public_id);
        $this->getJson($base.'/attempts?per_page=1&page=2')->assertOk()->assertJsonPath('data.0.public_id', $attempt->public_id);
        $this->getJson($base.'/adjustments?status=pending&type=refund')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->getJson($base.'/events?signature_verified=0&processed=no')->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.public_id', $unknown)->assertJsonPath('data.0.event_type', null);
        $this->getJson($base.'/events?signature_verified=1&processed=yes')->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.attempt_public_id', $attempt->public_id);
        $this->getJson($base.'/attempts')->assertOk()->assertJsonMissing(['public_id' => $otherAttempt->public_id]);
    }

    public function test_invalid_filters_bounds_dates_and_identifiers_refuse(): void
    {
        [$payment] = $this->graph();
        $this->actor();
        foreach (['status=unknown', 'attempt_status=paid', 'adjustment_status=voided', 'patient_id=0', 'doctor_id[]=1', 'sort_by=provider_ref',
            'sort_dir=sideways', 'page=1001', 'per_page=101', 'q[]=x', 'q='.str_repeat('x', 101), 'from=2026-10-15', 'to=2026-10-15', 'currency=irr',
            'from=2026-02-30&to=2026-03-01', 'from=2026-10-15&to=2026-10-14', 'from=2026-01-01&to=2026-04-01', 'include=users', 'provider=bad%20provider'] as $query) {
            $this->getJson('/api/admin/payments?'.$query)->assertUnprocessable();
        }
        $base = '/api/admin/payments/'.$payment->public_id;
        foreach (['/attempts?status=paid', '/adjustments?type=executed-refund', '/events?processed=maybe', '/events?signature_verified=2', '?include=attempts'] as $suffix) {
            $this->getJson($base.$suffix)->assertUnprocessable();
        }
        $this->getJson('/api/admin/payments/123')->assertUnprocessable();
        $this->getJson('/api/admin/payments/'.Str::ulid())->assertNotFound();
    }

    public function test_guest_patient_and_doctor_cannot_read_payment_administration(): void
    {
        [$payment] = $this->graph();
        foreach ($this->paths($payment) as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($role);
            foreach ($this->paths($payment) as $path) {
                $this->getJson($path)->assertForbidden();
            }
        }
    }

    public function test_other_privileged_patient_and_doctor_records_stay_hidden_and_archived_doctor_history_survives(): void
    {
        [$payment] = $this->graph();
        $this->actor('root-admin');
        $payment->reservation->doctor->delete();
        $this->getJson($this->paths($payment)[1])->assertOk()->assertJsonPath('data.reservation.doctor.archived', true);
        foreach ([$payment->reservation->user, $payment->reservation->doctor()->withTrashed()->first()->user] as $owner) {
            $owner->syncRoles(['root-admin']);
            foreach ($this->paths($payment) as $index => $path) {
                $response = $this->getJson($path);
                $index === 0 ? $response->assertOk()->assertJsonPath('meta.pagination.total', 0) : $response->assertNotFound();
            }
            $owner->syncRoles(['patient']);
        }
    }

    public function test_wrong_canonical_pointer_is_flagged_without_exposing_another_payments_attempt(): void
    {
        [$payment] = $this->graph();
        [, $otherAttempt] = $this->graph();
        // Clear the other summary's unique pointer before making an intentionally inconsistent fixture.
        Payment::whereKey($otherAttempt->payment_summary_id)->update(['successful_attempt_id' => null]);
        $payment->forceFill(['successful_attempt_id' => $otherAttempt->id])->save();
        $this->actor();
        $this->getJson($this->paths($payment)[1])->assertOk()->assertJsonPath('data.canonical_consistent', false)->assertJsonPath('data.canonical_attempt', null);
        $this->assertSame('paid', $payment->fresh()->status->value);
    }

    public function test_stable_sort_pagination_and_money_do_not_merge_currencies(): void
    {
        [$one] = $this->graph();
        [$two] = $this->graph();
        $two->forceFill(['currency' => 'USD'])->save();
        $this->actor();
        $this->getJson('/api/admin/payments?sort_by=amount&sort_dir=asc&per_page=1')->assertOk()->assertJsonPath('data.0.public_id', $one->public_id)->assertJsonPath('data.0.currency', 'IRR');
        $this->getJson('/api/admin/payments?sort_by=amount&sort_dir=asc&per_page=1&page=2')->assertOk()->assertJsonPath('data.0.public_id', $two->public_id)->assertJsonPath('data.0.currency', 'USD')->assertJsonPath('data.0.canonical_consistent', false);
        $this->getJson('/api/admin/payments?currency=USD')->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.public_id', $two->public_id);
    }

    public function test_cached_and_mid_read_actor_revocation_refuse(): void
    {
        [$payment] = $this->graph();
        $actor = $this->actor()->load('roles');
        User::findOrFail($actor->id)->syncRoles(['patient']);
        foreach ($this->paths($payment) as $path) {
            $this->getJson($path)->assertForbidden();
        }
        $actor->syncRoles(['admin']);
        $state = (object) ['changed' => false];
        DB::listen(function ($query) use ($actor, $state) {
            if (! $state->changed && str_contains($query->sql, 'reservation_payment_summaries')) {
                $state->changed = true;
                User::findOrFail($actor->id)->syncRoles(['patient']);
            }
        });
        $this->getJson($this->paths($payment)[1])->assertForbidden();
        $this->assertTrue($state->changed);
    }

    public function test_mid_read_privileged_owner_promotion_refuses_before_response(): void
    {
        [$payment] = $this->graph();
        $this->actor();
        $state = (object) ['changed' => false];
        DB::listen(function ($query) use ($payment, $state) {
            if (! $state->changed && str_starts_with(strtolower($query->sql), 'select') && str_contains($query->sql, 'reservation_payment_summaries') && ! str_starts_with(strtolower($query->sql), 'select count(')) {
                $state->changed = true;
                User::findOrFail($payment->reservation->user_id)->syncRoles(['root-admin']);
            }
        });
        $this->getJson($this->paths($payment)[1])->assertForbidden();
        $this->assertTrue($state->changed);
    }

    public function test_all_reads_preserve_financial_clinical_audit_outbox_queue_and_identity_rows(): void
    {
        [$payment] = $this->graph();
        $this->actor();
        $tables = ['reservation_payment_summaries', 'payment_attempts', 'payment_provider_events', 'payment_adjustments', 'reservations', 'reservation_schedule_changes',
            'reservation_medical_requests', 'reservation_files', 'reservation_reports', 'audit_events', 'outbox_events', 'jobs', 'users', 'model_has_roles'];
        $before = [];
        foreach ($tables as $table) {
            $before[$table] = DB::table($table)->get()->toJson();
        }
        foreach ($this->paths($payment) as $path) {
            $this->getJson($path)->assertOk();
        }
        foreach ($before as $table => $bytes) {
            $this->assertSame($bytes, DB::table($table)->get()->toJson(), $table);
        }
    }

    public function test_zero_money_is_exact_and_invalid_legacy_financial_values_fail_closed(): void
    {
        [$payment] = $this->graph();
        $payment->forceFill(['amount' => 0, 'status' => 'unpaid', 'successful_attempt_id' => null])->save();
        $payment->reservation->forceFill(['price_snapshot' => 0])->save();
        $this->actor();
        $this->getJson($this->paths($payment)[1])->assertOk()->assertJsonPath('data.amount', '0')->assertJsonPath('data.reservation.booked_amount', '0')->assertJsonPath('data.canonical_consistent', true);
        foreach ([['amount' => 1.5], ['currency' => 'irr'], ['status' => 'PRIVATE UNKNOWN STATE']] as $change) {
            DB::table('reservation_payment_summaries')->where('id', $payment->id)->update(['amount' => 0, 'currency' => 'IRR', 'status' => 'unpaid']);
            DB::table('reservation_payment_summaries')->where('id', $payment->id)->update($change);
            $response = $this->getJson($this->paths($payment)[1])->assertStatus(503);
            $this->assertStringNotContainsString('PRIVATE UNKNOWN STATE', $response->getContent());
        }
    }

    public function test_large_attempt_history_stays_paged_and_detail_does_not_embed_the_collection(): void
    {
        [$payment] = $this->graph();
        PaymentAttempt::factory()->count(25)->create(['payment_summary_id' => $payment->id]);
        $this->actor();
        $this->getJson($this->paths($payment)[1])->assertOk()->assertJsonPath('data.counts.attempts', 26)->assertJsonMissingPath('data.attempts');
        $this->getJson($this->paths($payment)[2])->assertOk()->assertJsonPath('meta.pagination.total', 26)->assertJsonCount(20, 'data');
        $this->getJson($this->paths($payment)[2].'?page=2')->assertOk()->assertJsonCount(6, 'data');
    }
}
