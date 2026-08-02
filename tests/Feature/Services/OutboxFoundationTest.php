<?php

namespace Tests\Feature\Services;

use App\Contracts\Integrations\OutboxTransport;
use App\Enums\OutboxEventType;
use App\Models\User;
use App\Services\OutboxDispatcher;
use App\Services\OutboxPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Tests\TestCase;

class OutboxFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketplace_publish_participates_in_domain_transaction_and_rejects_sensitive_payload(): void
    {
        $subject = User::factory()->create();
        $publisher = app(OutboxPublisher::class);

        try {
            DB::transaction(function () use ($publisher, $subject): void {
                $publisher->marketplace($subject, 'reservation.created', [
                    'reservation_public_id' => '01KZ11RESERVATION000000000',
                    'actor_public_id' => (string) $subject->public_id,
                    'occurred_at' => now()->toISOString(),
                ]);
                throw new RuntimeException('rollback domain');
            });
        } catch (RuntimeException) {
            $this->assertDatabaseCount('outbox_events', 0);
        }

        $this->expectException(ValidationException::class);
        $publisher->marketplace($subject, 'reservation.created', [
            'reservation_public_id' => '01KZ11RESERVATION000000000',
            'actor_public_id' => (string) $subject->public_id,
            'occurred_at' => now()->toISOString(),
            'patient_phone' => '09120000000',
        ]);
    }

    public function test_dispatch_is_idempotent_and_records_success(): void
    {
        $eventId = $this->publishMarketplace();
        $transport = new class implements OutboxTransport
        {
            public array $eventIds = [];

            public function dispatch(string $eventId, string $eventType, array $payload): void
            {
                $this->eventIds[] = $eventId;
            }
        };
        $dispatcher = app(OutboxDispatcher::class);

        $this->assertSame($eventId, $dispatcher->dispatchNext($transport));
        $this->assertNull($dispatcher->dispatchNext($transport));
        $this->assertSame([$eventId], $transport->eventIds);
        $this->assertDatabaseHas('outbox_events', [
            'event_id' => $eventId,
            'status' => 'dispatched',
            'attempts' => 1,
        ]);
    }

    public function test_retry_uses_backoff_then_reaches_terminal_failure(): void
    {
        config(['outbox.max_attempts' => 2, 'outbox.base_backoff_seconds' => 1]);
        $eventId = $this->publishMarketplace();
        $transport = new class implements OutboxTransport
        {
            public function dispatch(string $eventId, string $eventType, array $payload): void
            {
                throw new RuntimeException('provider payload must not be stored');
            }
        };
        $dispatcher = app(OutboxDispatcher::class);

        $dispatcher->dispatchNext($transport);
        $this->assertDatabaseHas('outbox_events', [
            'event_id' => $eventId,
            'status' => 'pending',
            'attempts' => 1,
            'last_error' => 'RuntimeException',
        ]);

        $this->travel(2)->seconds();
        $dispatcher->dispatchNext($transport);
        $this->assertDatabaseHas('outbox_events', [
            'event_id' => $eventId,
            'status' => 'failed',
            'attempts' => 2,
            'last_error' => 'RuntimeException',
        ]);
    }

    public function test_tenant_outbox_is_written_only_to_tenant_connection(): void
    {
        config(['database.connections.tenant' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]]);
        DB::purge('tenant');
        Artisan::call('migrate:fresh', [
            '--database' => 'tenant',
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
            '--force' => true,
        ]);

        app(OutboxPublisher::class)->tenant(
            'tenant_feature_entitlement',
            '01KZ11TENANTFEATURE00000000',
            'tenant.entitlement.changed',
            [
                'tenant_public_id' => '01KZ11TENANTPUBLIC000000000',
                'feature_key' => 'tenant.reports',
                'enabled' => true,
                'expires_at' => now()->addMonth()->toISOString(),
            ],
        );

        $this->assertSame(1, DB::connection('tenant')->table('outbox_events')->count());
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_stale_processing_event_is_recovered_with_the_same_idempotency_identity(): void
    {
        config([
            'outbox.max_attempts' => 3,
            'outbox.processing_lease_seconds' => 60,
        ]);
        $eventId = $this->publishMarketplace();
        DB::table('outbox_events')->where('event_id', $eventId)->update([
            'status' => 'processing',
            'attempts' => 1,
            'updated_at' => now()->subMinutes(2),
        ]);
        $transport = new class implements OutboxTransport
        {
            public array $eventIds = [];

            public function dispatch(string $eventId, string $eventType, array $payload): void
            {
                $this->eventIds[] = $eventId;
            }
        };
        $dispatcher = app(OutboxDispatcher::class);

        $this->assertSame(1, $dispatcher->dispatchAvailable($transport));
        $this->assertSame([$eventId], $transport->eventIds);
        $this->assertSame([
            'pending' => 0,
            'processing' => 0,
            'dispatched' => 1,
            'failed' => 0,
        ], $dispatcher->statusCounts());
        $this->assertDatabaseHas('outbox_events', [
            'event_id' => $eventId,
            'status' => 'dispatched',
            'attempts' => 2,
        ]);
    }

    private function publishMarketplace(): string
    {
        $subject = User::factory()->create();

        return app(OutboxPublisher::class)->marketplace($subject, OutboxEventType::ReservationCreated, [
            'reservation_public_id' => '01KZ11RESERVATION000000000',
            'actor_public_id' => (string) $subject->public_id,
            'occurred_at' => now()->toISOString(),
        ]);
    }
}
