<?php

namespace App\Services;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Models\PaymentAdjustment;
use App\Models\QuestionnaireSubmission;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/** Metadata-only dashboard. No reconciliation, materialization, audit-feed or notification delivery. */
final class AdminDashboardRead
{
    public function actor(User $user): User
    {
        $actor = User::with('roles')->findOrFail($user->id);
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function visible(User $actor): Builder
    {
        return User::query()->where(fn ($q) => $q->where('users.id', $actor->id)
            ->orWhereDoesntHave('roles', fn ($roles) => $roles->whereIn('name', ['admin', 'root-admin'])));
    }

    private function reservations(User $actor): Builder
    {
        $users = $this->visible($actor)->select('users.id');

        return Reservation::query()->whereIn('user_id', $users)->whereHas('doctor', fn ($doctor) => $doctor->withTrashed()->whereIn('user_id', $users));
    }

    private function period(Builder $query, CarbonImmutable $from, CarbonImmutable $until, string $column = 'created_at'): Builder
    {
        return $query->where($column, '>=', $from->utc())->where($column, '<', $until->utc());
    }

    public function appointments(User $actor, CarbonImmutable $from, CarbonImmutable $until): array
    {
        $rows = $this->reservations($actor)->where('starts_at', '<', $until->utc())->where('ends_at', '>', $from->utc())
            ->orderBy('starts_at')->orderBy('id')->limit(201)
            ->with(['user:id,name', 'doctor' => fn ($q) => $q->withTrashed()->select(['id', 'user_id']), 'doctor.user:id,name'])
            ->get(['id', 'public_id', 'user_id', 'doctor_profile_id', 'checkup_title_snapshot', 'status', 'starts_at', 'ends_at']);

        return ['from' => $from->toDateString(), 'until' => $until->toDateString(), 'timezone' => 'Asia/Tehran',
            'limit' => 200, 'has_more' => $rows->count() > 200,
            'appointments' => $rows->take(200)->map(fn ($row) => ['id' => (int) $row->id, 'public_id' => (string) $row->public_id,
                'patient' => $row->user->name, 'doctor' => $row->doctor->user->name, 'checkup' => $row->checkup_title_snapshot,
                'status' => $row->getRawOriginal('status'), 'starts_at' => $row->starts_at->toISOString(), 'ends_at' => $row->ends_at->toISOString()])->all()];
    }

    private function groups(Builder $query, string $column, array $allowed): array
    {
        $result = array_fill_keys($allowed, 0);
        foreach ($query->select($column)->selectRaw('COUNT(*) AS total')->groupBy($column)->toBase()->get() as $row) {
            abort_unless(array_key_exists($row->$column, $result), 503, 'Dashboard state is unavailable.');
            $result[$row->$column] = (int) $row->total;
        }

        return $result;
    }

    private function daily(Builder $query, CarbonImmutable $from, CarbonImmutable $until, string $column): array
    {
        $select = [];
        $bindings = [];
        for ($day = 0; $day < 30; $day++) {
            $start = $from->addDays($day);
            $end = $start->addDay()->min($until);
            $select[] = 'COALESCE(SUM(CASE WHEN '.$column.' >= ? AND '.$column.' < ? THEN 1 ELSE 0 END),0) AS day_'.$day;
            $bindings[] = $start->utc()->toDateTimeString();
            $bindings[] = $end->utc()->toDateTimeString();
        }
        $row = $this->period($query, $from, $until, $column)->selectRaw(implode(',', $select), $bindings)->toBase()->first();

        return array_map(fn ($day) => (int) $row->{'day_'.$day}, range(0, 29));
    }

    public function capture(User $actor, CarbonImmutable $until): array
    {
        $from = $until->setTimezone('Asia/Tehran')->startOfDay()->subDays(29);
        $reservations = $this->reservations($actor);
        $recent = $this->period(clone $reservations, $from, $until);
        $states = $this->groups(clone $recent, 'status', array_column(ReservationStatus::cases(), 'value'));
        $medical = ReservationMedicalRequest::whereIn('reservation_id', (clone $reservations)->select('id'));
        $medicalStates = $this->groups($this->period(clone $medical, $from, $until), 'status', ['open', 'in_review', 'completed', 'cancelled']);
        $submissions = QuestionnaireSubmission::where(fn ($q) => $q->whereNull('user_id')->orWhereIn('user_id', $this->visible($actor)->select('users.id')));
        $submissionCount = $this->period(clone $submissions, $from, $until)->count();
        $users = $this->visible($actor)->select('users.id');
        $doctors = DoctorProfile::whereIn('user_id', $users);
        $rankings = [];
        foreach (['checkups' => 'checkup_id', 'doctors' => 'doctor_profile_id'] as $kind => $column) {
            $rows = (clone $recent)->select($column)->selectRaw('COUNT(*) AS reservation_count')->groupBy($column)
                ->orderByDesc('reservation_count')->orderBy($column)->limit(5)->toBase()->get();
            $ids = $rows->pluck($column);
            $resources = $kind === 'checkups' ? Checkup::withTrashed()->whereIn('id', $ids)->get(['id', 'public_id', 'title', 'deleted_at'])->keyBy('id')
                : DoctorProfile::withTrashed()->whereIn('id', $ids)->with('user:id,name')->get(['id', 'public_id', 'user_id', 'deleted_at'])->keyBy('id');
            $rankings[$kind] = $rows->map(function ($row) use ($kind, $column, $resources) {
                $resource = $resources->get($row->$column);
                abort_unless($resource, 503, 'Dashboard references are unavailable.');

                return ['id' => (int) $resource->id, 'public_id' => (string) $resource->public_id,
                    'name' => $kind === 'checkups' ? $resource->title : $resource->user->name,
                    'archived' => $resource->trashed(), 'reservations' => (int) $row->reservation_count];
            })->all();
        }
        $latest = (clone $recent)->orderByDesc('created_at')->orderByDesc('id')->limit(5)
            ->with(['user:id,name', 'doctor' => fn ($q) => $q->withTrashed()->select(['id', 'user_id']), 'doctor.user:id,name'])
            ->get(['id', 'public_id', 'user_id', 'doctor_profile_id', 'checkup_title_snapshot', 'status', 'starts_at', 'created_at']);
        $paymentQuery = $this->period(Payment::whereIn('reservation_payment_summaries.reservation_id', (clone $reservations)->select('id')), $from, $until, 'reservation_payment_summaries.created_at');
        $paid = (clone $paymentQuery)->where('reservation_payment_summaries.status', 'paid');
        $canonical = (clone $paid)->join('payment_attempts as canonical', 'canonical.id', '=', 'reservation_payment_summaries.successful_attempt_id')
            ->whereColumn('canonical.payment_summary_id', 'reservation_payment_summaries.id')
            ->whereColumn('canonical.reservation_id', 'reservation_payment_summaries.reservation_id')
            ->whereColumn('canonical.amount', 'reservation_payment_summaries.amount')->whereColumn('canonical.currency', 'reservation_payment_summaries.currency')
            ->where('canonical.status', 'succeeded');
        $paidCount = (clone $canonical)->count();
        $money = (clone $canonical)->select('reservation_payment_summaries.currency')->selectRaw('SUM(reservation_payment_summaries.amount) AS amount, COUNT(*) AS total')
            ->groupBy('reservation_payment_summaries.currency')->orderBy('reservation_payment_summaries.currency')->limit(21)->toBase()->get();
        $amounts = $money->take(20)->map(function ($row) {
            abort_unless((is_int($row->amount) || is_string($row->amount)) && preg_match('/\A[0-9]{1,65}\z/', (string) $row->amount)
                && is_string($row->currency) && preg_match('/\A[A-Z]{3}\z/', $row->currency), 503, 'Exact dashboard money is unavailable.');

            return ['currency' => $row->currency, 'amount' => (string) $row->amount, 'payments' => (int) $row->total];
        })->all();

        return [
            'period' => ['from' => $from->toDateString(), 'through' => $until->setTimezone('Asia/Tehran')->toDateString(),
                'starts_at' => $from->utc()->toISOString(), 'ends_at' => $until->utc()->toISOString(), 'timezone' => 'Asia/Tehran', 'days' => 30],
            'reservations' => ['created' => array_sum($states), 'states' => $states,
                'upcoming' => (clone $reservations)->where('starts_at', '>=', $until)->where(fn ($q) => $q->where('status', 'confirmed')
                    ->orWhere(fn ($q) => $q->where('status', 'pending')->where('hold_expires_at', '>', $until)))->count()],
            'medical_requests' => ['created' => array_sum($medicalStates), 'states' => $medicalStates],
            'submissions' => ['created' => $submissionCount],
            'accounts' => ['patients' => $this->visible($actor)->whereHas('roles', fn ($q) => $q->where('name', 'patient'))->count(),
                'doctors' => (clone $doctors)->count(), 'verified_doctors' => (clone $doctors)->where('verified', true)->count()],
            'payments' => ['paid' => $paidCount, 'inconsistent_paid' => (clone $paid)->count() - $paidCount,
                'by_currency' => $amounts, 'more_currencies' => $money->count() > 20,
                'pending_requests' => PaymentAdjustment::whereIn('payment_summary_id', (clone $paymentQuery)->select('reservation_payment_summaries.id'))->where('status', 'pending')->count()],
            'trends' => ['dates' => array_map(fn ($day) => $from->addDays($day)->toDateString(), range(0, 29)),
                'bookings' => $this->daily(clone $reservations, $from, $until, 'created_at'),
                'completions' => $this->daily((clone $reservations)->where('status', 'completed'), $from, $until, 'completed_at'),
                'submissions' => $this->daily(clone $submissions, $from, $until, 'created_at')],
            'rankings' => $rankings,
            'latest_reservations' => $latest->map(fn ($row) => ['id' => (int) $row->id, 'public_id' => (string) $row->public_id,
                'patient' => $row->user->name, 'doctor' => $row->doctor->user->name, 'checkup' => $row->checkup_title_snapshot,
                'status' => $row->getRawOriginal('status'), 'starts_at' => $row->starts_at?->toISOString(), 'created_at' => $row->created_at?->toISOString()])->all(),
            'locations' => ['available' => false], 'updates' => ['available' => false, 'reserved' => true],
        ];
    }
}
