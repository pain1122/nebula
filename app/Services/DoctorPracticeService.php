<?php

namespace App\Services;

use App\Models\DoctorProfile;
use App\Models\Specialty;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class DoctorPracticeService
{
    public function actor(User $actor): User
    {
        $fresh = $actor->fresh(['roles', 'doctorProfile']);
        abort_unless($fresh && $fresh->permitsAuthentication() && $fresh->hasRole('doctor') && $fresh->doctorProfile, 403);

        return $fresh;
    }

    public function capture(User $actor): array
    {
        $actor = $this->actor($actor);
        $profile = $actor->doctorProfile->load(['specialties', 'specialty', 'workplaces.hospital', 'workplaces.checkups', 'workplaces.workingWindows.breaks']);
        $assigned = $profile->specialties->sortBy('id')->map(fn ($s) => (int) $s->id)->values()->all();
        if ($assigned === [] && $profile->specialty_id) {
            $assigned = [(int) $profile->specialty_id];
        }
        $professional = ['specialty_ids' => $assigned, 'primary_specialty_id' => $profile->specialty_id,
            'experience_years' => (int) $profile->experience_years, 'fee' => (int) $profile->fee, 'bio' => $profile->bio ?? ''];
        $days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        $workplaces = $profile->workplaces->sortBy('id')->map(fn ($w) => [
            'id' => $w->id, 'name' => $w->display_name ?: $w->hospital?->name,
            'hospital_public_id' => $w->hospital?->public_id, 'city' => $w->hospital?->city, 'address' => $w->hospital?->address,
            'timezone' => $w->hospital?->timezone, 'active' => (bool) ($w->is_active && $w->hospital?->is_active && ! $w->hospital?->archived_at),
            'services' => $w->checkups->sortBy('id')->map(fn ($c) => ['id' => $c->id, 'title' => $c->title, 'active' => (bool) ($c->is_active && $c->pivot->is_active),
                'price' => (int) ($c->pivot->price_override ?? $profile->fee), 'currency' => $c->pivot->currency_override ?? $c->currency])->values()->all(),
            'availability' => $w->workingWindows->where('is_active', true)->sortBy(fn ($r) => sprintf('%d-%s-%012d', $r->weekday, $r->starts_at, $r->id))->groupBy('weekday')
                ->map(fn ($rules, $day) => ['day' => $days[$day], 'windows' => $rules->map(fn ($r) => [
                    'checkup_id' => (int) $r->checkup_id, 'start' => substr($r->starts_at, 0, 5), 'end' => substr($r->ends_at, 0, 5), 'duration_minutes' => (int) $r->visit_duration_minutes,
                    'price_override' => $r->price_override, 'currency_override' => $r->currency_override,
                    'effective_from' => $r->effective_from?->format('Y-m-d'), 'effective_until' => $r->effective_until?->format('Y-m-d'),
                    'breaks' => $r->breaks->sortBy('starts_at')->map(fn ($b) => ['start' => substr($b->starts_at, 0, 5), 'end' => substr($b->ends_at, 0, 5)])->values()->all(),
                ])->values()->all()])->values()->all(),
        ])->values()->all();
        $state = [$profile->getAttributes(), $professional, $workplaces, $profile->specialty?->getAttributes(), $profile->specialties->sortBy('id')->map(fn ($s) => $s->getAttributes())->values()->all(),
            DB::table('audit_events')->where('subject_public_id', $profile->public_id)->max('id'),
            $profile->workplaces->sortBy('id')->map(fn ($w) => [$w->getAttributes(), $w->workingWindows->sortBy('id')->map(fn ($r) => [$r->getAttributes(), $r->breaks->sortBy('id')->values()->toArray()])->values()->all(), $w->checkups->sortBy('id')->map(fn ($c) => [$c->getAttributes(), $c->pivot->getAttributes()])->values()->all()])->values()->all(),
        ];
        $revision = hash_hmac('sha256', json_encode($state, JSON_THROW_ON_ERROR), (string) config('app.key'));

        return ['owner_id' => $actor->id, 'revision' => $revision, 'verified' => (bool) $profile->verified,
            'professional' => $professional, 'workplaces' => $workplaces,
            'specialty_options' => Specialty::where('is_active', true)->orderBy('name')->orderBy('id')->limit(500)->get(['id', 'name'])->toArray()];
    }

    public function save(Request $request): array
    {
        $actor = $this->actor($request->user());
        $fields = ['mode', 'expected_revision', 'confirmed', 'reason', 'specialty_ids', 'primary_specialty_id', 'experience_years', 'fee', 'bio', 'workplace_id', 'availability'];
        abort_if(array_diff(array_keys($request->all()), $fields), 422, 'Unsupported practice fields.');
        $request->merge(['reason' => trim((string) $request->input('reason', ''))]);
        $data = $request->validate([
            'mode' => ['required', Rule::in(['professional', 'weekly'])],
            'expected_revision' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'], 'confirmed' => ['required', 'accepted'], 'reason' => ['required', 'string', 'max:1000'],
            'specialty_ids' => ['required_if:mode,professional', 'array', 'min:1', 'max:10'], 'specialty_ids.*' => ['integer', 'distinct', 'min:1'],
            'primary_specialty_id' => ['required_if:mode,professional', 'integer', 'min:1'],
            'experience_years' => ['required_if:mode,professional', 'integer', 'between:0,80'], 'fee' => ['required_if:mode,professional', 'integer', 'between:0,2147483647'],
            'bio' => ['nullable', 'string', 'max:5000'], 'workplace_id' => ['required_if:mode,weekly', 'integer', 'min:1'],
            'availability' => ['present_if:mode,weekly', 'array', 'max:7'],
            'availability.*' => ['array:day,windows'], 'availability.*.day' => ['required', 'distinct', Rule::in(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])],
            'availability.*.windows' => ['required', 'array', 'min:1', 'max:8'], 'availability.*.windows.*' => ['array:checkup_id,start,end,duration_minutes,price_override,currency_override,effective_from,effective_until,breaks'],
            'availability.*.windows.*.checkup_id' => ['required', 'integer', 'min:1'],
            'availability.*.windows.*.start' => ['required', 'date_format:H:i'], 'availability.*.windows.*.end' => ['required', 'date_format:H:i'],
            'availability.*.windows.*.duration_minutes' => ['required', 'integer', 'between:5,720'], 'availability.*.windows.*.price_override' => ['nullable', 'integer', 'between:0,2147483647'],
            'availability.*.windows.*.currency_override' => ['nullable', 'string', 'regex:/^[A-Z]{3}$/'],
            'availability.*.windows.*.effective_from' => ['nullable', 'date_format:Y-m-d'], 'availability.*.windows.*.effective_until' => ['nullable', 'date_format:Y-m-d'],
            'availability.*.windows.*.breaks' => ['sometimes', 'array', 'max:8'], 'availability.*.windows.*.breaks.*' => ['array:start,end'],
            'availability.*.windows.*.breaks.*.start' => ['required', 'date_format:H:i'], 'availability.*.windows.*.breaks.*.end' => ['required', 'date_format:H:i'],
        ]);
        $otherModeFields = $data['mode'] === 'professional' ? ['workplace_id', 'availability'] : ['specialty_ids', 'primary_specialty_id', 'experience_years', 'fee', 'bio'];
        abort_if(array_intersect(array_keys($data), $otherModeFields), 422, 'Mixed practice changes are unavailable.');

        return DB::transaction(function () use ($actor, $request, $data) {
            $locked = User::whereKey($actor->id)->lockForUpdate()->firstOrFail();
            $locked = $this->actor($locked);
            $profile = DoctorProfile::where('user_id', $locked->id)->lockForUpdate()->firstOrFail();
            if ($data['mode'] === 'weekly') {
                $profile->workplaces()->whereKey($data['workplace_id'])->lockForUpdate()->firstOrFail();
            }
            $before = $this->capture($locked);
            abort_unless(hash_equals($before['revision'], $data['expected_revision']), 409, 'Practice changed; refresh before editing.');
            if ($data['mode'] === 'professional') {
                $ids = array_map('intval', $data['specialty_ids']);
                $selected = Specialty::whereIn('id', $ids)->where('is_active', true)->orderBy('id')->lockForUpdate()->get();
                if ($selected->count() !== count($ids) || ! in_array((int) $data['primary_specialty_id'], $ids, true)) {
                    throw ValidationException::withMessages(['specialty_ids' => ['active_specialties_and_primary_required']]);
                }
                $profile->fill(['specialty_id' => $data['primary_specialty_id'], 'experience_years' => $data['experience_years'], 'fee' => $data['fee'], 'bio' => trim($data['bio'] ?? '')])->save();
                $profile->specialties()->sync(collect($ids)->mapWithKeys(fn ($id) => [$id => ['is_primary' => $id === (int) $data['primary_specialty_id']]])->all());
            } else {
                $workplace = $profile->workplaces()->whereKey($data['workplace_id'])->firstOrFail();
                app(DoctorScheduleService::class)->replaceWeeklyRules($workplace, $data['availability']);
            }
            $after = $this->capture($locked);
            abort_if($before['professional'] === $after['professional'] && $before['workplaces'] === $after['workplaces'], 422, 'No practice changes.');
            app(AuditLogger::class)->log(request: $request, actor: $locked, action: 'doctor.practice.updated', subject: $profile, riskLevel: 'high',
                before: ['revision' => $before['revision'], 'mode' => $data['mode']], after: ['revision' => $after['revision'], 'mode' => $data['mode']], reason: $data['reason']);

            return $this->capture($locked);
        }, 3);
    }
}
