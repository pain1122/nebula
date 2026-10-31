<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AccountState;
use App\Enums\UserRole;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use App\Rules\NotCommonPassword;
use App\Services\AccountStateService;
use App\Services\AdminIdentityService;
use App\Services\PanelProfileService;
use App\Support\QuerySorting;
use Carbon\Carbon;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserController extends ApiController
{
    public function staff(Request $request)
    {
        $actor = $this->staffActor($request);
        abort_if($request->has('role') && $request->query('role') !== UserRole::Admin->value, 422, 'Staff role cannot be overridden.');
        $staffRequest = $request->duplicate(query: [...$request->query(), 'role' => UserRole::Admin->value]);
        $staffRequest->setUserResolver(fn () => $actor);
        $response = $this->index($staffRequest, staffOnly: true);
        $fresh = $this->staffActor($request);
        abort_unless($actor->roles->pluck('name')->sort()->values()->all() === $fresh->roles->pluck('name')->sort()->values()->all(), 403);

        return $response;
    }

    private function staffActor(Request $request): User
    {
        abort_unless($request->user() instanceof User, 401);
        $actor = User::with('roles')->findOrFail($request->user()->id);
        abort_unless($actor->permitsAuthentication() && $actor->isRootAdmin(), 403);

        return $actor;
    }

    public function index(Request $request, bool $staffOnly = false)
    {
        $actor = $request->user();
        $q = $request->query('q');
        $role = $request->query('role');
        $range = $request->query('range', 'all'); // all|week|month|year

        if (
            $role === UserRole::RootAdmin->value
            || ($role === UserRole::Admin->value && ! $actor->isRootAdmin())
        ) {
            abort(403, 'This role is not accessible from admin user management.');
        }

        $request->validate([
            'q' => ['nullable', 'string', 'max:160'],
            'role' => ['nullable', Rule::in(['patient', 'doctor', 'admin'])],
            'range' => ['nullable', Rule::in(['all', 'week', 'month', 'year'])],
            'account_state' => ['nullable', Rule::in(AccountState::values())],
            'verification' => ['nullable', Rule::in(['verified', 'unverified', 'missing'])],
            'specialty_id' => ['nullable', 'integer', 'min:1'],
            'workplace_id' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        if ($role !== 'doctor' && collect(['verification', 'specialty_id', 'workplace_id'])->contains(fn ($key) => $request->filled($key))) {
            throw ValidationException::withMessages(['role' => ['Doctor filters require the doctor scope.']]);
        }

        $from = match ($range) {
            'week' => Carbon::now()->subDays(7),
            'month' => Carbon::now()->subDays(30),
            'year' => Carbon::now()->subDays(365),
            default => null,
        };

        $query = User::query()
            ->with(['roles', 'doctorProfile' => fn ($profile) => $profile
                ->select(['id', 'user_id', 'specialty_id', 'verified'])
                ->with('specialty:id,name')
                ->withCount(['workplaces as active_workplaces_count' => fn ($workplaces) => $workplaces->where('is_active', true)])])
            ->whereDoesntHave('roles', fn ($r) => $r->where('name', UserRole::RootAdmin->value))
            ->when($staffOnly, fn ($users) => $users->whereDoesntHave('roles', fn ($roles) => $roles->whereIn('name', ['doctor', 'patient'])))
            ->when(
                ! $actor->isRootAdmin(),
                fn ($users) => $users->whereDoesntHave(
                    'roles',
                    fn ($roles) => $roles->where('name', UserRole::Admin->value)
                )
            )
            ->when($q, function ($query) use ($q) {
                $query->where(function ($qq) use ($q) {
                    $qq->where('first_name', 'like', "%{$q}%")
                        ->orWhere('name', 'like', "%{$q}%")
                        ->orWhere('last_name', 'like', "%{$q}%")
                        ->orWhere('public_id', $q);
                });
            })
            ->when($role, function ($query) use ($role) {
                $query->whereHas('roles', fn ($r) => $r->where('name', $role));
            })
            ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
            ->when($request->filled('account_state'), fn ($query) => $query->where('account_state', $request->query('account_state')))
            ->when($request->filled('verification'), function ($query) use ($request): void {
                if ($request->query('verification') === 'missing') {
                    $query->whereDoesntHave('doctorProfile');
                } else {
                    $query->whereHas('doctorProfile', fn ($profile) => $profile->where('verified', $request->query('verification') === 'verified'));
                }
            })
            ->when($request->filled('specialty_id'), fn ($query) => $query->whereHas('doctorProfile', fn ($profile) => $profile
                ->where(function ($specialties) use ($request): void {
                    $specialties->where('specialty_id', $request->integer('specialty_id'))
                        ->orWhereHas('specialties', fn ($specialty) => $specialty->where('specialties.id', $request->integer('specialty_id')));
                })))
            ->when($request->filled('workplace_id'), fn ($query) => $query->whereHas('doctorProfile.workplaces', fn ($workplace) => $workplace->whereKey($request->integer('workplace_id'))));

        QuerySorting::apply($query, $request, [
            'id' => 'users.id',
            'name' => 'users.name',
            'first_name' => 'users.first_name',
            'last_name' => 'users.last_name',
            'patient_status' => 'users.patient_status',
            'account_state' => 'users.account_state',
            'created_at' => 'users.created_at',
        ], 'id', 'desc');
        $query->orderByDesc('users.id');

        $users = $query->paginate(max(1, min($request->integer('per_page', 20), 100)));

        return $this->successResponse(
            data: [
                'users' => AdminUserResource::collection($users->getCollection())->resolve($request),
            ],
            meta: [
                'pagination' => [
                    'current_page' => $users->currentPage(),
                    'last_page' => $users->lastPage(),
                    'per_page' => $users->perPage(),
                    'total' => $users->total(),
                ],
            ],
        )->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, User $user)
    {
        $this->assertCanManageAdminIdentity($request, $user);

        return $this->successResponse(data: [
            'user' => [
                ...(new AdminUserResource($user->loadMissing('roles')))->resolve($request),
                'revision' => app(PanelProfileService::class)->revision($user),
            ],
        ]);
    }

    public function store(Request $request, AdminIdentityService $adminIdentityService)
    {
        $requestedRole = $request->input('role');

        if ($requestedRole === UserRole::Admin->value) {
            Gate::authorize('createAdminIdentity', User::class);
        }

        $data = $request->validate([
            'role' => ['required', Rule::in(UserRole::adminAssignableValues())],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:30', 'unique:users,phone'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'birth_date' => ['required', 'date'],
            'NID' => ['required', 'string', 'size:10', 'unique:users,NID'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'patient_status' => ['nullable', Rule::in(['free', 'trial', 'active', 'expired', 'suspended'])],

            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(15)->max(64),
                new NotCommonPassword([
                    $request->input('email'),
                    $request->input('phone'),
                    $request->input('NID'),
                    $request->input('first_name'),
                    $request->input('last_name'),
                    'checkupino',
                ]),
            ],
            'reason' => [Rule::requiredIf($requestedRole === UserRole::Admin->value), 'nullable', 'string', 'max:1000'],
        ]);

        $role = $data['role'];
        $password = $data['password'];
        $reason = $data['reason'] ?? null;
        unset($data['role'], $data['password'], $data['reason']);

        $user = $adminIdentityService->create(
            request: $request,
            actor: $request->user(),
            attributes: $data,
            role: $role,
            password: $password,
            reason: $reason,
        );

        return $this->successResponse(
            data: ['user' => (new AdminUserResource($user))->resolve($request)],
            message: 'User created.',
        );
    }

    public function update(Request $request, User $user, AdminIdentityService $adminIdentityService)
    {
        $requestedRole = $request->input('role');
        $touchesAdminIdentity = $user->hasAnyRole(UserRole::adminPanelValues())
            || $requestedRole === UserRole::Admin->value;

        if ($touchesAdminIdentity) {
            Gate::authorize('updateAdminIdentity', $user);
        }

        $unknown = array_diff(array_keys($request->all()), ['role', 'first_name', 'last_name', 'patient_status', 'reason', 'expected_revision']);
        if ($unknown) {
            throw ValidationException::withMessages(array_fill_keys($unknown, 'This field cannot be edited by an administrator.'));
        }
        $data = $request->validate([
            'role' => ['required', Rule::in(UserRole::adminAssignableValues())],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'patient_status' => ['nullable', Rule::in(['free', 'trial', 'active', 'expired', 'suspended'])],
            'reason' => ['required', 'string', 'max:1000'],
            'expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
        ]);

        $role = $data['role'];
        $reason = $data['reason'] ?? null;
        $expectedRevision = $data['expected_revision'];
        unset(
            $data['role'],
            $data['reason'],
            $data['expected_revision'],
            $data['password'],
            $data['password_confirmation'],
        );

        $user = $adminIdentityService->update(
            request: $request,
            actor: $request->user(),
            target: $user,
            attributes: $data,
            role: $role,
            reason: $reason,
            expectedRevision: $expectedRevision,
        );

        return $this->successResponse(
            data: ['user' => (new AdminUserResource($user))->resolve($request)],
            message: 'User updated.',
        );
    }

    public function updateAccountState(
        Request $request,
        User $user,
        AccountStateService $accountStateService
    ) {
        Gate::authorize('changeAccountState', $user);

        $data = $request->validate([
            'account_state' => ['required', Rule::enum(AccountState::class)],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $user = $accountStateService->change(
                request: $request,
                actor: $request->user(),
                target: $user,
                newState: AccountState::from($data['account_state']),
                reason: $data['reason'],
            );
        } catch (DomainException $exception) {
            throw ValidationException::withMessages([
                'account_state' => $exception->getMessage(),
            ]);
        }

        return $this->successResponse(
            data: [
                'user' => [
                    'id' => $user->id,
                    'account_state' => $user->account_state->value,
                    'account_state_changed_at' => $user->account_state_changed_at?->toISOString(),
                    'account_state_changed_by' => $user->account_state_changed_by,
                    'account_state_reason' => $user->account_state_reason,
                    'closed_at' => $user->closed_at?->toISOString(),
                ],
            ],
            message: 'Account state updated.',
        );
    }

    private function assertCanManageAdminIdentity(
        Request $request,
        ?User $subject = null,
        ?string $requestedRole = null
    ): void {
        $actor = $request->user();

        if ($subject?->isRootAdmin()) {
            abort(403, 'Root-admin identities are not accessible from admin user management.');
        }

        $touchesAdminIdentity = $subject?->hasRole(UserRole::Admin->value)
            || $requestedRole === UserRole::Admin->value;

        if ($touchesAdminIdentity && ! $actor->isRootAdmin()) {
            abort(403, 'Only root-admin may manage marketplace admin identities.');
        }
    }
}
