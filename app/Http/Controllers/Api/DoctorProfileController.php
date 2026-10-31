<?php

namespace App\Http\Controllers\Api;

use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkplace;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\DoctorScheduleService;
use App\Services\DoctorVisitSlotControlService;
use App\Support\QuerySorting;
use App\Support\ScheduleControlConflict;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class DoctorProfileController extends ApiController
{
    public function __construct(private DoctorScheduleService $doctorScheduleService) {}

    // GET /api/doctor/profile
    public function show(Request $request)
    {
        $user = $request->user()->load('doctorProfile.specialty');

        return $this->successResponse(
            data: [
                'user' => $this->formatUser($user),
                'doctor_profile' => $user->doctorProfile,
            ],
            message: 'Doctor profile.'
        );
    }

    // PUT /api/doctor/profile
    public function update(Request $request)
    {
        $data = $request->validate([
            'specialty_id' => ['sometimes', 'exists:specialties,id'],
            'fee' => ['sometimes', 'integer', 'min:0'],
            'bio' => ['nullable', 'string'],
            'experience_years' => ['nullable', 'integer', 'min:0'],
            'availability' => ['nullable', 'array'],
            'availability.*.day' => ['required_with:availability', 'in:sat,sun,mon,tue,wed,thu,fri'],
            'availability.*.windows' => ['required_with:availability', 'array'],
            'availability.*.windows.*' => ['array'],
            'availability.*.windows.*.checkup_id' => ['required', 'integer'],
            'availability.*.windows.*.start' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.end' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.duration_minutes' => ['required', 'integer', 'min:5', 'max:720'],
            'availability.*.windows.*.price_override' => ['nullable', 'integer', 'min:0'],
            'availability.*.windows.*.currency_override' => ['nullable', 'string', 'size:3'],
            'availability.*.windows.*.effective_from' => ['nullable', 'date_format:Y-m-d'],
            'availability.*.windows.*.effective_until' => ['nullable', 'date_format:Y-m-d'],
            'availability.*.windows.*.breaks' => ['nullable', 'array'],
            'availability.*.windows.*.breaks.*.start' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.breaks.*.end' => ['required', 'date_format:H:i'],
            'workplace_id' => ['required_with:availability', 'exists:doctor_workplaces,id'],
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
            $this->doctorScheduleService->replaceWeeklyRules($workplace, $availability ?? []);
        }

        return $this->successResponse(
            data: $profile->fresh('specialty'),
            message: 'Doctor profile updated.'
        );
    }

    public function controlVisitSlot(
        Request $request,
        DoctorVisitSlot $doctorVisitSlot,
        DoctorVisitSlotControlService $service,
    ) {
        $data = $request->validate([
            'is_active' => ['nullable', 'required_without:price', 'boolean'],
            'price' => ['nullable', 'required_without:is_active', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:1000'],
            'starts_at' => ['prohibited'],
            'ends_at' => ['prohibited'],
            'currency' => ['prohibited'],
        ]);

        try {
            $slots = $service->change(
                request: $request,
                actor: $request->user(),
                workplace: $doctorVisitSlot->workplace,
                checkup: $doctorVisitSlot->checkup,
                scope: 'slot',
                localDate: $doctorVisitSlot->starts_at,
                slot: $doctorVisitSlot,
                isActive: array_key_exists('is_active', $data) ? (bool) $data['is_active'] : null,
                price: $data['price'] ?? null,
                reason: $data['reason'],
            );
        } catch (ScheduleControlConflict $exception) {
            return $this->errorResponse($exception->getMessage(), 409, ['slot_id' => ['slot_control_conflict']]);
        } catch (\DomainException|\InvalidArgumentException $exception) {
            return $this->errorResponse($exception->getMessage(), 422, ['slot_id' => ['slot_control_rejected']]);
        }

        return $this->successResponse($slots->first(), 'Visit slot updated.');
    }

    public function controlVisitSlotRange(
        Request $request,
        DoctorWorkplace $doctorWorkplace,
        DoctorVisitSlotControlService $service,
    ) {
        $data = $request->validate([
            'checkup_id' => ['required', 'integer', 'exists:checkups,id'],
            'scope' => ['required', 'in:day,week'],
            'date' => ['required', 'date_format:Y-m-d'],
            'is_active' => ['nullable', 'required_without:price', 'boolean'],
            'price' => ['nullable', 'required_without:is_active', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:1000'],
            'starts_at' => ['prohibited'],
            'ends_at' => ['prohibited'],
            'currency' => ['prohibited'],
        ]);

        try {
            $slots = $service->change(
                request: $request,
                actor: $request->user(),
                workplace: $doctorWorkplace,
                checkup: \App\Models\Checkup::query()->findOrFail($data['checkup_id']),
                scope: $data['scope'],
                localDate: Carbon::createFromFormat('Y-m-d', $data['date']),
                slot: null,
                isActive: array_key_exists('is_active', $data) ? (bool) $data['is_active'] : null,
                price: $data['price'] ?? null,
                reason: $data['reason'],
            );
        } catch (ScheduleControlConflict $exception) {
            return $this->errorResponse($exception->getMessage(), 409, ['date' => ['slot_control_conflict']]);
        } catch (\DomainException|\InvalidArgumentException $exception) {
            return $this->errorResponse($exception->getMessage(), 422, ['date' => ['slot_control_rejected']]);
        }

        return $this->successResponse([
            'scope' => $data['scope'],
            'date' => $data['date'],
            'affected_slots' => $slots->count(),
        ], 'Visit slots updated.');
    }

    // GET /api/admin/doctors
    public function index(Request $request)
    {
        $query = DoctorProfile::query()
            ->with(['user:id,public_id,name', 'specialty:id,name'])
            ->select('doctor_profiles.*');

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->where('doctor_profiles.bio', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%"))
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
        $doctors->getCollection()->each(fn ($profile) => $profile->makeHidden(['phone']));

        return $this->successResponse(
            data: $doctors,
            message: 'Doctors list.'
        );
    }

    // PUT /api/admin/doctors/{doctorProfile}/verify
    public function verify(DoctorProfile $doctorProfile, Request $request, AuditLogger $auditLogger)
    {
        Gate::authorize('verify', $doctorProfile);
        $data = $request->validate([
            'verified' => ['required', 'boolean'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $doctorProfile = DB::transaction(function () use ($doctorProfile, $request, $auditLogger, $data): DoctorProfile {
            $lockedProfile = DoctorProfile::query()->lockForUpdate()->findOrFail($doctorProfile->getKey());
            $before = $this->verificationSnapshot($lockedProfile);
            $lockedProfile->forceFill([
                'verified' => $data['verified'],
                'verified_at' => $data['verified'] ? now() : null,
                'verified_by' => $request->user()->getKey(),
            ])->save();

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.doctor.verification_changed',
                subject: $lockedProfile,
                riskLevel: 'critical',
                before: $before,
                after: $this->verificationSnapshot($lockedProfile),
                reason: trim($data['reason']),
            );

            return $lockedProfile->fresh(['user:id,public_id,name', 'specialty:id,name'])->makeHidden(['phone']);
        });

        return $this->successResponse(
            data: $doctorProfile->fresh(['user:id,public_id,name', 'specialty:id,name'])->makeHidden(['phone']),
            message: $doctorProfile->verified
                ? 'Doctor verified.'
                : 'Doctor unverified.'
        );
    }

    /** @return array<string, mixed> */
    private function verificationSnapshot(DoctorProfile $profile): array
    {
        return [
            'verified' => (bool) $profile->verified,
            'verified_at' => $profile->verified_at?->toISOString(),
            'verified_by' => $profile->verified_by,
        ];
    }
}
