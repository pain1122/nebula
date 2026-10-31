<?php

namespace App\Http\Controllers\Api;

use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class DoctorAppointmentCalendarController extends ApiController
{
    private function owner(Request $request): User
    {
        $actor = $request->user()?->fresh(['roles', 'doctorProfile']);
        abort_unless($actor && $actor->permitsAuthentication() && $actor->hasRole('doctor') && $actor->doctorProfile, 403);

        return $actor;
    }

    public function __invoke(Request $request)
    {
        $actor = $this->owner($request);
        abort_if(array_diff(array_keys($request->query()), ['from', 'until']), 422);
        $data = $request->validate(['from' => ['required', 'date_format:Y-m-d'], 'until' => ['required', 'date_format:Y-m-d', 'after:from']]);
        $from = CarbonImmutable::parse($data['from'], 'Asia/Tehran')->startOfDay();
        $until = CarbonImmutable::parse($data['until'], 'Asia/Tehran')->startOfDay();
        abort_unless($from->diffInDays($until) <= 42, 422);
        $rows = Reservation::query()->where('doctor_profile_id', $actor->doctorProfile->id)
            ->where('status', 'confirmed')
            ->whereHas('payment', fn ($payment) => $payment->where('status', 'paid')->whereHas('successfulAttempt', fn ($attempt) => $attempt
                ->where('status', 'succeeded')->whereColumn('payment_attempts.payment_summary_id', 'reservation_payment_summaries.id')->whereColumn('payment_attempts.amount', 'reservation_payment_summaries.amount')
                ->whereColumn('payment_attempts.currency', 'reservation_payment_summaries.currency')
                ->whereColumn('payment_attempts.reservation_id', 'reservation_payment_summaries.reservation_id')))
            ->where('starts_at', '<', $until->utc())->where('ends_at', '>', $from->utc())
            ->with('user:id,name')->orderBy('starts_at')->orderBy('id')->limit(201)->get();
        $fresh = $this->owner($request);
        abort_unless($fresh->doctorProfile->id === $actor->doctorProfile->id, 403);

        return $this->successResponse(data: [
            'owner_id' => $actor->id, 'scope' => 'doctor_confirmed',
            'from' => $data['from'], 'until' => $data['until'], 'timezone' => 'Asia/Tehran', 'limit' => 200,
            'has_more' => $rows->count() > 200,
            'appointments' => $rows->take(200)->map(fn ($row) => [
                'id' => (int) $row->id, 'public_id' => $row->public_id,
                'patient' => $row->user->name, 'doctor' => $actor->name,
                'checkup' => $row->checkup_title_snapshot, 'status' => 'confirmed',
                'starts_at' => $row->starts_at->toISOString(), 'ends_at' => $row->ends_at->toISOString(),
            ])->all(),
        ], meta: ['read_only' => true, 'generated_at' => now()->toISOString()])->header('Cache-Control', 'no-store, private');
    }
}
