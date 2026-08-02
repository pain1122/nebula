<?php

namespace App\Services;

use App\Enums\OutboxEventType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class OutboxPublisher
{
    /** @param array<string, mixed> $payload */
    public function marketplace(Model $subject, OutboxEventType|string $eventType, array $payload, ?string $eventId = null): string
    {
        return $this->publish(
            connection: config('database.default'),
            subjectType: $subject->getMorphClass(),
            subjectId: $subject->getKey(),
            subjectPublicId: $subject->getAttribute('public_id'),
            eventType: $eventType,
            payload: $payload,
            eventId: $eventId,
            includeSubjectId: true,
        );
    }

    /** @param array<string, mixed> $payload */
    public function tenant(
        string $subjectType,
        ?string $subjectPublicId,
        OutboxEventType|string $eventType,
        array $payload,
        ?string $eventId = null,
    ): string {
        return $this->publish(
            connection: 'tenant',
            subjectType: $subjectType,
            subjectId: null,
            subjectPublicId: $subjectPublicId,
            eventType: $eventType,
            payload: $payload,
            eventId: $eventId,
            includeSubjectId: false,
        );
    }

    /** @param array<string, mixed> $payload */
    private function publish(
        string $connection,
        string $subjectType,
        mixed $subjectId,
        ?string $subjectPublicId,
        OutboxEventType|string $eventType,
        array $payload,
        ?string $eventId,
        bool $includeSubjectId,
    ): string {
        $eventType = $eventType instanceof OutboxEventType ? $eventType->value : $eventType;
        $events = config('outbox.events', []);
        $allowedKeys = is_array($events) ? ($events[$eventType] ?? null) : null;

        if (! is_array($allowedKeys)) {
            throw new InvalidArgumentException("Unknown outbox event type [{$eventType}].");
        }

        $unknownKeys = array_diff(array_keys($payload), $allowedKeys);

        if ($unknownKeys !== []) {
            throw ValidationException::withMessages([
                'payload' => 'Unsupported outbox payload fields: '.implode(', ', $unknownKeys).'.',
            ]);
        }

        if (array_diff($allowedKeys, array_keys($payload)) !== []) {
            throw ValidationException::withMessages([
                'payload' => "Outbox payload for [{$eventType}] is incomplete.",
            ]);
        }

        $resolvedEventId = $eventId ?? (string) Str::uuid();
        $record = [
            'public_id' => (string) Str::ulid(),
            'event_id' => $resolvedEventId,
            'event_type' => $eventType,
            'subject_type' => $subjectType,
            'subject_public_id' => $subjectPublicId,
            'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
            'status' => 'pending',
            'attempts' => 0,
            'available_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if ($includeSubjectId) {
            $record['subject_id'] = $subjectId;
        }

        DB::connection($connection)->table('outbox_events')->insert($record);

        return $resolvedEventId;
    }
}
