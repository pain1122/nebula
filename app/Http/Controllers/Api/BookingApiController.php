<?php

namespace App\Http\Controllers\Api;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use App\Services\BookingService;
use App\Services\SchedulingService;
use App\Support\QuerySorting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookingApiController extends ApiController
{
    public function __construct(private BookingService $bookingService)
    {
    }

    /**
     * GET /api/checkups
     * ?category_id=&q=&page=
     */
    public function checkups(Request $request)
    {
        $q = Checkup::with('category:id,name')
            ->select('checkups.*');

        if ($request->filled('category_id')) {
            $q->where('checkup_category_id', $request->integer('category_id'));
        }

        if ($request->filled('q')) {
            $q->where('title', 'like', '%' . $request->q . '%');
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
        $query = $checkup->doctors()
            ->where('doctor_profiles.verified', true)
            ->with(['user:id,name', 'specialty:id,name'])
            ->distinct();

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->where('doctor_profiles.bio', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%"))
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
            ->map(function (DoctorProfile $d) {
                return [
                    'doctor_profile_id' => $d->id,
                    'doctor_name' => $d->user?->name,
                    'specialty' => $d->specialty?->name,
                    'fee' => $d->fee,
                    'verified' => (bool) $d->verified,
                ];
            });

        return $this->successResponse(
            data: $doctors,
            message: 'Doctors for this checkup.'
        );
    }

    /**
     * GET /api/doctors/{doctor}/availability
     * ?from=2025-11-17&to=2025-11-24&slot=30
     * فقط اگر دکتر verified باشد
     */
    public function availability(Request $request, DoctorProfile $doctor)
    {
        if (!$doctor->verified) {
            return $this->errorResponse(
                message: 'This doctor is not available for booking.',
                status: 403
            );
        }

        $from = $request->date('from')
            ? Carbon::parse($request->date('from'))
            : Carbon::now();

        $to = $request->date('to')
            ? Carbon::parse($request->date('to'))
            : Carbon::now()->addDays(7);

        $slotMinutes = (int) $request->input('slot', 30);
        $workplaceQuery = $doctor->workplaces()
            ->where('is_active', true)
            ->whereHas('hospital', fn ($hospital) => $hospital->where('is_active', true)->whereNull('archived_at'));

        if ($request->filled('workplace_id')) {
            $workplaceQuery->whereKey($request->integer('workplace_id'));
        }

        $workplaces = $workplaceQuery->limit(2)->get();

        if ($workplaces->isEmpty()) {
            return $this->errorResponse('No active workplace was found for this doctor.', 404);
        }

        if (! $request->filled('workplace_id') && $workplaces->count() > 1) {
            return $this->errorResponse(
                message: 'A workplace must be selected for this doctor.',
                status: 422,
                errors: ['workplace_id' => ['workplace_required']]
            );
        }

        $workplace = $workplaces->first();
        $rawSlots = SchedulingService::buildWorkplaceSlots($workplace, $from, $to, $slotMinutes);

        $freeSlots = SchedulingService::availableSlots($doctor->id, $rawSlots);

        $payload = array_map(function ($pair) {
            return [
                'start' => $pair[0]->format('Y-m-d\TH:i'),
                'end' => $pair[1]->format('Y-m-d\TH:i'),
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
     *   "checkup_id": 1,
     *   "doctor_profile_id": 3,
     *   "starts_at": "2025-11-17T10:00",
     *   "duration": 30
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
            'checkup_id' => [
                'required',
                Rule::exists('checkups', 'id')->whereNull('deleted_at'),
            ],
            'doctor_profile_id' => ['required', 'exists:doctor_profiles,id'],
            'doctor_workplace_id' => ['nullable', 'exists:doctor_workplaces,id'],
            'starts_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'duration' => ['required', 'integer', 'min:10', 'max:180'],
        ]);

        $user = $request->user();
        $start = Carbon::parse($data['starts_at']);
        $checkup = Checkup::query()->findOrFail($data['checkup_id']);
        $doctor = DoctorProfile::query()->findOrFail($data['doctor_profile_id']);
        $workplace = isset($data['doctor_workplace_id'])
            ? DoctorWorkplace::query()->findOrFail($data['doctor_workplace_id'])
            : null;

        [$reservation, $payment] = $this->bookingService->createReservation(
            user: $user,
            checkup: $checkup,
            doctor: $doctor,
            start: $start,
            durationMinutes: (int) $data['duration'],
            workplace: $workplace,
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
    public function cancelReservation(Request $request, Reservation $reservation)
    {
        $user = $request->user();

        // 1) فقط رزروهای خود کاربر
        if ($reservation->user_id !== $user->id) {
            // عمداً 404 می‌دهیم که کسی نتونه حدس بزنه این id متعلق به دیگری است
            return $this->errorResponse('Reservation not found.', 404);
        }

        // 2) اگر زمان رزرو گذشته باشد، اجازه‌ی لغو نده
        if ($reservation->starts_at && $reservation->starts_at->isPast()) {
            return $this->errorResponse(
                message: 'امکان لغو این رزرو وجود ندارد (زمان آن گذشته است).',
                status: 422,
                errors: [
                    'reservation' => ['too_late_to_cancel'],
                ]
            );
        }

        // 3) نرمال‌سازی status برای بررسی
        $status = $reservation->status;
        $statusValue = $status;

        if (is_object($status)) {
            if (property_exists($status, 'value')) {
                $statusValue = $status->value;
            } elseif (property_exists($status, 'name')) {
                $statusValue = $status->name;
            }
        }

        // 4) اگر قبلاً کنسل/تمام شده باشد، اجازه نده
        if (in_array($statusValue, ['cancelled', 'completed', 'expired'], true)) {
            return $this->errorResponse(
                message: 'این رزرو قابل لغو نیست.',
                status: 422,
                errors: [
                    'reservation' => ['invalid_status_for_cancel'],
                ]
            );
        }

        // 5) تغییر status به Cancelled
        // اگر از enum ReservationStatus استفاده می‌کنی:
        $reservation->status = ReservationStatus::Cancelled;
        $reservation->cancelled_at = now();
        $reservation->cancelled_by = $user->id;

        $reservation->save();

        return $this->successResponse(
            data: [
                'id' => $reservation->id,
                'status' => is_object($reservation->status) && property_exists($reservation->status, 'value')
                    ? $reservation->status->value
                    : (string) $reservation->status,
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
        if (!$doctorProfile) {
            return $this->errorResponse(
                message: 'Doctor profile not found.',
                status: 404
            );
        }

        $query = Reservation::with([
            'user:id,name,email', // بیمار
            'checkup:id,title,price,checkup_category_id',
            'payment',
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
            ->through(fn(Reservation $r) => $this->formatDoctorReservation($r));


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

        if (!$doctorProfile || $reservation->doctor_profile_id !== $doctorProfile->id) {
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

    /**
     * POST /api/doctor/reservations/{reservation}/complete
     */
    public function doctorCompleteReservation(Request $request, Reservation $reservation)
    {
        $user = $request->user();
        $doctorProfile = $user->doctorProfile ?? null;

        // مطمئن شو این رزرو برای همین دکتر است
        if (!$doctorProfile || $reservation->doctor_profile_id !== $doctorProfile->id) {
            return $this->errorResponse('Reservation not found.', 404);
        }

        // نرمال‌سازی status
        $status = $reservation->status;
        $statusValue = $status instanceof ReservationStatus
            ? $status->value
            : (string) $status;

        // اگر قبلاً کنسل یا Done شده، اجازه نده
        if (in_array($statusValue, ['cancelled', 'completed', 'expired'], true)) {
            return $this->errorResponse(
                message: 'این رزرو قابل تغییر به وضعیت انجام‌شده نیست.',
                status: 422,
                errors: [
                    'status' => ['invalid_status_for_complete'],
                ]
            );
        }

        $reservation->loadMissing('payment');

        if ($reservation->payment?->status !== 'paid') {
            return $this->errorResponse(
                message: 'پرداخت این رزرو هنوز تایید نشده است.',
                status: 422,
                errors: [
                    'payment' => ['payment_not_verified'],
                ]
            );
        }

        // اگر هنوز موعد رزرو نرسیده، دکتر نمی‌تواند آن را Done کند (اختیاری ولی منطقی)
        if ($reservation->starts_at && $reservation->starts_at->isFuture()) {
            return $this->errorResponse(
                message: 'هنوز زمان این رزرو نرسیده است.',
                status: 422,
                errors: [
                    'reservation' => ['too_early_to_complete'],
                ]
            );
        }

        // تغییر وضعیت به Done
        $reservation->status = ReservationStatus::Completed;
        $reservation->completed_at = now();
        $reservation->save();

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
