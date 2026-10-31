<?php

namespace App\Http\Controllers\Front;

use App\Http\Controllers\Controller;
use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\Reservation;
use App\Services\BookingService;
use App\Services\SchedulingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function __construct(private BookingService $bookingService) {}

    public function chooseCheckup()
    {
        $checkups = Checkup::with('category')->orderBy('title')->paginate(12);

        return view('front.booking.choose-checkup', compact('checkups'));
    }

    public function chooseDoctor(Checkup $checkup)
    {
        $doctors = $checkup->doctors()
            ->where('doctor_profiles.verified', true)
            ->with([
                'user',
                'specialty',
                'workplaces' => fn ($query) => $query
                    ->where('is_active', true)
                    ->whereHas('hospital', fn ($hospital) => $hospital
                        ->where('is_active', true)
                        ->whereNull('archived_at'))
                    ->whereHas('checkups', fn ($services) => $services
                        ->where('checkups.id', $checkup->id)
                        ->where('doctor_workplace_checkup.is_active', true)),
                'workplaces.hospital',
            ])
            ->get();

        return view('front.booking.choose-doctor', compact('checkup', 'doctors'));
    }

    public function pickTime(Request $request, Checkup $checkup, DoctorProfile $doctor)
    {
        $data = $request->validate([
            'workplace_id' => ['required', 'integer', 'exists:doctor_workplaces,id'],
        ]);

        try {
            $workplace = $this->bookingService->resolveBookableWorkplace(
                $checkup,
                $doctor,
                $data['workplace_id'],
            );
        } catch (ValidationException) {
            abort(404);
        }

        $from = Carbon::now();
        $to = Carbon::now()->addDays(7);

        $rawSlots = SchedulingService::buildWorkplaceSlots($workplace, $checkup, $from, $to);
        $slots = SchedulingService::availableSlots($doctor->id, $rawSlots);

        return view('front.booking.pick-time', compact('checkup', 'doctor', 'workplace', 'slots'));
    }

    public function store(Request $request, Checkup $checkup, DoctorProfile $doctor)
    {
        $data = $request->validate([
            'slot_id' => ['required', 'string', 'size:26'],
            'starts_at' => ['prohibited'],
            'doctor_workplace_id' => ['prohibited'],
            'ends_at' => ['prohibited'],
            'duration' => ['prohibited'],
            'price' => ['prohibited'],
            'currency' => ['prohibited'],
        ]);

        $this->bookingService->createReservation(
            user: $request->user(),
            slotPublicId: $data['slot_id'],
        );

        return redirect()->route('book.my')->with('status', 'رزرو ثبت شد.');
    }

    public function myReservations(Request $request)
    {
        $items = Reservation::with('doctor.user', 'checkup')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('starts_at')->paginate(10);

        return view('front.booking.my', compact('items'));
    }
}
