<?php

namespace App\Http\Controllers\Front;

use App\Http\Controllers\Controller;
use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\Payment;
use App\Models\Reservation;
use App\Services\SchedulingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    public function chooseCheckup()
    {
        $checkups = Checkup::with('category')->orderBy('title')->paginate(12);
        return view('front.booking.choose-checkup', compact('checkups'));
    }

    public function chooseDoctor(Checkup $checkup)
    {
        $doctors = DoctorProfile::query()
            ->where('specialty_id', $checkup->checkup_category_id)
            ->where('verified', true)
            ->with(['user', 'specialty'])
            ->get();

        return view('front.booking.choose-doctor', compact('checkup', 'doctors'));
    }


    public function pickTime(Checkup $checkup, DoctorProfile $doctor)
    {
        // همون لاجیک API: دکتر باید verified باشه و تخصصش با دسته بندی چکاپ بخوره
        if (!$doctor->verified || (int) $doctor->specialty_id !== (int) $checkup->checkup_category_id) {
            abort(404); // یا می‌تونی redirect کنی با فلش مسیج
        }

        $from = Carbon::now();
        $to = Carbon::now()->addDays(7);

        $availability = $doctor->availability ?? [];
        $rawSlots = SchedulingService::buildSlots($availability, $from, $to, slotMinutes: 30, bufferMinutes: 0);
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
        $end = (clone $start)->addMinutes($data['duration']);

        return DB::transaction(function () use ($request, $checkup, $doctor, $start, $end) {

            // 1) دکتر باید قابل استفاده برای این چکاپ باشد
            if (!$doctor->verified || (int) $doctor->specialty_id !== (int) $checkup->checkup_category_id) {
                return back()
                    ->withErrors(['doctor' => 'پزشک انتخاب شده برای این چکاپ مجاز نیست.'])
                    ->withInput();
            }

            // 2) جلوگیری از تداخل زمانی (همون لاجیک API)
            if (SchedulingService::hasConflict($doctor->id, $start, $end)) {
                return back()
                    ->withErrors(['starts_at' => 'این بازه زمانی قبلاً رزرو شده است.'])
                    ->withInput();
            }

            // 3) ساخت رزرو
            $res = Reservation::create([
                'user_id' => $request->user()->id,
                'doctor_profile_id' => $doctor->id,
                'checkup_id' => $checkup->id,
                'starts_at' => $start,
                'ends_at' => $end,
                'status' => 'pending', // همون چیزی که قبلاً داشتی
            ]);

            // 4) ساخت پرداخت
            Payment::create([
                'reservation_id' => $res->id,
                'amount' => $checkup->price,
                'currency' => 'IRR',
                'status' => 'unpaid',
                'provider' => 'stripe',
            ]);

            return redirect()->route('book.my')->with('status', 'رزرو ثبت شد.');
        });
    }



    public function myReservations(Request $request)
    {
        $items = Reservation::with('doctor.user', 'checkup')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('starts_at')->paginate(10);

        return view('front.booking.my', compact('items'));
    }
}
