<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\AdminUserResource;
use App\Models\Specialty;
use App\Models\User;
use App\Rules\NotCommonPassword;
use App\Services\AdminIdentityService;
use App\Services\AuditLogger;
use App\Services\HospitalAdministration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class ClinicalAccountController extends ApiController
{
    private function revision(User $actor): string
    {
        return hash_hmac('sha256', json_encode([$actor->id, $actor->roles->pluck('name')->sort()->values()->all(), User::max('id'),
            Specialty::where('is_active', true)->orderBy('id')->get(['id', 'name', 'updated_at'])->toArray()], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    public function context(Request $request, HospitalAdministration $authority)
    {
        $actor = $authority->actor($request->user());
        $specialties = Specialty::where('is_active', true)->orderBy('name')->orderBy('id')->limit(501)->get(['id', 'name']);
        abort_if($specialties->count() > 500, 422);

        return $this->successResponse(['revision' => $this->revision($actor), 'specialties' => $specialties, 'verification_on_create' => true])->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, HospitalAdministration $authority, AdminIdentityService $identities)
    {
        $authority->actor($request->user());
        $fields = ['role', 'first_name', 'last_name', 'email', 'phone', 'birth_date', 'NID', 'password', 'password_confirmation', 'specialty_id', 'experience_years', 'fee', 'verified', 'reason', 'confirmed', 'expected_revision'];
        abort_if(array_diff(array_keys($request->all()), $fields), 422, 'Unsupported creation fields.');
        $request->merge(['reason' => trim((string) $request->input('reason', ''))]);
        $data = $request->validate([
            'role' => ['required', Rule::in(['doctor', 'patient'])], 'first_name' => ['required', 'string', 'max:100'], 'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'], 'phone' => ['required', 'string', 'max:30', 'unique:users,phone'],
            'birth_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'], 'NID' => ['required', 'string', 'regex:/\A[0-9]{10}\z/', 'unique:users,NID'],
            'password' => ['required', 'string', 'confirmed', Password::min(15)->max(64), new NotCommonPassword([$request->input('email'), $request->input('phone'), $request->input('NID'), $request->input('first_name'), $request->input('last_name'), 'checkupino'])],
            'specialty_id' => ['required_if:role,doctor', 'integer', 'min:1'], 'experience_years' => ['required_if:role,doctor', 'integer', 'between:0,80'], 'fee' => ['required_if:role,doctor', 'integer', 'between:0,2147483647'],
            'verified' => ['required_if:role,doctor', 'boolean'],
            'reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted'], 'expected_revision' => ['required', 'regex:/\A[a-f0-9]{64}\z/'],
        ]);
        abort_if($data['role'] === 'patient' && array_intersect(array_keys($data), ['specialty_id', 'experience_years', 'fee', 'verified']), 422, 'Patient cannot receive doctor fields.');
        $user = DB::transaction(function () use ($authority, $identities, $request, $data): User {
            $actor = $authority->actor($request->user(), true);
            abort_unless(hash_equals($this->revision($actor), $data['expected_revision']), 409, 'Creation context changed; refresh before submitting.');
            $specialty = $data['role'] === 'doctor' ? Specialty::whereKey($data['specialty_id'])->where('is_active', true)->lockForUpdate()->firstOrFail() : null;
            $attributes = array_intersect_key($data, array_flip(['first_name', 'last_name', 'phone', 'email', 'birth_date', 'NID']));
            $user = $identities->create($request, $actor, $attributes, $data['role'], $data['password'], $data['reason']);
            if ($specialty) {
                $profile = $user->doctorProfile()->firstOrFail();
                $profile->fill(['specialty_id' => $specialty->id, 'experience_years' => $data['experience_years'], 'fee' => $data['fee'], 'verified' => $data['verified']]);
                $profile->verified_at = $data['verified'] ? now() : null;
                $profile->verified_by = $data['verified'] ? $actor->id : null;
                $profile->save();
                $profile->specialties()->attach($specialty->id, ['is_primary' => true]);
                app(AuditLogger::class)->log(request: $request, actor: $actor, action: 'admin.doctor.onboarded', subject: $profile, riskLevel: 'high', before: null, after: ['verified' => (bool) $data['verified'], 'specialty_id' => $specialty->id, 'fee' => $data['fee'], 'experience_years' => $data['experience_years']], reason: $data['reason']);
            }

            return $user;
        }, 3);

        return $this->successResponse(['user' => (new AdminUserResource($user))->resolve($request)])->header('Cache-Control', 'no-store, private');
    }
}
