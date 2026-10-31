<?php

namespace Tests\Feature\Api;

use App\Enums\PaymentAdjustmentType;
use App\Models\Payment;
use App\Models\PaymentAdjustment;
use App\Models\PaymentAttempt;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\PaymentAdjustmentService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use RuntimeException;

class AdminPaymentAdjustmentContractTest extends PaymentAdjustmentApiTest
{
    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated payment-adjustment acceptance only.');
        }
        parent::setUp();
    }

    private function preview(Payment $payment, User $root): array
    {
        return $this->statefulAs($root)->getJson($this->path($payment).'/adjustment-context')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data.request_only', true)->json('data');
    }

    private function path(Payment $payment): string
    {
        return '/api/admin/payments/'.$payment->public_id;
    }

    private function payload(array $context, array $overrides = []): array
    {
        return $overrides + ['type' => 'refund', 'amount' => '1000000', 'reason' => 'Synthetic bounded request',
            'expected_revision' => $context['revision'], 'expires_at' => $context['expires_at'], 'confirmed' => true];
    }

    private function submit(Payment $payment, User $root, array $data)
    {
        return $this->statefulAs($root)->withSession(['auth.password_confirmed_at' => now()->timestamp])->postJson($this->path($payment).'/adjustments', $data);
    }

    public function test_preview_is_stable_bound_to_actor_and_no_private_provider_or_reason_data_is_exposed(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $context = $this->preview($payment, $root);
        $this->assertSame('5000000', $context['amount']);
        $this->assertSame('5000000', $context['remaining_amount']);
        $this->assertTrue($context['can_request']);
        $this->assertNull($context['blocked']);
        $this->assertSame((string) PHP_INT_MAX, $context['limits']['max_amount']);
        $this->statefulAs($root)->getJson($this->path($payment).'/adjustment-context?expires_at='.$context['expires_at'])
            ->assertOk()->assertJsonPath('data.revision', $context['revision']);
        $other = User::factory()->rootAdmin()->create();
        $this->submit($payment, $other, $this->payload($context))->assertConflict();
        $this->assertStringNotContainsString('provider_ref', json_encode($context));
        $this->assertStringNotContainsString('paid-reference', json_encode($context));
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_duplicate_preview_cannot_reserve_twice_and_no_financial_lifecycle_is_changed(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $before = $payment->getAttributes();
        $reservation = $payment->reservation->getAttributes();
        $attempts = DB::table('payment_attempts')->get()->toJson();
        $context = $this->preview($payment, $root);
        $payload = $this->payload($context);
        $this->submit($payment, $root, $payload)->assertCreated()->assertJsonPath('data.amount_exact', '1000000')
            ->assertJsonPath('data.request_only', true)->assertJsonPath('data.status', 'pending');
        $this->submit($payment, $root, $payload)->assertConflict();
        $this->assertDatabaseCount('payment_adjustments', 1);
        $this->assertDatabaseCount('audit_events', 1);
        $this->assertDatabaseCount('outbox_events', 0);
        $this->assertSame($before, $payment->fresh()->getAttributes());
        $this->assertSame($reservation, $payment->reservation->fresh()->getAttributes());
        $this->assertSame($attempts, DB::table('payment_attempts')->get()->toJson());
        $this->assertSame('4000000', $this->preview($payment, $root)['remaining_amount']);
    }

    public function test_confirmation_revision_expiry_unknown_fields_and_exact_integer_bounds_are_mandatory(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $context = $this->preview($payment, $root);
        foreach ([['confirmed' => false], ['expected_revision' => null], ['expires_at' => null], ['reason' => '   '],
            ['amount' => '1.5'], ['amount' => '9223372036854775808'], ['amount' => 0], ['metadata' => 'private'], ['currency' => 'USD']] as $change) {
            $this->submit($payment, $root, $this->payload($context, $change))->assertUnprocessable();
        }
        $this->submit($payment, $root, $this->payload($context, ['expected_revision' => str_repeat('a', 64)]))->assertConflict();
        $this->travel(6)->minutes();
        $this->submit($payment, $root, $this->payload($context))->assertConflict();
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_reservation_changes_invalidate_preview_and_context_rejects_unbounded_queries(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $context = $this->preview($payment, $root);
        $payment->reservation->forceFill(['status' => 'completed'])->save();
        $this->submit($payment, $root, $this->payload($context))->assertConflict();
        $this->getJson($this->path($payment).'/adjustment-context?expires_at='.(now()->addHour()->timestamp))->assertConflict();
        $this->getJson($this->path($payment).'/adjustment-context?provider=private')->assertUnprocessable();
        $this->getJson($this->path($payment).'/adjustment-context?expires_at=abc')->assertUnprocessable();
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_void_requires_whole_remaining_and_successful_or_pending_requests_reserve_amount(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $context = $this->preview($payment, $root);
        $this->submit($payment, $root, $this->payload($context, ['type' => 'void', 'amount' => 1]))->assertUnprocessable();
        $this->submit($payment, $root, $this->payload($context))->assertCreated();
        PaymentAdjustment::query()->first()->forceFill(['status' => 'succeeded'])->save();
        $context = $this->preview($payment, $root);
        $this->assertSame('4000000', $context['remaining_amount']);
        $this->submit($payment, $root, $this->payload($context, ['amount' => 4000001]))->assertUnprocessable();
        $this->submit($payment, $root, $this->payload($context, ['type' => 'void', 'amount' => 4000000]))->assertCreated();
        $context = $this->preview($payment, $root);
        $this->assertFalse($context['can_request']);
        $this->assertSame('nothing_remaining', $context['blocked']);
        $this->submit($payment, $root, $this->payload($context))->assertUnprocessable();
    }

    public function test_failed_request_releases_reservation_but_reconciliation_blocks_new_requests(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $this->submit($payment, $root, $this->payload($this->preview($payment, $root)))->assertCreated();
        $row = PaymentAdjustment::query()->firstOrFail();
        $row->forceFill(['status' => 'failed'])->save();
        $this->assertSame('5000000', $this->preview($payment, $root)['remaining_amount']);
        $row->forceFill(['status' => 'reconciliation'])->save();
        $context = $this->preview($payment, $root);
        $this->assertFalse($context['can_request']);
        $this->submit($payment, $root, $this->payload($context))->assertUnprocessable();
        $this->assertDatabaseCount('payment_adjustments', 1);
    }

    public function test_canonical_state_provider_money_and_binding_must_match_before_any_request(): void
    {
        $root = User::factory()->rootAdmin()->create();
        foreach (['status' => 'failed', 'provider' => 'other', 'amount' => 4999999, 'currency' => 'USD'] as $key => $value) {
            $payment = $this->paidPayment();
            PaymentAttempt::whereKey($payment->successful_attempt_id)->update([$key => $value]);
            $context = $this->preview($payment, $root);
            $this->assertFalse($context['can_request']);
            $this->assertSame('canonical_inconsistent', $context['blocked']);
            $this->submit($payment, $root, $this->payload($context))->assertUnprocessable();
        }
        $payment = $this->paidPayment();
        $payment->forceFill(['successful_attempt_id' => null])->save();
        $context = $this->preview($payment, $root);
        $this->assertFalse($context['can_request']);
        $this->submit($payment, $root, $this->payload($context))->assertUnprocessable();
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_unpaid_and_inconsistent_existing_adjustment_are_refused(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $this->submit($payment, $root, $this->payload($this->preview($payment, $root)))->assertCreated();
        $row = PaymentAdjustment::firstOrFail();
        $row->forceFill(['currency' => 'USD'])->save();
        $context = $this->preview($payment, $root);
        $this->assertSame('adjustment_history_inconsistent', $context['blocked']);
        $this->submit($payment, $root, $this->payload($context))->assertUnprocessable();
        $payment->forceFill(['status' => 'unpaid'])->save();
        $this->assertSame('payment_not_paid', $this->preview($payment, $root)['blocked']);
    }

    public function test_privileged_patient_or_doctor_relationship_is_hidden_even_from_another_root(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $context = $this->preview($payment, $root);
        $payment->reservation->user->assignRole('admin');
        $this->statefulAs($root)->getJson($this->path($payment).'/adjustment-context')->assertNotFound();
        $this->submit($payment, $root, $this->payload($context))->assertNotFound();
        $payment->reservation->user->syncRoles(['patient']);
        $payment->reservation->doctor->user->assignRole('admin');
        $this->submit($payment, $root, $this->payload($context))->assertNotFound();
        $this->assertDatabaseCount('payment_adjustments', 0);
    }

    public function test_stale_root_instance_is_reloaded_and_revoked_authority_is_denied(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $root->load('roles');
        User::findOrFail($root->id)->syncRoles(['admin']);
        $request = Request::create('/synthetic', 'POST');
        $request->setUserResolver(fn () => $root);
        $this->expectException(AuthorizationException::class);
        app(PaymentAdjustmentService::class)->request($request, $root, $payment, PaymentAdjustmentType::Refund, 1, 'Must not trust cached role');
    }

    public function test_audit_failure_and_final_role_revocation_roll_back_request_and_audit(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $request = Request::create('/synthetic', 'POST');
        $request->setUserResolver(fn () => $root);
        $this->mock(AuditLogger::class, function (MockInterface $mock) use ($root): void {
            $mock->shouldReceive('log')->once()->andReturnUsing(function () use ($root) {
                User::findOrFail($root->id)->syncRoles(['admin']);

                return new \App\Models\AuditEvent;
            });
        });
        try {
            app(PaymentAdjustmentService::class)->request($request, $root, $payment, PaymentAdjustmentType::Refund, 1, 'Synthetic final authority check');
            $this->fail('Final authority check must roll back.');
        } catch (AuthorizationException) {
            $this->assertDatabaseCount('payment_adjustments', 0);
            $this->assertTrue($root->fresh()->isRootAdmin());
        }
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit unavailable'));
        });
        try {
            app(PaymentAdjustmentService::class)->request($request, $root, $payment, PaymentAdjustmentType::Refund, 1, 'Synthetic atomic audit check');
            $this->fail('Audit failure must escape.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Synthetic audit unavailable', $exception->getMessage());
        }
        $this->assertDatabaseCount('payment_adjustments', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_money_above_javascript_safe_integer_remains_exact_and_maximum_reservation_does_not_overflow(): void
    {
        $payment = $this->paidPayment();
        $root = User::factory()->rootAdmin()->create();
        $payment->forceFill(['amount' => 9007199254740993])->save();
        PaymentAttempt::whereKey($payment->successful_attempt_id)->update(['amount' => 9007199254740993]);
        $context = $this->preview($payment, $root);
        $this->assertSame('9007199254740993', $context['remaining_amount']);
        $this->submit($payment, $root, $this->payload($context, ['amount' => '9007199254740993']))->assertCreated()->assertJsonPath('data.amount_exact', '9007199254740993');
        $this->assertSame('0', $this->preview($payment, $root)['remaining_amount']);
    }
}
