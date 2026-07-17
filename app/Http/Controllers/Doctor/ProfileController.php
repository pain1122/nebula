<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Doctor\UpdateProfileRequest;
use App\Models\DoctorProfile;
use App\Models\Specialty;
use App\Services\DoctorScheduleService;

class ProfileController extends Controller
{
    public function __construct(private DoctorScheduleService $doctorScheduleService)
    {
    }

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
        ])->save();

        if (! empty($data['specialty_id'])) {
            $profile->specialties()->sync([
                $data['specialty_id'] => ['is_primary' => true],
            ]);
        }

        if (array_key_exists('availability', $data)) {
            $workplace = $profile->workplaces()->where('is_active', true)->orderBy('id')->first();

            if (! $workplace) {
                return back()->withErrors([
                    'availability' => 'An active workplace is required before schedules can be configured.',
                ]);
            }

            $this->doctorScheduleService->replaceFromLegacyInput($workplace, $data['availability'] ?? []);
        }

        return back()->with('status', 'پروفایل با موفقیت به‌روزرسانی شد.');
    }
}
