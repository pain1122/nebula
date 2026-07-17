<?php

namespace Database\Seeders;

use App\Models\Checkup;
use App\Models\DoctorWorkplace;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class ReservationPaymentDemoSeeder extends Seeder
{
    public function run(): void
    {
        $patient = User::where('email', 'patient@checkupino.test')->firstOrFail();
        $secondPatient = User::where('email', 'patient2@checkupino.test')->firstOrFail();
        $workplace = DoctorWorkplace::query()
            ->whereHas('hospital', fn ($query) => $query->where('slug', 'mehr-demo-hospital'))
            ->with(['hospital', 'doctorProfile.user'])
            ->firstOrFail();
        $checkup = Checkup::where('slug', 'cardio-eval')->with('category')->firstOrFail();
        $service = $workplace->checkups()->whereKey($checkup->id)->firstOrFail();
        $price = (int) ($service->pivot->price_override ?? $checkup->price);
        $duration = (int) ($service->pivot->duration_override_minutes ?? $checkup->default_duration_minutes);
        $currency = $service->pivot->currency_override ?? $checkup->currency;
        $today = CarbonImmutable::now('Asia/Tehran')->startOfDay();

        $fixtures = [
            ['key' => 'demo-pending-live', 'user' => $patient, 'status' => ReservationStatus::Pending, 'starts_at' => $today->addDays(8)->setTime(9, 0), 'hold_expires_at' => now()->addHour(), 'payment' => 'unpaid'],
            ['key' => 'demo-payment-failed', 'user' => $secondPatient, 'status' => ReservationStatus::Pending, 'starts_at' => $today->addDays(9)->setTime(9, 0), 'hold_expires_at' => now()->addHour(), 'payment' => 'failed'],
            ['key' => 'demo-confirmed-paid', 'user' => $patient, 'status' => ReservationStatus::Confirmed, 'starts_at' => $today->addDays(10)->setTime(9, 0), 'hold_expires_at' => null, 'payment' => 'paid'],
            ['key' => 'demo-completed-paid', 'user' => $secondPatient, 'status' => ReservationStatus::Completed, 'starts_at' => $today->subDays(10)->setTime(9, 0), 'hold_expires_at' => null, 'payment' => 'paid'],
            ['key' => 'demo-cancelled', 'user' => $patient, 'status' => ReservationStatus::Cancelled, 'starts_at' => $today->addDays(11)->setTime(9, 0), 'hold_expires_at' => null, 'payment' => 'unpaid'],
            ['key' => 'demo-expired', 'user' => $secondPatient, 'status' => ReservationStatus::Expired, 'starts_at' => $today->addDays(12)->setTime(9, 0), 'hold_expires_at' => now()->subHour(), 'payment' => 'unpaid'],
        ];

        foreach ($fixtures as $fixture) {
            $startsAt = $fixture['starts_at'];
            $reservation = Reservation::updateOrCreate(
                ['booking_idempotency_key' => $fixture['key']],
                [
                    'user_id' => $fixture['user']->id,
                    'doctor_profile_id' => $workplace->doctor_profile_id,
                    'doctor_workplace_id' => $workplace->id,
                    'checkup_id' => $checkup->id,
                    'starts_at' => $startsAt,
                    'ends_at' => $startsAt->addMinutes($duration),
                    'duration_minutes' => $duration,
                    'timezone' => $workplace->hospital->timezone,
                    'status' => $fixture['status']->value,
                    'hold_expires_at' => $fixture['hold_expires_at'],
                    'hospital_name_snapshot' => $workplace->hospital->name,
                    'doctor_name_snapshot' => $workplace->doctorProfile->user->name,
                    'checkup_title_snapshot' => $checkup->title,
                    'category_name_snapshot' => $checkup->category?->name,
                    'price_snapshot' => $price,
                    'currency_snapshot' => $currency,
                ]
            );

            $this->applyLifecycleTimestamps($reservation, $fixture['status'], $fixture['user']);
            $this->seedPayment($reservation, $fixture['payment'], $price, $currency);
        }
    }

    private function applyLifecycleTimestamps(Reservation $reservation, ReservationStatus $status, User $actor): void
    {
        $attributes = [
            'cancelled_at' => null,
            'cancelled_by' => null,
            'cancellation_reason' => null,
            'completed_at' => null,
            'expired_at' => null,
        ];

        if ($status === ReservationStatus::Cancelled) {
            $attributes['cancelled_at'] = now();
            $attributes['cancelled_by'] = $actor->id;
            $attributes['cancellation_reason'] = 'Demo cancellation fixture.';
        } elseif ($status === ReservationStatus::Completed) {
            $attributes['completed_at'] = now()->subDays(9);
        } elseif ($status === ReservationStatus::Expired) {
            $attributes['expired_at'] = now();
        }

        $reservation->forceFill($attributes)->save();
    }

    private function seedPayment(Reservation $reservation, string $fixture, int $amount, string $currency): void
    {
        $summary = Payment::updateOrCreate(
            ['reservation_id' => $reservation->id],
            [
                'provider' => $fixture === 'unpaid' ? null : 'sandbox',
                'provider_ref' => $fixture === 'paid' ? 'summary-'.$reservation->booking_idempotency_key : null,
                'amount' => $amount,
                'currency' => $currency,
                'status' => $fixture === 'paid' ? 'paid' : 'unpaid',
            ]
        );

        $summary->forceFill(['successful_attempt_id' => null, 'paid_at' => null, 'refunded_at' => null])->save();

        if ($fixture === 'unpaid') {
            return;
        }

        $attempt = PaymentAttempt::updateOrCreate(
            ['provider' => 'sandbox', 'idempotency_key' => 'attempt-'.$reservation->booking_idempotency_key],
            [
                'payment_summary_id' => $summary->id,
                'reservation_id' => $reservation->id,
                'provider_ref' => 'attempt-'.$reservation->booking_idempotency_key,
                'amount' => $amount,
                'currency' => $currency,
            ]
        );

        if ($fixture === 'paid') {
            $attempt->forceFill(['status' => 'succeeded', 'failure_code' => null, 'failure_message' => null, 'completed_at' => now(), 'metadata' => ['fixture' => true]])->save();
            $summary->forceFill(['successful_attempt_id' => $attempt->id, 'paid_at' => now()])->save();

            return;
        }

        $attempt->forceFill([
            'status' => 'failed',
            'failure_code' => 'sandbox_declined',
            'failure_message' => 'Retryable demo payment failure.',
            'completed_at' => now(),
            'metadata' => ['fixture' => true, 'retryable' => true],
        ])->save();
    }
}
