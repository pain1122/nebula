<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Checkup;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use DateTimeZone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Operational metadata only. Reads never materialize slots or change reservations. */
class ScheduleReadController extends ApiController
{
    public function index(Request $request)
    {
        $actor = $this->actor($request);
        $data = $this->filters($request, [
            'q' => ['sometimes', 'string', 'max:100'],
            'state' => ['sometimes', Rule::in(['current', 'active', 'inactive', 'archived', 'all'])],
            'doctor_id' => ['sometimes', 'integer', 'min:1'],
            'hospital_id' => ['sometimes', 'integer', 'min:1'],
            'checkup_id' => ['sometimes', 'integer', 'min:1'],
            'sort_by' => ['sometimes', Rule::in(['id', 'display_name', 'created_at', 'updated_at'])],
            'sort_dir' => ['sometimes', Rule::in(['asc', 'desc'])],
        ]);
        $query = $this->workplaces($actor);
        $state = $data['state'] ?? 'current';
        if ($state === 'archived') {
            $query->whereNotNull('doctor_workplaces.archived_at');
        } elseif ($state !== 'all') {
            $query->whereNull('doctor_workplaces.archived_at');
            if ($state !== 'current') {
                $query->where('doctor_workplaces.is_active', $state === 'active');
            }
        }
        foreach (['doctor_id' => 'doctor_profile_id', 'hospital_id' => 'marketplace_hospital_id'] as $key => $column) {
            if (isset($data[$key])) {
                $query->where($column, $data[$key]);
            }
        }
        if (isset($data['checkup_id'])) {
            $query->whereHas('checkups', fn ($service) => $service->withTrashed()->where('checkups.id', $data['checkup_id']));
        }
        if (($term = trim($data['q'] ?? '')) !== '') {
            $literal = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
            $query->where(function ($search) use ($literal, $term) {
                $search->whereRaw("doctor_workplaces.display_name LIKE ? ESCAPE '!'", [$literal])
                    ->orWhere('doctor_workplaces.public_id', $term)
                    ->orWhereHas('hospital', fn ($hospital) => $hospital->whereRaw("name LIKE ? ESCAPE '!'", [$literal]))
                    ->orWhereHas('doctorProfile', fn ($doctor) => $doctor->withTrashed()->whereHas('user', fn ($user) => $user->whereRaw("name LIKE ? ESCAPE '!'", [$literal])->orWhere('public_id', $term)));
            });
        }
        $sort = $data['sort_by'] ?? 'display_name';
        $direction = $data['sort_dir'] ?? 'asc';
        $query->orderBy('doctor_workplaces.'.$sort, $direction);
        if ($sort !== 'id') {
            $query->orderBy('doctor_workplaces.id', $direction);
        }
        $rows = $query->paginate($data['per_page'] ?? 20);

        return $this->respond($actor, $rows->getCollection()->map(fn ($row) => $this->workplaceData($row)), $this->pagination($rows), $rows->getCollection()->modelKeys());
    }

    public function show(Request $request, string $workplaceId)
    {
        $actor = $this->actor($request);
        if ($request->query()) {
            throw ValidationException::withMessages(['filters' => 'Workplace detail accepts no filters.']);
        }
        $row = $this->workplace($actor, $workplaceId);
        $services = $row->checkups()->withTrashed()->orderBy('checkups.id')->limit(101)->get(['checkups.id', 'checkups.public_id', 'checkups.title', 'checkups.is_active', 'checkups.deleted_at', 'checkups.price', 'checkups.currency']);
        abort_if($services->count() > 100, 503, 'Workplace service detail exceeds the safe bound.');
        $data = $this->workplaceData($row);
        $data['services'] = $services->map(fn ($service) => $this->checkupData($service) + [
            'offering_active' => (bool) $service->pivot->is_active,
            'price_override' => $service->pivot->price_override === null ? null : (string) $service->pivot->price_override,
            'currency_override' => $service->pivot->currency_override,
            'base_price' => (string) ($row->doctorProfile?->fee ?? 0), 'base_currency' => $service->currency,
        ]);

        return $this->respond($actor, $data, [], [$row->id]);
    }

    public function rules(Request $request, string $workplaceId)
    {
        $actor = $this->actor($request);
        $data = $this->filters($request, [
            'state' => ['sometimes', Rule::in(['active', 'inactive', 'all'])],
            'weekday' => ['sometimes', 'integer', 'between:0,6'],
            'checkup_id' => ['sometimes', 'integer', 'min:1'],
        ]);
        $workplace = $this->workplace($actor, $workplaceId);
        $query = $workplace->workingWindows()->with(['checkup' => fn ($service) => $service->withTrashed()->select(['id', 'public_id', 'title', 'is_active', 'deleted_at'])]);
        $this->activeFilter($query, $data);
        foreach (['weekday', 'checkup_id'] as $key) {
            if (isset($data[$key])) {
                $query->where($key, $data[$key]);
            }
        }
        $rows = $query->orderBy('weekday')->orderBy('starts_at')->orderBy('id')->paginate($data['per_page'] ?? 20);
        $items = $rows->getCollection()->map(function (DoctorWorkingWindow $row) {
            $breaks = $row->breaks()->orderBy('starts_at')->orderBy('id')->limit(51)->get(['starts_at', 'ends_at']);
            abort_if($breaks->count() > 50, 503, 'Rule breaks exceed the safe bound.');

            return ['id' => (int) $row->id, 'public_id' => (string) $row->public_id,
                'checkup' => $row->checkup ? $this->checkupData($row->checkup) : null,
                'weekday' => (int) $row->weekday, 'starts_at' => $row->starts_at, 'ends_at' => $row->ends_at,
                'duration_minutes' => (int) $row->visit_duration_minutes, 'is_active' => (bool) $row->is_active,
                'effective_from' => $row->effective_from?->toDateString(), 'effective_until' => $row->effective_until?->toDateString(),
                'price_override' => $row->price_override === null ? null : (string) $row->price_override,
                'currency_override' => $row->currency_override,
                'breaks' => $breaks->map(fn ($break) => ['starts_at' => $break->starts_at, 'ends_at' => $break->ends_at]),
            ];
        });

        return $this->respond($actor, $items, $this->pagination($rows) + ['timezone' => $this->timezone($workplace)], [$workplace->id]);
    }

    public function slots(Request $request, string $workplaceId)
    {
        $actor = $this->actor($request);
        $data = $this->filters($request, [
            'from' => ['required_with:to', 'date_format:Y-m-d'],
            'to' => ['required_with:from', 'date_format:Y-m-d'],
            'state' => ['sometimes', Rule::in(['active', 'inactive', 'all'])],
            'checkup_id' => ['sometimes', 'integer', 'min:1'],
            'rule_id' => ['sometimes', 'integer', 'min:1'],
            'conflict' => ['sometimes', Rule::in(['blocking', 'unblocked'])],
            'history' => ['sometimes', Rule::in(['with', 'without'])],
            'timing' => ['sometimes', Rule::in(['past', 'future', 'all'])],
        ]);
        $workplace = $this->workplace($actor, $workplaceId);
        $timezone = $this->timezone($workplace);
        $clock = CarbonImmutable::now();
        $from = isset($data['from']) ? CarbonImmutable::createFromFormat('!Y-m-d', $data['from'], $timezone) : $clock->setTimezone($timezone)->startOfDay();
        $to = isset($data['to']) ? CarbonImmutable::createFromFormat('!Y-m-d', $data['to'], $timezone) : $from->addDays(6);
        if ($to->lessThan($from) || $from->diffInDays($to) > 30) {
            throw ValidationException::withMessages(['to' => 'Choose an ordered range of at most 31 local calendar days.']);
        }
        $query = DoctorVisitSlot::query()->where('doctor_workplace_id', $workplace->id)
            ->with(['checkup' => fn ($service) => $service->withTrashed()->select(['id', 'public_id', 'title', 'is_active', 'deleted_at']),
                'workingWindow:id,public_id,doctor_workplace_id,checkup_id,is_active'])
            ->withCount('reservations')->where('doctor_visit_slots.starts_at', '>=', $from->utc())->where('doctor_visit_slots.starts_at', '<', $to->addDay()->startOfDay()->utc());
        $conflicts = Reservation::query()->blocking()->selectRaw('1')
            ->where('doctor_profile_id', $workplace->doctor_profile_id)
            ->whereColumn('reservations.starts_at', '<', 'doctor_visit_slots.ends_at')
            ->whereColumn('reservations.ends_at', '>', 'doctor_visit_slots.starts_at');
        $query->selectSub($conflicts->clone()->limit(1), 'blocking_reservation');
        $history = DB::table('reservation_schedule_changes')->selectRaw('1')
            ->where(fn ($q) => $q->whereColumn('previous_doctor_visit_slot_id', 'doctor_visit_slots.id')->orWhereColumn('new_doctor_visit_slot_id', 'doctor_visit_slots.id'));
        $query->selectSub($history->clone()->limit(1), 'reschedule_history');
        if (isset($data['conflict'])) {
            $query->whereExists($conflicts->toBase(), 'and', $data['conflict'] === 'unblocked');
        }
        $this->activeFilter($query, $data);
        foreach (['checkup_id' => 'checkup_id', 'rule_id' => 'doctor_working_window_id'] as $key => $column) {
            if (isset($data[$key])) {
                $query->where('doctor_visit_slots.'.$column, $data[$key]);
            }
        }
        if (isset($data['history'])) {
            if ($data['history'] === 'with') {
                $query->where(fn ($q) => $q->has('reservations')->orWhereExists($history->clone()));
            } else {
                $query->doesntHave('reservations')->whereNotExists($history->clone());
            }
        }
        if (($data['timing'] ?? 'all') !== 'all') {
            $query->where('doctor_visit_slots.starts_at', $data['timing'] === 'future' ? '>' : '<=', $clock);
        }
        $rows = $query->orderBy('doctor_visit_slots.starts_at')->orderBy('doctor_visit_slots.id')->paginate($data['per_page'] ?? 20);
        $items = $rows->getCollection()->map(fn (DoctorVisitSlot $row) => [
            'public_id' => (string) $row->public_id, 'starts_at' => $row->starts_at->copy()->setTimezone($timezone)->toIso8601String(),
            'ends_at' => $row->ends_at->copy()->setTimezone($timezone)->toIso8601String(),
            'duration_minutes' => (int) $row->starts_at->diffInMinutes($row->ends_at),
            'price' => (string) $row->price, 'currency' => $row->currency, 'is_active' => (bool) $row->is_active,
            'checkup' => $row->checkup ? $this->checkupData($row->checkup) : null,
            'rule' => $row->workingWindow ? ['id' => (int) $row->workingWindow->id, 'public_id' => (string) $row->workingWindow->public_id, 'is_active' => (bool) $row->workingWindow->is_active] : null,
            'binding_consistent' => $row->workingWindow && $row->workingWindow->doctor_workplace_id === $workplace->id && $row->workingWindow->checkup_id === $row->checkup_id,
            'is_future' => $row->starts_at->greaterThan($clock), 'blocking_reservation' => (bool) $row->blocking_reservation,
            'has_reservation_history' => $row->reservations_count > 0 || (bool) $row->reschedule_history,
        ]);

        return $this->respond($actor, $items, $this->pagination($rows) + ['period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'timezone' => $timezone]], [$workplace->id]);
    }

    private function workplaces(User $actor): Builder
    {
        return DoctorWorkplace::query()->select(['id', 'public_id', 'doctor_profile_id', 'marketplace_hospital_id', 'display_name', 'is_active', 'archived_at', 'created_at', 'updated_at'])
            ->whereHas('doctorProfile', fn ($doctor) => $doctor->withTrashed()->whereHas('user', fn ($user) => $user->where(fn ($visible) => $visible->where('users.id', $actor->id)->orWhereDoesntHave('roles', fn ($role) => $role->whereIn('name', ['admin', 'root-admin'])))))
            ->with(['doctorProfile' => fn ($doctor) => $doctor->withTrashed()->select(['id', 'public_id', 'user_id', 'verified', 'fee', 'deleted_at'])->with('user:id,public_id,name,account_state'),
                'hospital:id,public_id,name,timezone,is_active,archived_at'])
            ->withCount(['checkups as services_count' => fn ($service) => $service->withTrashed(), 'workingWindows', 'workingWindows as active_rules_count' => fn ($rule) => $rule->where('is_active', true), 'visitSlots']);
    }

    private function workplace(User $actor, string $id): DoctorWorkplace
    {
        $key = validator(['id' => $id], ['id' => ['required', 'integer', 'min:1']])->validate()['id'];

        return $this->workplaces($actor)->findOrFail($key);
    }

    private function workplaceData(DoctorWorkplace $row): array
    {
        $doctor = $row->doctorProfile;
        $hospital = $row->hospital;

        return ['id' => (int) $row->id, 'public_id' => (string) $row->public_id, 'display_name' => $row->display_name,
            'is_active' => (bool) $row->is_active, 'state' => $row->archived_at ? 'archived' : ($row->is_active ? 'active' : 'inactive'),
            'archived_at' => $row->archived_at?->toISOString(),
            'doctor' => $doctor ? ['id' => (int) $doctor->id, 'public_id' => (string) $doctor->public_id, 'user_public_id' => (string) $doctor->user->public_id, 'name' => $doctor->user->name, 'verified' => (bool) $doctor->verified, 'account_active' => $doctor->user->permitsAuthentication(), 'archived' => $doctor->trashed()] : null,
            'hospital' => $hospital ? ['id' => (int) $hospital->id, 'public_id' => (string) $hospital->public_id, 'name' => $hospital->name, 'timezone' => $hospital->timezone, 'is_active' => (bool) $hospital->is_active, 'archived' => $hospital->archived_at !== null] : null,
            'counts' => ['services' => (int) $row->services_count, 'rules' => (int) $row->working_windows_count, 'active_rules' => (int) $row->active_rules_count, 'slots' => (int) $row->visit_slots_count],
            'created_at' => $row->created_at?->toISOString(), 'updated_at' => $row->updated_at?->toISOString(),
        ];
    }

    private function checkupData(Checkup $row): array
    {
        return ['id' => (int) $row->id, 'public_id' => (string) $row->public_id, 'title' => $row->title, 'is_active' => (bool) $row->is_active, 'archived' => $row->trashed()];
    }

    private function activeFilter($query, array $data): void
    {
        if (($data['state'] ?? 'all') !== 'all') {
            $query->where('is_active', $data['state'] === 'active');
        }
    }

    private function timezone(DoctorWorkplace $row): string
    {
        $timezone = $row->hospital?->timezone;
        abort_unless(is_string($timezone) && in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true), 503, 'Hospital timezone is unavailable.');

        return $timezone;
    }

    private function filters(Request $request, array $extra): array
    {
        $rules = ['page' => ['sometimes', 'integer', 'between:1,1000'], 'per_page' => ['sometimes', 'integer', 'between:1,100']] + $extra;
        if (array_diff(array_keys($request->query()), array_keys($rules))) {
            throw ValidationException::withMessages(['filters' => 'Unsupported schedule filter.']);
        }

        return $request->validate($rules);
    }

    private function actor(Request $request): User
    {
        $actor = User::with('roles')->findOrFail($request->user()->id);
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function respond(User $actor, mixed $data, array $meta = [], array $workplaceIds = [])
    {
        $current = User::with('roles')->find($actor->id);
        abort_unless($current?->permitsAuthentication() && $current->canAccessAdminPanel() && $current->roles->pluck('name')->sort()->values()->all() === $actor->roles->pluck('name')->sort()->values()->all(), 403);
        abort_unless($this->workplaces($current)->whereKey($workplaceIds)->count() === count(array_unique($workplaceIds)), 403);

        return $this->successResponse(data: $data, meta: $meta + ['generated_at' => now()->toISOString(), 'read_only' => true])->header('Cache-Control', 'no-store, private');
    }

    private function pagination($rows): array
    {
        return ['pagination' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'per_page' => $rows->perPage(), 'total' => $rows->total()]];
    }
}
