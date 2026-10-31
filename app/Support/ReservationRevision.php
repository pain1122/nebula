<?php

namespace App\Support;

use App\Models\AuditEvent;
use App\Models\Payment;
use App\Models\Reservation;
use DomainException;

final class ReservationRevision
{
    public const CONFLICT = 'reservation_revision_conflict';

    public static function token(Reservation $reservation, ?Payment $payment): string
    {
        return hash_hmac('sha256', json_encode([
            $reservation->only(['id', 'public_id', 'user_id', 'doctor_profile_id',
                'doctor_workplace_id', 'doctor_visit_slot_id', 'checkup_id', 'status',
                'starts_at', 'ends_at', 'duration_minutes', 'hold_expires_at',
                'price_snapshot', 'currency_snapshot', 'updated_at', 'completed_at',
                'cancelled_at', 'expired_at']),
            $payment?->only(['id', 'public_id', 'status', 'amount', 'currency',
                'successful_attempt_id', 'updated_at', 'paid_at', 'refunded_at']),
            $reservation->scheduleChanges()->max('id'),
            AuditEvent::query()->where('subject_type', $reservation->getMorphClass())
                ->where('subject_id', $reservation->id)->max('id'),
        ], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    public static function assertMatches(Reservation $reservation, ?Payment $payment, ?string $expected): void
    {
        if ($expected !== null && ! hash_equals(self::token($reservation, $payment), $expected)) {
            throw new DomainException(self::CONFLICT);
        }
    }
}
