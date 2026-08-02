<?php

namespace App\Services;

use App\Contracts\Integrations\OutboxTransport;
use Illuminate\Support\Facades\DB;
use Throwable;

class OutboxDispatcher
{
    /**
     * @return array{pending: int, processing: int, dispatched: int, failed: int}
     */
    public function statusCounts(?string $connection = null): array
    {
        $connection ??= config('database.default');
        $counts = DB::connection($connection)->table('outbox_events')
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return [
            'pending' => (int) ($counts['pending'] ?? 0),
            'processing' => (int) ($counts['processing'] ?? 0),
            'dispatched' => (int) ($counts['dispatched'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
        ];
    }

    public function dispatchAvailable(
        OutboxTransport $transport,
        ?string $connection = null,
        int $limit = 100,
    ): int {
        $processed = 0;

        for ($i = 0; $i < max(1, min($limit, 1000)); $i++) {
            if ($this->dispatchNext($transport, $connection) === null) {
                break;
            }

            $processed++;
        }

        return $processed;
    }

    public function dispatchNext(OutboxTransport $transport, ?string $connection = null): ?string
    {
        $connection ??= config('database.default');
        $event = DB::connection($connection)->transaction(function () use ($connection): ?object {
            $db = DB::connection($connection);
            $maxAttempts = max(1, (int) config('outbox.max_attempts', 5));
            $leaseSeconds = max(1, (int) config('outbox.processing_lease_seconds', 300));
            $staleBefore = now()->subSeconds($leaseSeconds);

            $db->table('outbox_events')
                ->where('status', 'processing')
                ->where('updated_at', '<=', $staleBefore)
                ->where('attempts', '>=', $maxAttempts)
                ->update([
                    'status' => 'failed',
                    'last_error' => 'ProcessingLeaseExpired',
                    'updated_at' => now(),
                ]);

            $db->table('outbox_events')
                ->where('status', 'processing')
                ->where('updated_at', '<=', $staleBefore)
                ->where('attempts', '<', $maxAttempts)
                ->update([
                    'status' => 'pending',
                    'available_at' => now(),
                    'last_error' => 'ProcessingLeaseExpired',
                    'updated_at' => now(),
                ]);

            $event = $db->table('outbox_events')
                ->where('status', 'pending')
                ->where('available_at', '<=', now())
                ->orderBy('id')
                ->lockForUpdate()
                ->first();

            if ($event === null) {
                return null;
            }

            $db->table('outbox_events')->where('id', $event->id)->update([
                'status' => 'processing',
                'attempts' => $event->attempts + 1,
                'updated_at' => now(),
            ]);
            $event->attempts++;

            return $event;
        });

        if ($event === null) {
            return null;
        }

        try {
            $transport->dispatch(
                $event->event_id,
                $event->event_type,
                json_decode($event->payload, true, flags: JSON_THROW_ON_ERROR),
            );

            DB::connection($connection)->table('outbox_events')
                ->where('id', $event->id)
                ->where('status', 'processing')
                ->update([
                    'status' => 'dispatched',
                    'dispatched_at' => now(),
                    'last_error' => null,
                    'updated_at' => now(),
                ]);
        } catch (Throwable $exception) {
            $maxAttempts = max(1, (int) config('outbox.max_attempts', 5));
            $baseBackoff = max(1, (int) config('outbox.base_backoff_seconds', 30));
            $terminal = $event->attempts >= $maxAttempts;

            DB::connection($connection)->table('outbox_events')
                ->where('id', $event->id)
                ->where('status', 'processing')
                ->update([
                    'status' => $terminal ? 'failed' : 'pending',
                    'available_at' => now()->addSeconds($baseBackoff * (2 ** ($event->attempts - 1))),
                    'last_error' => class_basename($exception),
                    'updated_at' => now(),
                ]);
        }

        return $event->event_id;
    }
}
