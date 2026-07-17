<?php

namespace App\Http\Controllers\Front;

use App\Http\Controllers\Controller;
use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Services\BookingService;
use App\Services\SchedulingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function __construct(private BookingService $bookingService)
    {
    }

    public function chooseCheckup()
    {
        $checkups = Checkup::with('category')->orderBy('title')->paginate(12);
        return view('front.booking.choose-checkup', compact('checkups'));
    }

    public function chooseDoctor(Checkup $checkup)
    {
        $doctors = $checkup->doctors()
            ->where('doctor_profiles.verified', true)
            ->with(['user', 'specialty'])
            ->get();

        return view('front.booking.choose-doctor', compact('checkup', 'doctors'));
    }


    public function pickTime(Checkup $checkup, DoctorProfile $doctor)
    {
        try {
            $this->bookingService->assertDoctorCanPerformCheckup($checkup, $doctor);
        } catch (ValidationException) {
            abort(404);
        }

        $from = Carbon::now();
        $to = Carbon::now()->addDays(7);

        $workplace = $this->bookingService->resolveBookableWorkplace($checkup, $doctor);
        $rawSlots = SchedulingService::buildWorkplaceSlots($workplace, $from, $to, 30);
        $slots = SchedulingService::availableSlots($doctor->id, $rawSlots);

        return view('front.booking.pick-time', compact('checkup', 'doctor', 'slots'));
    }


    public function store(Request $request, Checkup $checkup, DoctorProfile $doctor)
    {
        $data = $request->validate([
            'starts_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'duration' => ['required', 'integer', 'min:10', 'max:180'],
        ]);

        $start = Carbon::parse($data['starts_at']);

        $this->bookingService->createReservation(
            user: $request->user(),
            checkup: $checkup,
            doctor: $doctor,
            start: $start,
            durationMinutes: (int) $data['duration']
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
