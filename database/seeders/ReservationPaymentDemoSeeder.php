<?php

namespace Database\Seeders;

use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkplace;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\SchedulingService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class ReservationPaymentDemoSeeder extends Seeder
{
    public function run(): void
    {
        $today = CarbonImmutable::now('Asia/Tehran')->startOfDay();
        $fixtures = [
            ['demo-pending-live', 'patient@checkupino.test', ReservationStatus::Pending, 8, 'unpaid', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-payment-failed', 'patient2@checkupino.test', ReservationStatus::Pending, 9, 'failed', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-confirmed-paid', 'patient@checkupino.test', ReservationStatus::Confirmed, 10, 'paid', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-completed-paid', 'patient2@checkupino.test', ReservationStatus::Completed, -10, 'paid', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-cancelled', 'patient@checkupino.test', ReservationStatus::Cancelled, 11, 'unpaid', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-expired', 'patient2@checkupino.test', ReservationStatus::Expired, 12, 'unpaid', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-ready-to-complete', 'patient@checkupino.test', ReservationStatus::Confirmed, -1, 'paid', 'mehr-demo-hospital', 'cardio-eval'],
            ['demo-doctor2-confirmed', 'patient2@checkupino.test', ReservationStatus::Confirmed, 8, 'paid', 'pars-demo-medical-center', 'liver-panel'],
            ['demo-doctor2-ready-to-complete', 'patient2@checkupino.test', ReservationStatus::Confirmed, -1, 'paid', 'pars-demo-medical-center', 'liver-panel'],
        ];

        foreach ($fixtures as [$key, $email, $status, $offset, $payment, $hospital, $service]) {
            if (Reservation::where('booking_idempotency_key', $key)->exists()) {
                continue;
            }
            $patient = User::where('email', $email)->firstOrFail();
            $workplace = DoctorWorkplace::whereHas('hospital', fn ($q) => $q->where('slug', $hospital))
                ->with(['hospital', 'doctorProfile.user'])->firstOrFail();
            $checkup = $workplace->checkups()->where('slug', $service)->with('category')->firstOrFail();
            $rule = $workplace->workingWindows()->where('checkup_id', $checkup->id)->where('is_active', true)->firstOrFail();
            app(SchedulingService::class)->materializeRule($rule,
                Carbon::parse($today->subDays(35)), Carbon::parse($today->addDays(90)));
            $slots = DoctorVisitSlot::where('doctor_working_window_id', $rule->id)->where('is_active', true)
                ->whereDoesntHave('reservations');
            if ($offset < 0) {
                $cutoff = $offset === -1 ? CarbonImmutable::now('Asia/Tehran')->subHour() : $today->addDays($offset)->endOfDay();
                $slots->where('ends_at', '<=', $cutoff->utc())->where('starts_at', '>=', $today->subDays(35)->utc())->orderByDesc('starts_at');
            } else {
                $slots->where('starts_at', '>=', $today->addDays($offset)->utc())->orderBy('starts_at');
            }
            $visitSlot = $slots->firstOrFail();
            $reservation = Reservation::create([
                'booking_idempotency_key' => $key,
                'doctor_visit_slot_id' => $visitSlot->id,
                'user_id' => $patient->id,
                'doctor_profile_id' => $workplace->doctor_profile_id,
                'doctor_workplace_id' => $workplace->id,
                'checkup_id' => $checkup->id,
                'starts_at' => $visitSlot->starts_at,
                'ends_at' => $visitSlot->ends_at,
                'duration_minutes' => $rule->visit_duration_minutes,
                'timezone' => $workplace->hospital->timezone,
                'status' => $status->value,
                'hold_expires_at' => $status === ReservationStatus::Pending ? now()->addHour()
                    : ($status === ReservationStatus::Expired ? now()->subHour() : null),
                'hospital_name_snapshot' => $workplace->hospital->name,
                'doctor_name_snapshot' => $workplace->doctorProfile->user->name,
                'checkup_title_snapshot' => $checkup->title,
                'category_name_snapshot' => $checkup->category?->name,
                'price_snapshot' => $visitSlot->price,
                'currency_snapshot' => $visitSlot->currency,
            ]);
            $this->applyLifecycleTimestamps($reservation, $status, $patient);
            $this->seedPayment($reservation, $payment, $visitSlot->price, $visitSlot->currency);
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
            $attributes['completed_at'] = $reservation->ends_at->copy()->addMinutes(15);
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
