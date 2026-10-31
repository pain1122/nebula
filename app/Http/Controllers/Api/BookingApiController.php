<?php

namespace App\Http\Controllers\Api;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use App\Services\BookingService;
use App\Services\LocalSandboxPaymentService;
use App\Services\ReservationLifecycleService;
use App\Services\ReservationRescheduleService;
use App\Services\SchedulingService;
use App\Support\QuerySorting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookingApiController extends ApiController
{
    public function __construct(private BookingService $bookingService) {}

    /**
     * GET /api/checkups
     * ?category_id=&q=&page=
     */
    public function checkups(Request $request)
    {
        $q = Checkup::with('category:id,name')->where('is_active', true)->whereHas('category', fn ($category) => $category->where('is_active', true))
            ->select('checkups.*');

        if ($request->filled('category_id')) {
            $q->where('checkup_category_id', $request->integer('category_id'));
        }

        if ($request->filled('q')) {
            $q->where('title', 'like', '%'.$request->q.'%');
        }

        if ($request->filled('min_price')) {
            $q->where('price', '>=', $request->integer('min_price'));
        }

        if ($request->filled('max_price')) {
            $q->where('price', '<=', $request->integer('max_price'));
        }

        QuerySorting::apply($q, $request, [
            'title' => 'checkups.title',
            'price' => 'checkups.price',
            'category_id' => 'checkups.checkup_category_id',
            'created_at' => 'checkups.created_at',
        ], 'title');

        $paginated = $q->paginate(20);

        return $this->successResponse(
            data: $paginated,
            message: 'Checkups list.'
        );
    }

    /**
     * GET /api/checkups/{checkup}/doctors
     * فقط دکترهای verified
     */
    public function doctorsForCheckup(Request $request, Checkup $checkup)
    {
        abort_unless($checkup->is_active && $checkup->category?->is_active, 404);
        $bookableWorkplaces = fn ($query) => $query
            ->where('is_active', true)
            ->whereHas('hospital', fn ($hospital) => $hospital
                ->where('is_active', true)->whereNull('archived_at'))
            ->whereHas('checkups', fn ($services) => $services
                ->where('checkups.id', $checkup->id)
                ->where('doctor_workplace_checkup.is_active', true));

        $query = $checkup->doctors()
            ->where('doctor_profiles.verified', true)
            ->whereHas('user', fn ($user) => $user->where('account_state', 'active')->whereHas('roles', fn ($roles) => $roles->where('name', 'doctor')))
            ->whereHas('workplaces', $bookableWorkplaces)
            ->with([
                'user:id,name', 'specialty:id,name',
                'workplaces' => $bookableWorkplaces,
                'workplaces.hospital:id,name,timezone',
                'workplaces.checkups' => fn ($services) => $services->where('checkups.id', $checkup->id),
            ])
            ->distinct();

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->whereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%"))
                    ->orWhereHas('specialty', fn ($sq) => $sq->where('name', 'like', "%{$term}%"));
            });
        }

        if ($request->filled('specialty_id')) {
            $query->where('doctor_profiles.specialty_id', $request->integer('specialty_id'));
        }

        if ($request->filled('min_fee')) {
            $query->where('doctor_profiles.fee', '>=', $request->integer('min_fee'));
        }

        if ($request->filled('max_fee')) {
            $query->where('doctor_profiles.fee', '<=', $request->integer('max_fee'));
        }

        if ($request->filled('min_experience')) {
            $query->where('doctor_profiles.experience_years', '>=', $request->integer('min_experience'));
        }

        QuerySorting::apply($query, $request, [
            'name' => fn ($q, string $direction) => $q->orderBy(
                User::query()
                    ->select('name')
                    ->whereColumn('users.id', 'doctor_profiles.user_id')
                    ->limit(1),
                $direction
            ),
            'specialty' => fn ($q, string $direction) => $q->orderBy(
                Specialty::query()
                    ->select('name')
                    ->whereColumn('specialties.id', 'doctor_profiles.specialty_id')
                    ->limit(1),
                $direction
            ),
            'fee' => 'doctor_profiles.fee',
            'experience_years' => 'doctor_profiles.experience_years',
            'created_at' => 'doctor_profiles.created_at',
        ], 'name');

        $doctors = $query
            ->get()
            ->map(function (DoctorProfile $d) use ($checkup) {
                return [
                    'doctor_profile_id' => $d->id,
                    'doctor_name' => $d->user?->name,
                    'specialty' => $d->specialty?->name,
                    'experience_years' => (int) $d->experience_years,
                    'rating' => null,
                    'rating_count' => 0,
                    'photo_url' => null,
                    'price_ranges' => $d->workplaces->groupBy(fn ($workplace) => $workplace->checkups->first()?->pivot?->currency_override ?: $checkup->currency)
                        ->map(function ($workplaces, $currency) use ($d) {
                            $prices = $workplaces->map(fn ($workplace) => (int) ($workplace->checkups->first()?->pivot?->price_override ?? $d->fee));

                            return ['currency' => $currency, 'min' => $prices->min(), 'max' => $prices->max()];
                        })->values(),
                    'fee' => $d->fee,
                    'verified' => (bool) $d->verified,
                    'workplaces' => $d->workplaces->map(fn ($workplace): array => [
                        'id' => $workplace->id,
                        'name' => $workplace->display_name ?: $workplace->hospital?->name,
                        'timezone' => $workplace->hospital?->timezone,
                    ])->values(),
                ];
            });

        return $this->successResponse(
            data: $doctors,
            message: 'Doctors for this checkup.'
        );
    }

    /**
     * GET /api/doctors/{doctor}/availability
     * ?checkup_id=1&workplace_id=2&from=2025-11-17&to=2025-11-24
     * فقط اگر دکتر verified باشد
     */
    public function availability(Request $request, DoctorProfile $doctor)
    {
        $data = $request->validate([
            'checkup_id' => ['required', Rule::exists('checkups', 'id')->whereNull('deleted_at')],
            'workplace_id' => ['nullable', 'integer', 'exists:doctor_workplaces,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'slot' => ['prohibited'],
            'duration' => ['prohibited'],
        ]);

        if (! $doctor->verified) {
            return $this->errorResponse(
                message: 'This doctor is not available for booking.',
                status: 403
            );
        }

        $from = isset($data['from'])
            ? Carbon::parse($data['from'])->startOfDay()
            : Carbon::now();

        $to = isset($data['to'])
            ? Carbon::parse($data['to'])->endOfDay()
            : Carbon::now()->addDays(7);
        $checkup = Checkup::query()->findOrFail($data['checkup_id']);
        $workplace = $this->bookingService->resolveBookableWorkplace(
            $checkup,
            $doctor,
            $data['workplace_id'] ?? null,
        );
        $rawSlots = SchedulingService::buildWorkplaceSlots($workplace, $checkup, $from, $to);

        $freeSlots = SchedulingService::availableSlots($doctor->id, $rawSlots);

        $payload = array_map(function (array $slot): array {
            return [
                'slot_id' => $slot['slot_public_id'],
                'start' => $slot['start']->toIso8601String(),
                'end' => $slot['end']->toIso8601String(),
                'duration_minutes' => (int) $slot['start']->diffInMinutes($slot['end']),
                'price' => $slot['price'],
                'currency' => $slot['currency'],
            ];
        }, $freeSlots);

        return $this->successResponse(
            data: $payload,
            message: 'Doctor availability.'
        );
    }

    /**
     * GET /api/my/reservations
     */
    public function myReservations(Request $request)
    {
        $user = $request->user();

        $query = Reservation::with([
            'doctor.user:id,name',
            'doctor.specialty:id,name',
            'checkup:id,title,price,checkup_category_id',
            'payment',
        ])
            ->where('user_id', $user->id)
            ->select('reservations.*');

        // فیلتر status (pending | done | cancelled | paid)
        if ($request->filled('status')) {
            $statusParam = $request->input('status');

            try {
                // سعی می‌کنیم status را به enum تبدیل کنیم
                $statusEnum = ReservationStatus::from($statusParam);
                $query->where('status', $statusEnum);
            } catch (\ValueError $e) {
                return $this->errorResponse(
                    message: 'Invalid status value.',
                    status: 422,
                    errors: [
                        'status' => ['invalid_status'],
                    ]
                );
            }
        }

        // فقط رزروهای آینده؟ (?upcoming=1)
        if ($request->boolean('upcoming')) {
            $query->where('starts_at', '>', now());
        }

        // فیلتر تاریخ شروع (اختیاری)
        if ($request->filled('from')) {
            $query->whereDate('starts_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('starts_at', '<=', $request->date('to'));
        }

        if ($request->filled('payment_status')) {
            $query->whereHas('payment', fn ($q) => $q->where('status', $request->query('payment_status')));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->whereHas('checkup', fn ($cq) => $cq->where('title', 'like', "%{$term}%"))
                    ->orWhereHas('doctor.user', fn ($uq) => $uq->where('name', 'like', "%{$term}%"))
                    ->orWhereHas('doctor.specialty', fn ($sq) => $sq->where('name', 'like', "%{$term}%"));
            });
        }

        QuerySorting::apply($query, $request, $this->reservationSorts(), 'starts_at', 'desc');

        $reservations = $query->paginate(20)
            ->through(function (Reservation $r) {
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
                    'public_id' => $r->public_id,
                    'booked_amount' => $r->price_snapshot,
                    'booked_currency' => $r->currency_snapshot,
                    'hold_expires_at' => $r->hold_expires_at?->toIso8601String(),
                    'can_sandbox_checkout' => LocalSandboxPaymentService::available($r),
                    'starts_at' => optional($r->starts_at)->toIso8601String(),
                    'ends_at' => optional($r->ends_at)->toIso8601String(),
                    'status' => $status,

                    'doctor' => $r->doctor ? [
                        'id' => $r->doctor->id,
                        'name' => optional($r->doctor->user)->name,
                        'specialty' => optional($r->doctor->specialty)->name,
                        'fee' => $r->doctor->fee,
                    ] : null,

                    'checkup' => $r->checkup ? [
                        'id' => $r->checkup->id,
                        'title' => $r->checkup->title,
                        'price' => $r->checkup->price,
                        'category_id' => $r->checkup->checkup_category_id,
                    ] : null,

                    'payment' => $r->payment ? [
                        'id' => $r->payment->id,
                        'amount' => $r->payment->amount,
                        'currency' => $r->payment->currency,
                        'status' => $r->payment->status,
                        'provider' => $r->payment->provider,
                    ] : null,
                ];
            });

        return $this->successResponse(
            data: $reservations,
            message: 'My reservations.'
        );
    }

    /**
     * POST /api/reservations
     * body:
     * {
     *   "slot_id": "01J..."
     * }
     */
    public function storeReservation(Request $request)
    {
        $idempotencyKey = $request->header('Idempotency-Key');

        if ($idempotencyKey !== null && mb_strlen($idempotencyKey) > 100) {
            return $this->errorResponse(
                message: 'The idempotency key is too long.',
                status: 422,
                errors: ['idempotency_key' => ['max_100_characters']]
            );
        }

        $data = $request->validate([
            'slot_id' => ['required', 'string', 'size:26'],
            'checkup_id' => ['prohibited'],
            'doctor_profile_id' => ['prohibited'],
            'doctor_workplace_id' => ['prohibited'],
            'starts_at' => ['prohibited'],
            'ends_at' => ['prohibited'],
            'duration' => ['prohibited'],
            'price' => ['prohibited'],
            'currency' => ['prohibited'],
        ]);

        $user = $request->user();
        [$reservation, $payment] = $this->bookingService->createReservation(
            user: $user,
            slotPublicId: $data['slot_id'],
            idempotencyKey: $idempotencyKey
        );

        return $this->successResponse(
            data: [
                'reservation' => $reservation,
                'payment' => $payment,
            ],
            message: 'رزرو با موفقیت ثبت شد.',
            status: 201
        );
    }

    /**
     * POST /api/reservations/{reservation}/cancel
     */
    public function cancelReservation(
        Request $request,
        Reservation $reservation,
        ReservationLifecycleService $service,
    ) {
        $user = $request->user();

        if ($reservation->user_id !== $user->id) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
            'payment_status' => ['prohibited'],
            'refund' => ['prohibited'],
            'void' => ['prohibited'],
            'amount' => ['prohibited'],
            'currency' => ['prohibited'],
        ]);

        try {
            $reservation = $service->cancel($request, $user, $reservation, $data['reason']);
        } catch (\DomainException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['reservation' => ['cancellation_rejected']],
            );
        }

        return $this->successResponse(
            data: [
                'id' => $reservation->id,
                'status' => $reservation->status->value,
                'starts_at' => optional($reservation->starts_at)->toIso8601String(),
                'ends_at' => optional($reservation->ends_at)->toIso8601String(),
            ],
            message: 'رزرو با موفقیت لغو شد.'
        );
    }

    /**
     * GET /api/doctor/reservations
     */
    private function formatDoctorReservation(Reservation $r): array
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
            'can_complete' => app(ReservationLifecycleService::class)->canComplete($r),
            'public_id' => $r->public_id,
            'booked_amount' => $r->price_snapshot,
            'booked_currency' => $r->currency_snapshot,
            'hold_expires_at' => $r->hold_expires_at?->toIso8601String(),
            'starts_at' => optional($r->starts_at)->toIso8601String(),
            'ends_at' => optional($r->ends_at)->toIso8601String(),
            'status' => $status,

            'patient' => $r->user ? [
                'id' => $r->user->id,
                'name' => $r->user->name,
                'email' => $r->user->email,
            ] : null,

            'checkup' => $r->checkup ? [
                'id' => $r->checkup->id,
                'title' => $r->checkup->title,
                'price' => $r->checkup->price,
                'category_id' => $r->checkup->checkup_category_id,
            ] : null,

            'payment' => $r->payment ? [
                'id' => $r->payment->id,
                'amount' => $r->payment->amount,
                'currency' => $r->payment->currency,
                'status' => $r->payment->status,
                'provider' => $r->payment->provider,
            ] : null,
        ];
    }

    public function doctorReservations(Request $request)
    {
        $user = $request->user();

        // دکتر باید پروفایل داشته باشد
        $doctorProfile = $user->doctorProfile ?? null;
        if (! $doctorProfile) {
            return $this->errorResponse(
                message: 'Doctor profile not found.',
                status: 404
            );
        }

        $query = Reservation::with([
            'user:id,name,email', // بیمار
            'checkup:id,title,price,checkup_category_id',
            'payment.successfulAttempt',
        ])
            ->forDoctor($doctorProfile->id) // از scope مدل Reservation استفاده می‌کنیم
            ->select('reservations.*');

        // اگر فقط آینده را خواستیم
        if ($request->boolean('upcoming')) {
            $query->upcoming();
        }

        if ($request->filled('status')) {
            $statusParam = $request->input('status');

            try {
                $statusEnum = ReservationStatus::from($statusParam);
                $query->where('status', $statusEnum);
            } catch (\ValueError $e) {
                return $this->errorResponse(
                    message: 'Invalid status value.',
                    status: 422,
                    errors: [
                        'status' => ['invalid_status'],
                    ]
                );
            }
        }

        if ($request->filled('from')) {
            $query->whereDate('starts_at', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('starts_at', '<=', $request->date('to'));
        }

        if ($request->filled('payment_status')) {
            $query->whereHas('payment', fn ($q) => $q->where('status', $request->query('payment_status')));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->whereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                    ->orWhereHas('checkup', fn ($cq) => $cq->where('title', 'like', "%{$term}%"));
            });
        }

        QuerySorting::apply($query, $request, $this->reservationSorts(), 'starts_at', 'desc');

        $reservations = $query->paginate(20)
            ->through(fn (Reservation $r) => $this->formatDoctorReservation($r));

        return $this->successResponse(
            data: $reservations,
            message: 'Doctor reservations.'
        );
    }

    /**
     * GET /api/doctor/reservations/{reservation}
     */
    public function doctorReservationShow(Request $request, Reservation $reservation)
    {
        $user = $request->user();
        $doctorProfile = $user->doctorProfile ?? null;

        if (! $doctorProfile || $reservation->doctor_profile_id !== $doctorProfile->id) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        $reservation->loadMissing([
            'user:id,name,email',
            'checkup:id,title,price,checkup_category_id',
        ]);

        return $this->successResponse(
            data: $this->formatDoctorReservation($reservation),
            message: 'Doctor reservation detail.'
        );
    }

    public function doctorRescheduleReservation(
        Request $request,
        Reservation $reservation,
        ReservationRescheduleService $service,
    ) {
        $data = $request->validate([
            'slot_id' => ['required', 'string', 'size:26'],
            'reason' => ['required', 'string', 'max:1000'],
            'starts_at' => ['prohibited'],
            'ends_at' => ['prohibited'],
            'duration' => ['prohibited'],
            'price' => ['prohibited'],
            'currency' => ['prohibited'],
        ]);

        try {
            $reservation = $service->reschedule(
                $request,
                $request->user(),
                $reservation,
                $data['slot_id'],
                $data['reason'],
            );
        } catch (\DomainException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['slot_id' => ['reschedule_rejected']],
            );
        }

        return $this->successResponse(
            data: $reservation,
            message: 'Reservation rescheduled.',
        );
    }

    /**
     * POST /api/doctor/reservations/{reservation}/complete
     */
    public function doctorCompleteReservation(
        Request $request,
        Reservation $reservation,
        ReservationLifecycleService $service,
    ) {
        $user = $request->user();
        $doctorProfile = $user->doctorProfile ?? null;

        if (! $doctorProfile || $reservation->doctor_profile_id !== $doctorProfile->id) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        try {
            $reservation = $service->complete($request, $user, $reservation);
        } catch (\DomainException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                status: 422,
                errors: ['reservation' => ['completion_rejected']],
            );
        }

        $reservation->loadMissing([
            'user:id,name,email',
            'checkup:id,title,price,checkup_category_id',
        ]);

        return $this->successResponse(
            data: $this->formatDoctorReservation($reservation),
            message: 'رزرو به عنوان انجام‌شده ثبت شد.'
        );
    }

    /**
     * @return array<string, string|callable>
     */
    private function reservationSorts(): array
    {
        return [
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
        ];
    }
}
