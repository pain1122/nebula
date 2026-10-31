<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\PaymentAdjustmentStatus;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentSummaryStatus;
use App\Http\Controllers\Api\ApiController;
use App\Models\Payment;
use App\Models\PaymentAdjustment;
use App\Models\PaymentAttempt;
use App\Models\ReservationStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Safe financial history metadata. Reads never reconcile or execute adjustments. */
class PaymentReadController extends ApiController
{
    public function index(Request $request)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, [
            'q' => ['sometimes', 'string', 'max:100'],
            'status' => ['sometimes', Rule::enum(PaymentSummaryStatus::class)],
            'reservation_status' => ['sometimes', Rule::enum(ReservationStatus::class)],
            'attempt_status' => ['sometimes', Rule::enum(PaymentAttemptStatus::class)],
            'adjustment_status' => ['sometimes', Rule::enum(PaymentAdjustmentStatus::class)],
            'provider' => ['sometimes', 'string', 'regex:/\A[a-z][a-z0-9_-]{0,59}\z/'],
            'currency' => ['sometimes', 'string', 'regex:/\A[A-Z]{3}\z/'],
            'doctor_id' => ['sometimes', 'integer', 'min:1'], 'patient_id' => ['sometimes', 'integer', 'min:1'],
            'workplace_id' => ['sometimes', 'integer', 'min:1'], 'checkup_id' => ['sometimes', 'integer', 'min:1'],
            'from' => ['required_with:to', 'date_format:Y-m-d'], 'to' => ['required_with:from', 'date_format:Y-m-d'],
            'sort_by' => ['sometimes', Rule::in(['id', 'created_at', 'updated_at', 'status', 'amount', 'paid_at'])],
            'sort_dir' => ['sometimes', Rule::in(['asc', 'desc'])],
        ]);
        $query = $this->payments($actor);
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['currency'])) {
            $query->where('currency', $filters['currency']);
        }
        $query->whereHas('reservation', function ($reservation) use ($filters) {
            foreach (['doctor_id' => 'doctor_profile_id', 'patient_id' => 'user_id', 'workplace_id' => 'doctor_workplace_id', 'checkup_id' => 'checkup_id', 'reservation_status' => 'status'] as $filter => $column) {
                if (isset($filters[$filter])) {
                    $reservation->where($column, $filters[$filter]);
                }
            }
        });
        // Provider + attempt status must match the same attempt, not unrelated retries.
        if (isset($filters['attempt_status'])) {
            $query->whereHas('attempts', function ($attempt) use ($filters) {
                $attempt->where('status', $filters['attempt_status']);
                if (isset($filters['provider'])) {
                    $attempt->where('provider', $filters['provider']);
                }
            });
        } elseif (isset($filters['provider'])) {
            $query->where(fn ($q) => $q->where('provider', $filters['provider'])->orWhereHas('attempts', fn ($attempt) => $attempt->where('provider', $filters['provider'])));
        }
        if (isset($filters['adjustment_status'])) {
            $query->whereHas('adjustments', fn ($adjustment) => $adjustment->where('status', $filters['adjustment_status']));
        }
        if (($term = trim($filters['q'] ?? '')) !== '') {
            $literal = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
            $query->where(function ($search) use ($term, $literal) {
                $search->whereIn('reservation_payment_summaries.public_id', [$term, strtolower($term), strtoupper($term)])
                    ->orWhereHas('reservation', function ($reservation) use ($term, $literal) {
                        $reservation->whereIn('public_id', [$term, strtolower($term), strtoupper($term)])
                            ->orWhereRaw("checkup_title_snapshot LIKE ? ESCAPE '!'", [$literal])
                            ->orWhereRaw("hospital_name_snapshot LIKE ? ESCAPE '!'", [$literal])
                            ->orWhereHas('user', fn ($patient) => $patient->whereRaw("name LIKE ? ESCAPE '!'", [$literal]))
                            ->orWhereHas('doctor', fn ($doctor) => $doctor->withTrashed()->whereHas('user', fn ($user) => $user->whereRaw("name LIKE ? ESCAPE '!'", [$literal])));
                    });
            });
        }
        $period = null;
        if (isset($filters['from'])) {
            $from = CarbonImmutable::createFromFormat('!Y-m-d', $filters['from'], 'Asia/Tehran');
            $to = CarbonImmutable::createFromFormat('!Y-m-d', $filters['to'], 'Asia/Tehran');
            if ($to->lessThan($from) || $from->diffInDays($to) > 89) {
                throw ValidationException::withMessages(['to' => 'Choose at most 90 ordered payment-creation calendar days.']);
            }
            $query->where('reservation_payment_summaries.created_at', '>=', $from->utc())->where('reservation_payment_summaries.created_at', '<', $to->addDay()->utc());
            $period = ['from' => $filters['from'], 'to' => $filters['to'], 'timezone' => 'Asia/Tehran', 'field' => 'payment_created_at'];
        }
        $sort = $filters['sort_by'] ?? 'created_at';
        $direction = $filters['sort_dir'] ?? 'desc';
        $query->orderBy('reservation_payment_summaries.'.$sort, $direction);
        if ($sort !== 'id') {
            $query->orderBy('reservation_payment_summaries.id', $direction);
        }
        $rows = $query->paginate($filters['per_page'] ?? 20);

        return $this->respond($request, $actor, $rows->getCollection()->map(fn ($row) => $this->data($row)),
            $this->pagination($rows) + ['period' => $period], $rows->getCollection()->modelKeys());
    }

    public function show(Request $request, string $paymentPublicId)
    {
        $actor = $this->actor($request);
        abort_if($request->query(), 422, 'Payment detail accepts no filters.');
        $payment = $this->payment($actor, $paymentPublicId);

        return $this->respond($request, $actor, $this->data($payment), [], [$payment->id]);
    }

    public function attempts(Request $request, string $paymentPublicId)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, ['status' => ['sometimes', Rule::enum(PaymentAttemptStatus::class)]]);
        $payment = $this->payment($actor, $paymentPublicId);
        $query = $payment->attempts();
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        $rows = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($filters['per_page'] ?? 20);

        return $this->respond($request, $actor, $rows->getCollection()->map(fn ($row) => $this->attemptData($row, $payment)), $this->pagination($rows) + ['payment_public_id' => (string) $payment->public_id], [$payment->id]);
    }

    public function adjustments(Request $request, string $paymentPublicId)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, ['status' => ['sometimes', Rule::enum(PaymentAdjustmentStatus::class)], 'type' => ['sometimes', Rule::in(['refund', 'void'])]]);
        $payment = $this->payment($actor, $paymentPublicId);
        $query = $payment->adjustments();
        foreach (['status', 'type'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        $rows = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($filters['per_page'] ?? 20);
        $items = $rows->getCollection()->map(function (PaymentAdjustment $row) use ($payment) {
            abort_unless(in_array($row->getRawOriginal('type'), ['refund', 'void'], true) && PaymentAdjustmentStatus::tryFrom($row->getRawOriginal('status')), 503, 'Adjustment state is unavailable.');

            return ['public_id' => (string) $row->public_id, 'type' => $row->getRawOriginal('type'), 'status' => $row->getRawOriginal('status'),
                'amount' => $this->amount($row->amount), 'currency' => $this->currency($row->currency),
                'currency_matches_payment' => $row->currency === $payment->currency, 'reason_recorded' => trim((string) $row->reason) !== '',
                'created_at' => $row->created_at?->toISOString(), 'updated_at' => $row->updated_at?->toISOString()];
        });

        return $this->respond($request, $actor, $items, $this->pagination($rows) + ['pending_is_request_only' => true, 'payment_public_id' => (string) $payment->public_id], [$payment->id]);
    }

    public function events(Request $request, string $paymentPublicId)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, ['signature_verified' => ['sometimes', 'boolean'], 'processed' => ['sometimes', Rule::in(['yes', 'no'])]]);
        $payment = $this->payment($actor, $paymentPublicId);
        $query = DB::table('payment_provider_events')->join('payment_attempts', 'payment_attempts.id', '=', 'payment_provider_events.payment_attempt_id')
            ->where('payment_attempts.payment_summary_id', $payment->id)
            ->select('payment_provider_events.public_id', 'payment_provider_events.provider', 'payment_provider_events.event_type', 'payment_provider_events.signature_verified', 'payment_provider_events.received_at', 'payment_provider_events.processed_at', 'payment_attempts.public_id as attempt_public_id');
        if (array_key_exists('signature_verified', $filters)) {
            $query->where('signature_verified', (bool) $filters['signature_verified']);
        }
        if (isset($filters['processed'])) {
            $filters['processed'] === 'yes' ? $query->whereNotNull('processed_at') : $query->whereNull('processed_at');
        }
        $rows = $query->orderByDesc('payment_provider_events.received_at')->orderByDesc('payment_provider_events.id')->paginate($filters['per_page'] ?? 20);
        $items = $rows->getCollection()->map(fn ($row) => ['public_id' => $row->public_id, 'attempt_public_id' => $row->attempt_public_id,
            'provider' => $this->provider($row->provider), 'event_type' => in_array($row->event_type, ['payment.succeeded', 'payment.failed'], true) ? $row->event_type : null,
            'signature_verified' => (bool) $row->signature_verified,
            'received_at' => $row->received_at ? CarbonImmutable::parse($row->received_at)->toISOString() : null,
            'processed_at' => $row->processed_at ? CarbonImmutable::parse($row->processed_at)->toISOString() : null]);

        return $this->respond($request, $actor, $items, $this->pagination($rows) + ['payment_public_id' => (string) $payment->public_id], [$payment->id]);
    }

    private function payments(User $actor): Builder
    {
        $visible = fn ($user) => $user->where(fn ($q) => $q->where('users.id', $actor->id)->orWhereDoesntHave('roles', fn ($role) => $role->whereIn('name', ['admin', 'root-admin'])));

        return Payment::query()->select('reservation_payment_summaries.*')->whereHas('reservation', fn ($r) => $r->whereHas('user', $visible)->whereHas('doctor', fn ($doctor) => $doctor->withTrashed()->whereHas('user', $visible)))
            ->with(['reservation:id,public_id,user_id,doctor_profile_id,doctor_workplace_id,checkup_id,status,starts_at,ends_at,price_snapshot,currency_snapshot,checkup_title_snapshot,hospital_name_snapshot,timezone',
                'reservation.user:id,public_id,name', 'reservation.doctor' => fn ($doctor) => $doctor->withTrashed()->select(['id', 'public_id', 'user_id', 'deleted_at']),
                'reservation.doctor.user:id,public_id,name', 'successfulAttempt'])
            ->withCount(['attempts', 'adjustments', 'attempts as reconciliation_attempts_count' => fn ($q) => $q->where('status', 'reconciliation'),
                'adjustments as pending_adjustments_count' => fn ($q) => $q->where('status', 'pending')]);
    }

    private function payment(User $actor, string $id): Payment
    {
        validator(['id' => $id], ['id' => ['required', 'ulid']])->validate();

        return $this->payments($actor)->whereIn('reservation_payment_summaries.public_id', [$id, strtolower($id), strtoupper($id)])->firstOrFail();
    }

    private function data(Payment $payment): array
    {
        $reservation = $payment->reservation;
        $status = $payment->getRawOriginal('status');
        abort_unless(PaymentSummaryStatus::tryFrom($status), 503, 'Payment state is unavailable.');
        abort_unless(ReservationStatus::tryFrom($reservation->getRawOriginal('status')), 503, 'Reservation state is unavailable.');
        $canonical = $payment->successfulAttempt;
        $bound = $canonical && $canonical->payment_summary_id === $payment->id && $canonical->reservation_id === $payment->reservation_id;
        $acceptable = match ($status) {
            'paid' => ['succeeded'], 'refunded' => ['succeeded', 'refunded'], 'voided' => ['succeeded', 'voided'], default => ['succeeded'],
        };
        $consistent = $canonical ? $bound && in_array($canonical->getRawOriginal('status'), $acceptable, true)
            && $this->amount($canonical->amount) === $this->amount($payment->amount) && $canonical->currency === $payment->currency && $status !== 'unpaid'
            : $payment->successful_attempt_id === null && ! in_array($status, ['paid', 'refunded', 'voided'], true);

        return ['public_id' => (string) $payment->public_id, 'amount' => $this->amount($payment->amount), 'currency' => $this->currency($payment->currency),
            'status' => $status, 'provider' => $this->provider($payment->provider),
            'paid_at' => $payment->paid_at?->toISOString(), 'refunded_at' => $payment->refunded_at?->toISOString(),
            'created_at' => $payment->created_at?->toISOString(), 'updated_at' => $payment->updated_at?->toISOString(),
            'canonical_consistent' => (bool) $consistent, 'canonical_attempt' => $bound ? $this->attemptData($canonical, $payment) : null,
            'counts' => ['attempts' => (int) $payment->attempts_count, 'adjustments' => (int) $payment->adjustments_count,
                'reconciliation_attempts' => (int) $payment->reconciliation_attempts_count, 'pending_adjustments' => (int) $payment->pending_adjustments_count],
            'reservation' => ['id' => (int) $reservation->id, 'public_id' => (string) $reservation->public_id, 'status' => $reservation->getRawOriginal('status'),
                'starts_at' => $reservation->starts_at?->toISOString(), 'ends_at' => $reservation->ends_at?->toISOString(), 'timezone' => $reservation->timezone,
                'booked_amount' => $this->amount($reservation->getRawOriginal('price_snapshot')), 'booked_currency' => $this->currency($reservation->currency_snapshot),
                'workplace_id' => $reservation->doctor_workplace_id, 'checkup_id' => $reservation->checkup_id,
                'checkup_title' => $reservation->checkup_title_snapshot, 'hospital_name' => $reservation->hospital_name_snapshot,
                'patient' => ['id' => (int) $reservation->user->id, 'public_id' => (string) $reservation->user->public_id, 'name' => $reservation->user->name],
                'doctor' => ['id' => (int) $reservation->doctor->id, 'public_id' => (string) $reservation->doctor->public_id, 'user_public_id' => (string) $reservation->doctor->user->public_id,
                    'name' => $reservation->doctor->user->name, 'archived' => $reservation->doctor->trashed()]],
        ];
    }

    private function attemptData(PaymentAttempt $row, Payment $payment): array
    {
        $status = $row->getRawOriginal('status');
        abort_unless(PaymentAttemptStatus::tryFrom($status), 503, 'Attempt state is unavailable.');

        return ['public_id' => (string) $row->public_id, 'provider' => $this->provider($row->provider), 'status' => $status,
            'amount' => $this->amount($row->amount), 'currency' => $this->currency($row->currency),
            'binding_consistent' => $row->reservation_id === $payment->reservation_id && $row->payment_summary_id === $payment->id,
            'is_canonical' => $payment->successful_attempt_id === $row->id, 'has_failure' => $row->failure_code !== null || $row->failure_message !== null,
            'initiated_at' => $row->initiated_at?->toISOString(), 'expires_at' => $row->expires_at?->toISOString(), 'completed_at' => $row->completed_at?->toISOString()];
    }

    private function filters(Request $request, array $extra): array
    {
        $rules = ['page' => ['sometimes', 'integer', 'between:1,1000'], 'per_page' => ['sometimes', 'integer', 'between:1,100']] + $extra;
        if (array_diff(array_keys($request->query()), array_keys($rules))) {
            throw ValidationException::withMessages(['filters' => 'Unsupported payment filter.']);
        }

        return $request->validate($rules);
    }

    private function actor(Request $request): User
    {
        $actor = User::with('roles')->findOrFail($request->user()->id);
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function respond(Request $request, User $actor, mixed $data, array $meta, array $ids)
    {
        $current = $this->actor($request);
        abort_unless($actor->roles->pluck('name')->sort()->values()->all() === $current->roles->pluck('name')->sort()->values()->all(), 403);
        abort_unless($this->payments($current)->whereKey($ids)->count() === count(array_unique($ids)), 403);

        return $this->successResponse(data: $data, meta: $meta + ['read_only' => true, 'generated_at' => now()->toISOString(), 'adjustments_execute_provider' => false])->header('Cache-Control', 'no-store, private');
    }

    private function amount(mixed $value): string
    {
        abort_unless(is_int($value) || is_string($value), 503, 'Exact amount is unavailable.');
        $amount = (string) $value;
        abort_unless(preg_match('/\A(?:0|[1-9][0-9]{0,19})\z/', $amount) === 1, 503, 'Exact amount is unavailable.');
        abort_unless(strlen($amount) < 20 || strcmp($amount, '18446744073709551615') <= 0, 503, 'Exact amount exceeds the storage bound.');

        return $amount;
    }

    private function currency(mixed $value): string
    {
        abort_unless(is_string($value) && preg_match('/\A[A-Z]{3}\z/', $value) === 1, 503, 'Currency is unavailable.');

        return $value;
    }

    private function provider(?string $value): ?string
    {
        return $value !== null && preg_match('/\A[a-z][a-z0-9_-]{0,59}\z/', $value) === 1 ? $value : null;
    }

    private function pagination($rows): array
    {
        return ['pagination' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'per_page' => $rows->perPage(), 'total' => $rows->total()]];
    }
}
