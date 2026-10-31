<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentSummaryStatus;
use App\Models\Checkup;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\AdminReservationActionService;
use App\Services\ReservationOverrideService;
use App\Services\ReservationRescheduleService;
use App\Support\QuerySorting;
use App\Support\ReservationRevision;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminReservationController extends ApiController
{
    /**
     * فرمت استاندارد رزرو برای خروجی ادمین
     */
    private function formatAdminReservation(Reservation $r): array
    {
        $status = $r->status;

        if (is_object($status)) {
            if (property_exists($status, 'value')) {
                $status = $status->value;
            } elseif (property_exists($status, 'name')) {
                $status = $status->name;
            } else {
                $status = (string) get_class($status);
            }
        }

        return [
            'id' => $r->id,
            'public_id' => (string) $r->public_id,
            'starts_at' => optional($r->starts_at)->toIso8601String(),
            'ends_at' => optional($r->ends_at)->toIso8601String(),
            'status' => $status,
            'booked_amount' => (int) $r->price_snapshot,
            'booked_currency' => $r->currency_snapshot,
            'doctor_workplace_id' => $r->doctor_workplace_id,
            'hospital_name' => $r->hospital_name_snapshot,
            'timezone' => $r->timezone,
            'hold_expires_at' => $r->hold_expires_at?->toIso8601String(),
            'completed_at' => $r->completed_at?->toIso8601String(),
            'created_at' => $r->created_at?->toIso8601String(),

            'patient' => $r->user ? [
                'id' => $r->user->id,
                'public_id' => (string) $r->user->public_id,
                'name' => $r->user->name,
                'email' => null,
            ] : null,

            'doctor' => $r->doctor ? [
                'id' => $r->doctor->id,
                'public_id' => (string) $r->doctor->public_id,
                'user_id' => $r->doctor->user_id,
                'name' => optional($r->doctor->user)->name,
                'specialty' => optional($r->doctor->specialty)->name ?? null,
            ] : null,

            'checkup' => $r->checkup ? [
                'id' => $r->checkup->id,
                'public_id' => (string) $r->checkup->public_id,
                'title' => $r->checkup->title,
                'price' => $r->checkup->price,
                'money' => [
                    'amount' => $r->checkup->price,
                    'currency' => $r->checkup->currency,
                ],
                'category_id' => $r->checkup->checkup_category_id,
            ] : null,

            'payment' => $r->payment ? [
                'id' => $r->payment->id,
                'public_id' => (string) $r->payment->public_id,
                'amount' => $r->payment->amount,
                'currency' => $r->payment->currency,
                'money' => [
                    'amount' => $r->payment->amount,
                    'currency' => $r->payment->currency,
                ],
                'status' => $r->payment->status->value,
                'provider' => $r->payment->provider,
            ] : null,
        ];
    }

    /**
     * GET /api/admin/reservations
     * فیلترهای اختیاری:
     *  - ?status=pending|confirmed|completed|cancelled|expired
     *  - ?doctor_id=doctor_profile_id
     *  - ?user_id=user_id
     *  - ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive Asia/Tehran calendar dates)
     *  - ?workplace_id=doctor_workplace_id&checkup_id=checkup_id
     *  - ?payment_status=unpaid|paid|reconciliation|refunded|voided
     *  - ?q=reservation ID/public ID or related display name/title
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ReservationStatus::class)],
            'period' => ['nullable', Rule::in(['today', 'upcoming'])],
            'payment_status' => ['nullable', Rule::enum(PaymentSummaryStatus::class)],
            'doctor_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'checkup_id' => ['nullable', 'integer', 'min:1'],
            'workplace_id' => ['nullable', 'integer', 'min:1'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => [
                'nullable', 'date_format:Y-m-d',
                Rule::when($request->filled('from'), 'after_or_equal:from'),
            ],
            'q' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
            'sort_by' => ['nullable', 'string', 'max:50'],
            'sort' => ['nullable', 'string', 'max:50'],
            'sort_dir' => ['nullable', 'string', 'max:4'],
            'direction' => ['nullable', 'string', 'max:4'],
        ]);

        $clock = CarbonImmutable::now('UTC');
        $query = Reservation::with([
            'user:id,public_id,name',
            'doctor.user:id,public_id,name',
            'doctor.specialty:id,name',
            'checkup:id,public_id,title,price,currency,checkup_category_id',
            'payment',
        ])
            ->select('reservations.*');

        if (($filters['period'] ?? null) === 'today') {
            $day = $clock->setTimezone('Asia/Tehran')->startOfDay();
            $query->where('starts_at', '>=', $day->utc())->where('starts_at', '<', $day->addDay()->utc());
        } elseif (($filters['period'] ?? null) === 'upcoming') {
            $query->where('starts_at', '>=', $clock)->whereIn('status', [
                ReservationStatus::Pending->value, ReservationStatus::Confirmed->value,
            ]);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // فیلتر دکتر (doctor_profile_id)
        if ($request->filled('doctor_id')) {
            $query->where('doctor_profile_id', $request->integer('doctor_id'));
        }

        // فیلتر بیمار (user_id)
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if (isset($filters['workplace_id'])) {
            $query->where('doctor_workplace_id', $filters['workplace_id']);
        }

        // Convert inclusive local days to indexed half-open UTC bounds.
        if (isset($filters['from'])) {
            $query->where('starts_at', '>=', CarbonImmutable::parse($filters['from'], 'Asia/Tehran')->startOfDay()->utc());
        }
        if (isset($filters['to'])) {
            $query->where('starts_at', '<', CarbonImmutable::parse($filters['to'], 'Asia/Tehran')->startOfDay()->addDay()->utc());
        }

        if ($request->filled('checkup_id')) {
            $query->where('checkup_id', $request->integer('checkup_id'));
        }

        if ($request->filled('payment_status')) {
            $query->whereHas('payment', fn ($q) => $q->where('status', $request->query('payment_status')));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            if (ctype_digit($term)) {
                $query->where('reservations.id', $term);
            } elseif (Str::isUlid($term)) {
                $query->whereIn('reservations.public_id', array_unique([$term, strtolower($term), strtoupper($term)]));
            } else {
                $query->where(function ($q) use ($term): void {
                    $q->whereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%"))
                        ->orWhereHas('doctor.user', fn ($duq) => $duq->where('name', 'like', "%{$term}%"))
                        ->orWhereHas('doctor.specialty', fn ($sq) => $sq->where('name', 'like', "%{$term}%"))
                        ->orWhereHas('checkup', fn ($cq) => $cq->where('title', 'like', "%{$term}%"));
                });
            }
        }

        QuerySorting::apply($query, $request, [
            'id' => 'reservations.id',
            'starts_at' => 'reservations.starts_at',
            'ends_at' => 'reservations.ends_at',
            'status' => 'reservations.status',
            'created_at' => 'reservations.created_at',
            'checkup_title' => fn ($q, string $direction) => $q->orderBy(
                Checkup::withTrashed()
                    ->select('title')
                    ->whereColumn('checkups.id', 'reservations.checkup_id')
                    ->limit(1),
                $direction
            ),
            'patient_name' => fn ($q, string $direction) => $q->orderBy(
                User::query()
                    ->select('name')
                    ->whereColumn('users.id', 'reservations.user_id')
                    ->limit(1),
                $direction
            ),
            'doctor_name' => fn ($q, string $direction) => $q->orderBy(
                User::query()
                    ->select('users.name')
                    ->join('doctor_profiles', 'doctor_profiles.user_id', '=', 'users.id')
                    ->whereColumn('doctor_profiles.id', 'reservations.doctor_profile_id')
                    ->limit(1),
                $direction
            ),
            'payment_status' => fn ($q, string $direction) => $q->orderBy(
                Payment::query()
                    ->select('status')
                    ->whereColumn('reservation_payment_summaries.reservation_id', 'reservations.id')
                    ->limit(1),
                $direction
            ),
        ], 'starts_at', 'desc');
        // Related names/statuses and appointment times may tie across pages.
        $query->orderBy('reservations.id', 'asc');

        $reservations = $query->paginate(max(1, min($request->integer('per_page', 20), 100)))
            ->through(fn (Reservation $r) => $this->formatAdminReservation($r));

        return $this->successResponse(
            data: $reservations->items(),
            message: 'Admin reservations list.',
            meta: [
                'generated_at' => $clock->toIso8601String(),
                'pagination' => [
                    'current_page' => $reservations->currentPage(),
                    'last_page' => $reservations->lastPage(),
                    'per_page' => $reservations->perPage(),
                    'total' => $reservations->total(),
                ],
            ],
        );
    }

    /**
     * GET /api/admin/reservations/{reservation}
     */
    public function show(Request $request, Reservation $reservation)
    {
        return $this->detailResponse($request, $reservation, 'Admin reservation detail.');
    }

    private function detailResponse(Request $request, Reservation $reservation, string $message)
    {
        $reservation->loadMissing([
            'user:id,public_id,name',
            'doctor.user:id,public_id,name',
            'doctor.specialty:id,name',
            'checkup:id,public_id,title,price,currency,checkup_category_id',
            'payment',
        ]);

        return $this->successResponse(
            data: array_merge($this->formatAdminReservation($reservation), [
                'actions' => app(AdminReservationActionService::class)->metadata($request->user(), $reservation),
            ]),
            message: $message,
        )->header('Cache-Control', 'private, no-store');
    }

    public function rescheduleSlots(Request $request, Reservation $reservation, AdminReservationActionService $actions)
    {
        $this->onlyFields($request, ['from', 'to', 'page', 'per_page']);
        $data = $request->validate([
            'from' => ['bail', 'required', 'string', 'date_format:Y-m-d'],
            'to' => ['bail', 'required', 'string', 'date_format:Y-m-d'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        if ($data['to'] < $data['from']) {
            throw ValidationException::withMessages(['to' => ['date_range_reversed']]);
        }

        return $this->successResponse(
            data: $actions->slots($request->user(), $reservation, $data['from'], $data['to'], $data['page'] ?? 1, $data['per_page'] ?? 20),
            message: 'Available replacement slots.',
        )->header('Cache-Control', 'private, no-store');
    }

    private function onlyFields(Request $request, array $allowed): void
    {
        if (array_diff(array_keys($request->all()), $allowed)) {
            throw ValidationException::withMessages(['payload' => ['unsupported_fields']]);
        }
    }

    /**
     * PUT /api/admin/reservations/{reservation}/status
     * Reasoned root override of an existing permitted state, with fresh revision.
     */
    public function updateStatus(Request $request, Reservation $reservation, ReservationOverrideService $service)
    {
        Gate::forUser($request->user())->authorize('overrideStatus', $reservation);
        $this->onlyFields($request, ['status', 'reason', 'expected_revision']);
        $data = $request->validate([
            'status' => ['required', 'string'],
            'reason' => ['required', 'string', 'max:1000'],
            'expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
        ]);

        try {
            $newStatus = ReservationStatus::from($data['status']);
        } catch (\ValueError $e) {
            return $this->errorResponse(
                message: 'Invalid status value.',
                status: 422,
                errors: [
                    'status' => ['invalid_status'],
                ]
            );
        }

        try {
            $reservation = $service->changeStatus(
                $request,
                $request->user(),
                $reservation,
                $newStatus,
                $data['reason'],
                $data['expected_revision'],
            );
        } catch (\DomainException $exception) {
            if ($exception->getMessage() === ReservationRevision::CONFLICT) {
                return $this->errorResponse('Reservation changed; refresh before saving.', 409, ['expected_revision' => ['stale_revision']]);
            }

            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['status' => ['invalid_transition']],
            );
        }

        return $this->detailResponse($request, $reservation, 'Reservation status updated.');
    }

    public function reschedule(
        Request $request,
        Reservation $reservation,
        ReservationRescheduleService $service,
    ) {
        $this->onlyFields($request, ['slot_id', 'reason', 'expected_revision']);
        $data = $request->validate([
            'slot_id' => ['required', 'string', 'ulid'],
            'reason' => ['required', 'string', 'max:1000'],
            'expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
        ]);

        try {
            $reservation = $service->reschedule(
                $request,
                $request->user(),
                $reservation,
                $data['slot_id'],
                $data['reason'],
                $data['expected_revision'],
            );
        } catch (\DomainException $exception) {
            if ($exception->getMessage() === ReservationRevision::CONFLICT) {
                return $this->errorResponse('Reservation changed; refresh before saving.', 409, ['expected_revision' => ['stale_revision']]);
            }

            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['slot_id' => ['reschedule_rejected']],
            );
        }

        return $this->detailResponse($request, $reservation, 'Reservation rescheduled.');
    }
}
