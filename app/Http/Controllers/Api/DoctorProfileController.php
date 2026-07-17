<?php

namespace App\Http\Controllers\Api;

use App\Models\DoctorProfile;
use App\Models\Specialty;
use App\Models\User;
use App\Support\QuerySorting;
use App\Services\DoctorScheduleService;
use Illuminate\Http\Request;

class DoctorProfileController extends ApiController
{
    public function __construct(private DoctorScheduleService $doctorScheduleService)
    {
    }

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
            'workplace_id'     => ['required_with:availability', 'exists:doctor_workplaces,id'],
        ]);

        $user = $request->user();

        /** @var DoctorProfile $profile */
        $profile = $user->doctorProfile;
        if (! $profile) {
            return $this->errorResponse('Doctor profile not found.', 404);
        }

        $availability = $data['availability'] ?? null;
        $workplaceId = $data['workplace_id'] ?? null;
        unset($data['availability'], $data['workplace_id']);

        $profile->fill($data);
        $profile->save();

        if (array_key_exists('specialty_id', $data)) {
            $profile->specialties()->sync([
                $data['specialty_id'] => ['is_primary' => true],
            ]);
        }

        if ($workplaceId !== null) {
            $workplace = $profile->workplaces()->whereKey($workplaceId)->firstOrFail();
            $this->doctorScheduleService->replaceFromLegacyInput($workplace, $availability ?? []);
        }

        return $this->successResponse(
            data: $profile->fresh('specialty'),
            message: 'Doctor profile updated.'
        );
    }

    // GET /api/admin/doctors
    public function index(Request $request)
    {
        $query = DoctorProfile::query()
            ->with(['user:id,name,email', 'specialty:id,name'])
            ->select('doctor_profiles.*');

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->where('doctor_profiles.bio', 'like', "%{$term}%")
                    ->orWhere('doctor_profiles.phone', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                    ->orWhereHas('specialty', fn ($sq) => $sq->where('name', 'like', "%{$term}%"));
            });
        }

        if ($request->has('verified')) {
            $query->where('doctor_profiles.verified', $request->boolean('verified'));
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
            'id' => 'doctor_profiles.id',
            'created_at' => 'doctor_profiles.created_at',
            'fee' => 'doctor_profiles.fee',
            'experience_years' => 'doctor_profiles.experience_years',
            'verified' => 'doctor_profiles.verified',
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
        ], 'created_at', 'desc');

        $doctors = $query
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
