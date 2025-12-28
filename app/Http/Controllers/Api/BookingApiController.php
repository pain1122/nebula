<?php

namespace App\Http\Controllers\Api;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Services\SchedulingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingApiController extends ApiController
{
    /**
     * GET /api/checkups
     * ?category_id=&q=&page=
     */
    public function checkups(Request $request)
    {
        $q = Checkup::with('category:id,name')
            ->orderBy('title');

        if ($request->filled('category_id')) {
            $q->where('checkup_category_id', $request->integer('category_id'));
        }

        if ($request->filled('q')) {
            $q->where('title', 'like', '%' . $request->q . '%');
        }

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
    public function doctorsForCheckup(Checkup $checkup)
    {
        // فرض: checkup جدولش ستون checkup_category_id داره
        $categoryId = $checkup->checkup_category_id;

        $doctors = DoctorProfile::query()
            ->where('specialty_id', $categoryId)   // 👈 همون شرطی که گفتی
            ->where('verified', true)              // فقط دکترهای تأیید‌شده
            ->with(['user:id,name', 'specialty:id,name'])
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
            message: 'Doctors for this checkup (by category/specialty, verified only).'
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

        $availability = $doctor->availability ?? [];

        $rawSlots = SchedulingService::buildSlots(
            $availability,
            $from,
            $to,
            $slotMinutes,
            bufferMinutes: 0
        );

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
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('starts_at');

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
        $data = $request->validate([
            'checkup_id' => ['required', 'exists:checkups,id'],
            'doctor_profile_id' => ['required', 'exists:doctor_profiles,id'],
            'starts_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'duration' => ['required', 'integer', 'min:10', 'max:180'],
        ]);

        $user = $request->user();
        $start = Carbon::parse($data['starts_at']);
        $end = (clone $start)->addMinutes($data['duration']);

        return DB::transaction(function () use ($data, $user, $start, $end) {
            // 1) چکاپ را بیاور
            $checkup = Checkup::findOrFail($data['checkup_id']);

            // 2) دکتر را پیدا کن و مطمئن شو verified است
            $doctor = DoctorProfile::where('id', $data['doctor_profile_id'])
                ->where('verified', true)
                ->first();

            if (!$doctor) {
                return $this->errorResponse(
                    message: 'Selected doctor is not available for booking.',
                    status: 422,
                    errors: [
                        'doctor_profile_id' => ['doctor_not_verified_or_not_found'],
                    ]
                );
            }

            // 3) چک کن تخصص دکتر با دسته‌بندی چکاپ یکیست
            if ((int) $doctor->specialty_id !== (int) $checkup->checkup_category_id) {
                return $this->errorResponse(
                    message: 'Selected doctor does not match this checkup category.',
                    status: 422,
                    errors: [
                        'doctor_profile_id' => ['doctor_specialty_mismatch'],
                    ]
                );
            }

            // 4) جلوگیری از تداخل زمانی
            if (SchedulingService::hasConflict($doctor->id, $start, $end)) {
                return $this->errorResponse(
                    message: 'این بازه زمانی قبلاً رزرو شده است.',
                    status: 422,
                    errors: [
                        'time' => ['time_conflict'],
                    ]
                );
            }

            // 5) ساخت رزرو
            $reservation = Reservation::create([
                'user_id' => $user->id,
                'doctor_profile_id' => $doctor->id,
                'checkup_id' => $checkup->id,
                'starts_at' => $start,
                'ends_at' => $end,
                'status' => ReservationStatus::Pending,
            ]);

            // 6) ساخت پرداخت
            $payment = Payment::create([
                'reservation_id' => $reservation->id,
                'amount' => $checkup->price ?? 0,
                'currency' => 'IRR',
                'status' => 'unpaid',
                'provider' => 'stripe',
            ]);

            return $this->successResponse(
                data: [
                    'reservation' => $reservation,
                    'payment' => $payment,
                ],
                message: 'رزرو با موفقیت ثبت شد.',
                status: 201
            );
        });
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
        if (in_array($statusValue, ['cancelled', 'canceled', 'completed', 'done'], true)) {
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
        ])
            ->forDoctor($doctorProfile->id) // از scope مدل Reservation استفاده می‌کنیم
            ->orderByDesc('starts_at');

        // اگر فقط آینده را خواستیم
        if ($request->boolean('upcoming')) {
            $query->upcoming();
        }

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
        if (in_array($statusValue, ['cancelled', 'done'], true)) {
            return $this->errorResponse(
                message: 'این رزرو قابل تغییر به وضعیت انجام‌شده نیست.',
                status: 422,
                errors: [
                    'status' => ['invalid_status_for_complete'],
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
        $reservation->status = ReservationStatus::Done;
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


}
