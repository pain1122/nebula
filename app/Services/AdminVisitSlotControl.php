<?php

namespace App\Services;

use App\Models\AuditEvent;
use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Reservation;
use App\Models\ReservationScheduleChange;
use App\Models\User;
use Carbon\CarbonImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Admin actor boundary; never impersonates a doctor or materializes occurrences. */
class AdminVisitSlotControl
{
    public const MAX_TARGETS = 250;

    public function preview(Request $request, int $workplaceId): array
    {
        $actor = $this->actor($request->user());
        $selection = $this->input($request->query(), ['preview_expires_at' => ['sometimes', 'integer', 'min:1']]);
        $state = $this->state($actor, $workplaceId, $selection, false);
        $this->sameAuthority($actor, $this->actor($request->user()));
        $expires = isset($selection['preview_expires_at']) ? (int) $selection['preview_expires_at'] : now()->addMinutes(5)->timestamp;
        abort_unless($expires > now()->timestamp && $expires <= now()->addMinutes(5)->timestamp, 409, 'Preview expired; refresh before saving.');

        return $this->response($state) + ['revision' => $this->revision($state, $actor, $expires), 'preview_expires_at' => $expires];
    }

    public function change(Request $request, int $workplaceId): array
    {
        $initial = $this->actor($request->user());
        $input = $request->except(['_token', '_method']);
        $extra = ['expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
            'preview_expires_at' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted'],
            'price' => ['sometimes', 'required', 'integer', 'min:0', 'max:9007199254740991'],
            'is_active' => ['sometimes', 'required', 'boolean']];
        $data = $this->input($input, $extra);
        if (! array_key_exists('price', $data) && ! array_key_exists('is_active', $data)) {
            throw ValidationException::withMessages(['changes' => 'Choose price or enabled state.']);
        }
        if (trim($data['reason']) === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required.']);
        }

        return DB::transaction(function () use ($request, $workplaceId, $initial, $data) {
            $actor = $this->actor($request->user(), true);
            $this->sameAuthority($initial, $actor);
            $expires = (int) $data['preview_expires_at'];
            abort_unless($expires > now()->timestamp && $expires <= now()->addMinutes(5)->timestamp, 409, 'Preview expired; refresh before saving.');
            // Slot -> workplace -> doctor -> service follows booking lock ordering.
            $state = $this->state($actor, $workplaceId, $data, true);
            abort_unless(hash_equals($this->revision($state, $actor, $expires), $data['expected_revision']), 409, 'Schedule changed; preview again before saving.');
            $targets = array_filter($state['items'], fn ($item) => $item['eligible']);
            abort_unless($targets, 409, 'No eligible slots remain.');
            if (array_key_exists('price', $data) && count(array_unique(array_column($targets, 'currency'))) !== 1) {
                throw ValidationException::withMessages(['price' => 'Choose slots sharing one currency for a price change.']);
            }
            $before = [];
            $after = [];
            foreach ($targets as $item) {
                $slot = DoctorVisitSlot::query()->where('public_id', $item['public_id'])->lockForUpdate()->firstOrFail();
                $values = [];
                if (array_key_exists('price', $data)) {
                    $values['price'] = (int) $data['price'];
                }
                if (array_key_exists('is_active', $data)) {
                    $values['is_active'] = (bool) $data['is_active'];
                }
                $slot->forceFill($values);
                if (! $slot->isDirty()) {
                    continue;
                }
                $before[] = ['public_id' => $item['public_id'], 'price' => $item['price'], 'is_active' => $item['is_active'], 'currency' => $item['currency']];
                $slot->save();
                $after[] = ['public_id' => (string) $slot->public_id, 'price' => (string) $slot->price, 'is_active' => $slot->is_active, 'currency' => $slot->currency];
            }
            abort_unless($after, 422, 'No slot values would change.');
            app(AuditLogger::class)->log(request: $request, actor: $actor,
                action: 'admin.visit_slots.controlled', subject: DoctorWorkplace::findOrFail($workplaceId), riskLevel: 'high',
                before: ['selection' => $state['selection'], 'slots' => $before],
                after: ['selection' => $state['selection'], 'slots' => $after], reason: trim($data['reason']));
            $this->sameAuthority($actor, $this->actor($request->user(), true));

            return ['workplace_id' => $workplaceId, 'changed_slot_public_ids' => array_column($after, 'public_id')];
        }, 3);
    }

    private function input(array $input, array $extra = []): array
    {
        $rules = ['checkup_id' => ['required', 'integer', 'min:1'], 'scope' => ['required', Rule::in(['slot', 'day', 'week'])],
            'date' => ['required', 'date_format:Y-m-d'], 'slot_public_id' => ['required_if:scope,slot', 'prohibited_unless:scope,slot', 'string', 'ulid']] + $extra;
        if (array_diff(array_keys($input), array_keys($rules))) {
            throw ValidationException::withMessages(['fields' => 'Unsupported schedule-control fields.']);
        }

        return validator($input, $rules)->validate();
    }

    private function state(User $actor, int $workplaceId, array $input, bool $lock): array
    {
        $workplace = DoctorWorkplace::findOrFail($workplaceId);
        $hospital = MarketplaceHospital::findOrFail($workplace->marketplace_hospital_id);
        $timezone = $hospital->timezone;
        abort_unless(is_string($timezone) && in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true), 503, 'Hospital timezone is unavailable.');
        $date = CarbonImmutable::createFromFormat('!Y-m-d', $input['date'], $timezone);
        $from = $input['scope'] === 'week' ? $date->startOfWeek(CarbonImmutable::MONDAY) : $date;
        $until = $from->addDays($input['scope'] === 'week' ? 7 : 1)->startOfDay();
        $query = DoctorVisitSlot::query()->where('doctor_workplace_id', $workplaceId)->where('checkup_id', $input['checkup_id']);
        if ($input['scope'] === 'slot') {
            $query->where('public_id', $input['slot_public_id']);
        } else {
            $query->where('starts_at', '>=', $from->utc())->where('starts_at', '<', $until->utc());
        }
        if ($lock) {
            $query->lockForUpdate();
        }
        $slots = $query->orderBy('id')->limit(self::MAX_TARGETS + 1)->get();
        abort_if($slots->count() > self::MAX_TARGETS, 503, 'Selection exceeds 250 slots; choose a smaller scope.');
        abort_if($input['scope'] === 'slot' && $slots->isEmpty(), 404);
        if ($input['scope'] === 'slot' && $slots->first()->starts_at->copy()->setTimezone($timezone)->toDateString() !== $input['date']) {
            throw ValidationException::withMessages(['date' => 'Date must match the selected slot in the hospital timezone.']);
        }
        if ($lock) {
            $workplace = DoctorWorkplace::query()->lockForUpdate()->findOrFail($workplaceId);
        }
        $doctorQuery = DoctorProfile::withTrashed()->whereKey($workplace->doctor_profile_id);
        $doctor = ($lock ? $doctorQuery->lockForUpdate() : $doctorQuery)->firstOrFail();
        $serviceQuery = Checkup::withTrashed()->whereKey($input['checkup_id']);
        $service = ($lock ? $serviceQuery->lockForUpdate() : $serviceQuery)->firstOrFail();
        $hospitalQuery = MarketplaceHospital::whereKey($workplace->marketplace_hospital_id);
        $hospital = ($lock ? $hospitalQuery->lockForUpdate() : $hospitalQuery)->firstOrFail();
        abort_unless($hospital->timezone === $timezone, 409, 'Hospital timezone changed.');
        $ownerQuery = User::whereKey($doctor->user_id);
        $owner = ($lock ? $ownerQuery->lockForUpdate() : $ownerQuery)->firstOrFail();
        if ($lock) {
            DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $owner->id)->orderBy('role_id')->lockForUpdate()->get();
        }
        $owner->setRelation('roles', $lock ? $owner->roles()->lockForUpdate()->get() : $owner->roles()->get());
        abort_if(! $owner->is($actor) && $owner->hasAnyRole(['admin', 'root-admin']), 404);
        $offeringQuery = DB::table('doctor_workplace_checkup')->where('doctor_workplace_id', $workplaceId)->where('checkup_id', $service->id);
        $offering = ($lock ? $offeringQuery->lockForUpdate() : $offeringQuery)->first();
        abort_unless($offering, 404);
        $rulesQuery = DoctorWorkingWindow::whereIn('id', $slots->pluck('doctor_working_window_id'))->orderBy('id');
        $rules = ($lock ? $rulesQuery->lockForUpdate() : $rulesQuery)->get()->keyBy('id');
        $available = $workplace->is_active && ! $workplace->archived_at && $hospital->is_active && ! $hospital->archived_at
            && ! $doctor->trashed() && $doctor->verified && $owner->permitsAuthentication() && $owner->hasRole('doctor')
            && ! $service->trashed() && $service->is_active && $offering->is_active;
        $items = [];
        $history = [];
        $clock = now();
        foreach ($slots as $slot) {
            $rule = $rules->get($slot->doctor_working_window_id);
            $reservationsQuery = Reservation::where('doctor_visit_slot_id', $slot->id)->orderBy('id');
            $reservations = ($lock ? $reservationsQuery->lockForUpdate() : $reservationsQuery)->limit(1001)->get(['id', 'status', 'updated_at']);
            $changesQuery = ReservationScheduleChange::where(fn ($q) => $q->where('previous_doctor_visit_slot_id', $slot->id)->orWhere('new_doctor_visit_slot_id', $slot->id))->orderBy('id');
            $changes = ($lock ? $changesQuery->lockForUpdate() : $changesQuery)->limit(1001)->get(['id']);
            $conflictQuery = Reservation::blocking()->where('doctor_profile_id', $doctor->id)->where('starts_at', '<', $slot->ends_at)->where('ends_at', '>', $slot->starts_at)->orderBy('id');
            $conflicts = ($lock ? $conflictQuery->lockForUpdate() : $conflictQuery)->limit(1001)->get(['id', 'status', 'hold_expires_at', 'starts_at', 'ends_at', 'updated_at']);
            abort_if(max($reservations->count(), $changes->count(), $conflicts->count()) > 1000, 503, 'Slot history exceeds the guarded bound.');
            $exclusions = [];
            if (! $available) {
                $exclusions[] = 'offering_unavailable';
            }
            if (! $rule || ! $rule->is_active || $rule->doctor_workplace_id !== $workplaceId || $rule->checkup_id !== $service->id || ! $slot->ends_at->greaterThan($slot->starts_at)) {
                $exclusions[] = 'rule_unavailable';
            }
            if ($slot->starts_at->lessThanOrEqualTo($clock)) {
                $exclusions[] = 'past';
            }
            if ($reservations->isNotEmpty() || $changes->isNotEmpty()) {
                $exclusions[] = 'reservation_history';
            }
            if ($conflicts->isNotEmpty()) {
                $exclusions[] = 'blocking_reservation';
            }
            $items[] = ['public_id' => (string) $slot->public_id, 'starts_at' => $slot->starts_at->copy()->setTimezone($timezone)->toIso8601String(),
                'ends_at' => $slot->ends_at->copy()->setTimezone($timezone)->toIso8601String(), 'price' => (string) $slot->price, 'currency' => $slot->currency,
                'is_active' => (bool) $slot->is_active, 'eligible' => ! $exclusions, 'exclusions' => $exclusions];
            $history[] = [$reservations->toArray(), $changes->toArray(), $conflicts->toArray()];
        }
        $selection = ['workplace_id' => $workplaceId, 'checkup_id' => (int) $input['checkup_id'], 'scope' => $input['scope'], 'date' => $input['date'], 'slot_public_id' => $input['slot_public_id'] ?? null];
        $auditQuery = AuditEvent::where('subject_type', DoctorWorkplace::class)->where('subject_id', $workplaceId)
            ->whereIn('action', ['admin.visit_slots.controlled', 'doctor.visit_slots.controlled'])->orderByDesc('id');
        $auditVersion = ($lock ? $auditQuery->lockForUpdate() : $auditQuery)->first(['id'])?->id;
        $currentOwner = $lock ? User::query()->lockForUpdate()->findOrFail($owner->id) : User::findOrFail($owner->id);
        $currentOwner->setRelation('roles', $lock ? $currentOwner->roles()->lockForUpdate()->get() : $currentOwner->roles()->get());
        abort_unless($owner->roles->pluck('name')->sort()->values()->all() === $currentOwner->roles->pluck('name')->sort()->values()->all(), 403);
        abort_if(! $currentOwner->is($actor) && $currentOwner->hasAnyRole(['admin', 'root-admin']), 404);

        return ['selection' => $selection, 'period' => ['from' => $from->toDateString(), 'to' => $until->subDay()->toDateString(), 'timezone' => $timezone], 'items' => $items,
            'internal' => [$workplace->getAttributes(), $hospital->getAttributes(), $doctor->only(['id', 'user_id', 'verified', 'deleted_at']),
                $owner->only(['id', 'account_state', 'updated_at']), $owner->roles->pluck('name')->sort()->values()->all(),
                $service->only(['id', 'is_active', 'deleted_at', 'updated_at']), (array) $offering, $rules->toArray(), $slots->toArray(), $history, $auditVersion]];
    }

    private function response(array $state): array
    {
        return array_intersect_key($state, array_flip(['selection', 'period', 'items'])) + [
            'eligible_count' => count(array_filter($state['items'], fn ($item) => $item['eligible'])),
            'limits' => ['slots' => self::MAX_TARGETS, 'max_price' => '9007199254740991', 'reason' => 1000],
        ];
    }

    private function revision(array $state, User $actor, int $expires): string
    {
        return hash_hmac('sha256', json_encode([$state, $actor->id, $actor->roles->pluck('name')->sort()->values()->all(), $expires], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    private function actor(User $user, bool $lock = false): User
    {
        $query = User::whereKey($user->id);
        $actor = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        if ($lock) {
            DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $actor->id)->orderBy('role_id')->lockForUpdate()->get();
        }
        $actor->setRelation('roles', $lock ? $actor->roles()->lockForUpdate()->get() : $actor->roles()->get());
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function sameAuthority(User $before, User $after): void
    {
        abort_unless($before->roles->pluck('name')->sort()->values()->all() === $after->roles->pluck('name')->sort()->values()->all(), 403);
    }
}
