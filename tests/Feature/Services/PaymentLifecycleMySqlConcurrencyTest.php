<?php

namespace Tests\Feature\Services;

use App\Contracts\Integrations\PaymentGateway;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Services\PaymentLifecycleService;
use Database\Seeders\RolesSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;
use Throwable;

class PaymentLifecycleMySqlConcurrencyTest extends TestCase
{
    public function test_concurrent_success_callbacks_select_only_one_canonical_attempt(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('This regression requires MySQL row-level locking.');
        }

        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('This regression requires the pcntl extension.');
        }

        Artisan::call('migrate:fresh', ['--force' => true]);
        $this->seed(RolesSeeder::class);

        $directory = storage_path('framework/testing/payment-concurrency-'.Str::uuid());
        File::ensureDirectoryExists($directory);

        $children = [];

        try {
            $reservation = Reservation::factory()->create([
                'status' => ReservationStatus::Pending,
                'hold_expires_at' => now()->addHour(),
            ]);
            $payment = Payment::query()->create([
                'reservation_id' => $reservation->id,
                'amount' => $reservation->price_snapshot,
                'currency' => $reservation->currency_snapshot,
                'status' => PaymentSummaryStatus::Unpaid,
            ]);

            $service = app(PaymentLifecycleService::class);
            $winner = $service->createAttempt($payment, 'sandbox', 'concurrent:attempt:0001');
            $contender = $service->createAttempt($payment, 'sandbox', 'concurrent:attempt:0002');

            $children[] = $this->forkCallbackWorker($directory, $winner->id, 'event-concurrent-1', true);
            $children[] = $this->forkCallbackWorker($directory, $contender->id, 'event-concurrent-2', false);

            $exitCodes = $this->waitForChildren($children, 15);
            $children = [];

            $winnerResult = $this->readResult($directory.'/winner.json');
            $contenderResult = $this->readResult($directory.'/contender.json');

            $this->assertSame([0, 0], $exitCodes, json_encode([$winnerResult, $contenderResult]));
            $this->assertSame(PaymentAttemptStatus::Succeeded->value, $winnerResult['status'] ?? null);
            $this->assertSame(PaymentAttemptStatus::Reconciliation->value, $contenderResult['status'] ?? null);
            $this->assertGreaterThanOrEqual(
                200,
                $contenderResult['elapsed_ms'] ?? 0,
                'The contender did not wait on the payment-summary row lock.',
            );

            DB::purge();

            $this->assertSame(PaymentSummaryStatus::Paid, $payment->fresh()->status);
            $this->assertSame($winner->id, $payment->fresh()->successful_attempt_id);
            $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
            $this->assertDatabaseCount('payment_provider_events', 2);
            $this->assertDatabaseHas('payment_attempts', [
                'id' => $winner->id,
                'status' => PaymentAttemptStatus::Succeeded->value,
            ]);
            $this->assertDatabaseHas('payment_attempts', [
                'id' => $contender->id,
                'status' => PaymentAttemptStatus::Reconciliation->value,
            ]);
        } finally {
            foreach ($children as $child) {
                if ($child > 0) {
                    posix_kill($child, SIGTERM);
                    pcntl_waitpid($child, $status);
                }
            }

            DB::purge();
            Artisan::call('migrate:fresh', ['--force' => true]);
            File::deleteDirectory($directory);
        }
    }

    private function forkCallbackWorker(string $directory, int $attemptId, string $eventId, bool $ownsInitialLock): int
    {
        $pid = pcntl_fork();

        if ($pid === -1) {
            throw new RuntimeException('Unable to fork the payment callback worker.');
        }

        if ($pid === 0) {
            $this->runCallbackWorker($directory, $attemptId, $eventId, $ownsInitialLock);
        }

        return $pid;
    }

    private function runCallbackWorker(string $directory, int $attemptId, string $eventId, bool $ownsInitialLock): never
    {
        $resultName = $ownsInitialLock ? 'winner' : 'contender';
        $startedAt = hrtime(true);

        try {
            DB::purge();

            if ($ownsInitialLock) {
                DB::beginTransaction();
                $attempt = PaymentAttempt::query()->findOrFail($attemptId);
                Payment::query()->lockForUpdate()->findOrFail($attempt->payment_summary_id);
                File::put($directory.'/lock.ready', 'ready');
                $this->waitForFile($directory.'/contender.ready', 5);
                usleep(500_000);
            } else {
                $this->waitForFile($directory.'/lock.ready', 5);
                File::put($directory.'/contender.ready', 'ready');
            }

            $attempt = PaymentAttempt::query()->findOrFail($attemptId);
            $processed = app(PaymentLifecycleService::class)->processCallback(
                $this->validGateway(),
                $attempt,
                $eventId,
                'payment.succeeded',
                ['result_code' => 'ok', 'provider_ref' => $resultName.'-provider-ref'],
                'valid',
                true,
            );

            if ($ownsInitialLock) {
                DB::commit();
            }

            File::put($directory.'/'.$resultName.'.json', json_encode([
                'status' => $processed->status->value,
                'elapsed_ms' => (int) ((hrtime(true) - $startedAt) / 1_000_000),
            ], JSON_THROW_ON_ERROR));

            exit(0);
        } catch (Throwable $exception) {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            File::put($directory.'/'.$resultName.'.json', json_encode([
                'error' => $exception::class,
                'message' => $exception->getMessage(),
            ], JSON_THROW_ON_ERROR));

            exit(1);
        }
    }

    /** @return list<int> */
    private function waitForChildren(array $children, int $timeoutSeconds): array
    {
        $remaining = array_fill_keys($children, true);
        $exitCodes = [];
        $deadline = microtime(true) + $timeoutSeconds;

        while ($remaining !== [] && microtime(true) < $deadline) {
            foreach (array_keys($remaining) as $pid) {
                $result = pcntl_waitpid($pid, $status, WNOHANG);

                if ($result === $pid) {
                    $exitCodes[] = pcntl_wifexited($status) ? pcntl_wexitstatus($status) : 1;
                    unset($remaining[$pid]);
                }
            }

            if ($remaining !== []) {
                usleep(20_000);
            }
        }

        foreach (array_keys($remaining) as $pid) {
            posix_kill($pid, SIGTERM);
            pcntl_waitpid($pid, $status);
            $exitCodes[] = 1;
        }

        sort($exitCodes);

        return $exitCodes;
    }

    private function waitForFile(string $path, int $timeoutSeconds): void
    {
        $deadline = microtime(true) + $timeoutSeconds;

        while (! File::exists($path) && microtime(true) < $deadline) {
            usleep(10_000);
        }

        if (! File::exists($path)) {
            throw new RuntimeException("Timed out waiting for concurrency barrier: {$path}");
        }
    }

    /** @return array<string, mixed> */
    private function readResult(string $path): array
    {
        if (! File::exists($path)) {
            return ['error' => 'missing_result', 'path' => $path];
        }

        return json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
    }

    private function validGateway(): PaymentGateway
    {
        return new class implements PaymentGateway
        {
            public function createAttempt(array $request): array
            {
                return [];
            }

            public function verifyCallback(array $callback, string $signature): bool
            {
                return true;
            }
        };
    }
}
