<?php

namespace App\Http\Controllers\Api;

use App\Models\Checkup;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Support\QuerySorting;
use Illuminate\Http\Request;

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
            'id'        => $r->id,
            'starts_at' => optional($r->starts_at)->toIso8601String(),
            'ends_at'   => optional($r->ends_at)->toIso8601String(),
            'status'    => $status,

            'patient' => $r->user ? [
                'id'    => $r->user->id,
                'name'  => $r->user->name,
                'email' => $r->user->email,
            ] : null,

            'doctor' => $r->doctor ? [
                'id'        => $r->doctor->id,
                'name'      => optional($r->doctor->user)->name,
                'specialty' => optional($r->doctor->specialty)->name ?? null,
            ] : null,

            'checkup' => $r->checkup ? [
                'id'          => $r->checkup->id,
                'title'       => $r->checkup->title,
                'price'       => $r->checkup->price,
                'category_id' => $r->checkup->checkup_category_id,
            ] : null,

            'payment' => $r->payment ? [
                'id'       => $r->payment->id,
                'amount'   => $r->payment->amount,
                'currency' => $r->payment->currency,
                'status'   => $r->payment->status,
                'provider' => $r->payment->provider,
            ] : null,
        ];
    }

    /**
     * GET /api/admin/reservations
     * فیلترهای اختیاری:
     *  - ?status=pending|done|cancelled|paid
     *  - ?doctor_id=doctor_profile_id
     *  - ?user_id=user_id
     *  - ?from=YYYY-MM-DD
     *  - ?to=YYYY-MM-DD
     */
    public function index(Request $request)
    {
        $query = Reservation::with([
                'user:id,name,email',
                'doctor.user:id,name',
                'doctor.specialty:id,name',
                'checkup:id,title,price,checkup_category_id',
                'payment',
            ])
            ->select('reservations.*');

        // فیلتر status
        if ($request->filled('status')) {
            $statusParam = $request->input('status');

            try {
                // سعی می‌کنیم status را به enum تبدیل کنیم (pending, done, cancelled, paid, ...)
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

        // فیلتر دکتر (doctor_profile_id)
        if ($request->filled('doctor_id')) {
            $query->where('doctor_profile_id', $request->integer('doctor_id'));
        }

        // فیلتر بیمار (user_id)
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        // فیلتر تاریخ شروع (from/to روی starts_at)
        if ($request->filled('from')) {
            $query->whereDate('starts_at', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('starts_at', '<=', $request->date('to'));
        }

        if ($request->filled('checkup_id')) {
            $query->where('checkup_id', $request->integer('checkup_id'));
        }

        if ($request->filled('payment_status')) {
            $query->whereHas('payment', fn ($q) => $q->where('status', $request->query('payment_status')));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->whereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                    ->orWhereHas('doctor.user', fn ($duq) => $duq->where('name', 'like', "%{$term}%"))
                    ->orWhereHas('doctor.specialty', fn ($sq) => $sq->where('name', 'like', "%{$term}%"))
                    ->orWhereHas('checkup', fn ($cq) => $cq->where('title', 'like', "%{$term}%"));
            });
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

        $reservations = $query->paginate(20)
            ->through(fn (Reservation $r) => $this->formatAdminReservation($r));

        return $this->successResponse(
            data: $reservations,
            message: 'Admin reservations list.'
        );
    }

    /**
     * GET /api/admin/reservations/{reservation}
     */
    public function show(Request $request, Reservation $reservation)
    {
        $reservation->loadMissing([
            'user:id,name,email',
            'doctor.user:id,name',
            'doctor.specialty:id,name',
            'checkup:id,title,price,checkup_category_id',
            'payment',
        ]);

        return $this->successResponse(
            data: $this->formatAdminReservation($reservation),
            message: 'Admin reservation detail.'
        );
    }

    /**
     * PUT /api/admin/reservations/{reservation}/status
     * body:
     * {
     *   "status": "pending" | "done" | "cancelled" | "paid"
     * }
     */
    public function updateStatus(Request $request, Reservation $reservation)
    {
        $data = $request->validate([
            'status' => ['required', 'string'],
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

        $reservation->loadMissing('payment');

        if ($newStatus === ReservationStatus::Confirmed && $reservation->payment?->status !== 'paid') {
            return $this->errorResponse(
                message: 'Reservation cannot be marked paid before payment is verified.',
                status: 422,
                errors: [
                    'payment' => ['payment_not_verified'],
                ]
            );
        }

        if ($newStatus === ReservationStatus::Completed) {
            if ($reservation->payment?->status !== 'paid') {
                return $this->errorResponse(
                    message: 'Reservation cannot be completed before payment is verified.',
                    status: 422,
                    errors: [
                        'payment' => ['payment_not_verified'],
                    ]
                );
            }

            if ($reservation->starts_at && $reservation->starts_at->isFuture()) {
                return $this->errorResponse(
                    message: 'Reservation cannot be completed before its appointment time.',
                    status: 422,
                    errors: [
                        'reservation' => ['too_early_to_complete'],
                    ]
                );
            }
        }

        $reservation->status = $newStatus;

        if ($newStatus === ReservationStatus::Completed) {
            $reservation->completed_at = now();
        }

        if ($newStatus === ReservationStatus::Cancelled) {
            $reservation->cancelled_at = now();
            $reservation->cancelled_by = $request->user()->id;
        }

        $reservation->save();

        $reservation->loadMissing([
            'user:id,name,email',
            'doctor.user:id,name',
            'doctor.specialty:id,name',
            'checkup:id,title,price,checkup_category_id',
            'payment',
        ]);

        return $this->successResponse(
            data: $this->formatAdminReservation($reservation),
            message: 'Reservation status updated.'
        );
    }
}
