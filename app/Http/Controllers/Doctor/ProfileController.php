<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Doctor\UpdateProfileRequest;
use App\Models\DoctorProfile;
use App\Models\Specialty;

class ProfileController extends Controller
{
    public function edit()
    {
        $user = auth()->user();
        $profile = $user->doctorProfile ?: new DoctorProfile(['user_id' => $user->id]);
        $specialties = Specialty::with('children')->roots()->orderBy('name')->get();

        return view('doctor.profile.edit', compact('profile','specialties'));
    }

    public function update(UpdateProfileRequest $request)
    {
        $user = auth()->user();
        $data = $request->validated();

        $profile = $user->doctorProfile ?: new DoctorProfile(['user_id' => $user->id]);
        $profile->fill([
            'phone'            => $data['phone'] ?? null,
            'specialty_id'     => $data['specialty_id'] ?? null,
            'experience_years' => $data['experience_years'] ?? 0,
            'fee'              => $data['fee'] ?? 0,
            'bio'              => $data['bio'] ?? null,
            'availability'     => $data['availability'] ?? null,
        ])->save();

        return back()->with('status', 'پروفایل با موفقیت به‌روزرسانی شد.');
    }
}
