<?php

namespace App\Http\Controllers\Api;

use App\Models\DoctorProfile;
use Illuminate\Http\Request;

class DoctorProfileController extends ApiController
{
    // GET /api/doctor/profile
    public function show(Request $request)
    {
        $user = $request->user()->load('doctorProfile.specialty');

        return $this->successResponse(
            data: [
                'user'           => $this->formatUser($user),
                'doctor_profile' => $user->doctorProfile,
            ],
            message: 'Doctor profile.'
        );
    }

    // PUT /api/doctor/profile
    public function update(Request $request)
    {
        $data = $request->validate([
            'specialty_id'     => ['sometimes', 'exists:specialties,id'],
            'fee'              => ['sometimes', 'integer', 'min:0'],
            'bio'              => ['nullable', 'string'],
            'experience_years' => ['nullable', 'integer', 'min:0'],
            'availability'     => ['nullable', 'array'], // JSON schedule
        ]);

        $user = $request->user();

        /** @var DoctorProfile $profile */
        $profile = $user->doctorProfile;
        if (! $profile) {
            return $this->errorResponse('Doctor profile not found.', 404);
        }

        $profile->fill($data);
        $profile->save();

        return $this->successResponse(
            data: $profile->fresh('specialty'),
            message: 'Doctor profile updated.'
        );
    }

    // GET /api/admin/doctors
    public function index()
    {
        $doctors = DoctorProfile::with(['user:id,name,email', 'specialty:id,name'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return $this->successResponse(
            data: $doctors,
            message: 'Doctors list.'
        );
    }

    // PUT /api/admin/doctors/{doctorProfile}/verify
    public function verify(DoctorProfile $doctorProfile, Request $request)
    {
        $data = $request->validate([
            'verified' => ['required', 'boolean'],
        ]);

        $doctorProfile->verified = $data['verified'];
        $doctorProfile->save();

        return $this->successResponse(
            data: $doctorProfile->fresh(['user:id,name,email', 'specialty:id,name']),
            message: $doctorProfile->verified
                ? 'Doctor verified.'
                : 'Doctor unverified.'
        );
    }
}
