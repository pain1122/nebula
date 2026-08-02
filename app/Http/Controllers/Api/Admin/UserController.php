<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AccountState;
use App\Enums\UserRole;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use App\Services\AccountStateService;
use App\Services\AuditLogger;
use App\Support\QuerySorting;
use Carbon\Carbon;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends ApiController
{
    public function index(Request $request)
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

        $from = match ($range) {
            'week' => Carbon::now()->subDays(7),
            'month' => Carbon::now()->subDays(30),
            'year' => Carbon::now()->subDays(365),
            default => null,
        };

        $query = User::query()
            ->with('roles')
            ->whereDoesntHave('roles', fn ($r) => $r->where('name', UserRole::RootAdmin->value))
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
                        ->orWhere('last_name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%")
                        ->orWhere('phone', 'like', "%{$q}%")
                        ->orWhere('NID', 'like', "%{$q}%");
                });
            })
            ->when($role, function ($query) use ($role) {
                $query->whereHas('roles', fn ($r) => $r->where('name', $role));
            })
            ->when($from, fn ($query) => $query->where('created_at', '>=', $from));

        QuerySorting::apply($query, $request, [
            'id' => 'users.id',
            'name' => 'users.name',
            'first_name' => 'users.first_name',
            'last_name' => 'users.last_name',
            'email' => 'users.email',
            'phone' => 'users.phone',
            'patient_status' => 'users.patient_status',
            'created_at' => 'users.created_at',
        ], 'id', 'desc');

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
        );
    }

    public function show(Request $request, User $user)
    {
        $this->assertCanManageAdminIdentity($request, $user);

        return $this->successResponse(data: [
            'user' => (new AdminUserResource($user->loadMissing('roles')))->resolve($request),
        ]);
    }

    public function store(Request $request, AuditLogger $auditLogger)
    {
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

            // می‌تونی موقتاً اجباری نگیری و auto بسازی
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $password = $data['password'] ?? 'TempPass123!'; // موقت (بعداً ریست پسورد)
        unset($data['password']);

        $role = $data['role'];
        unset($data['role']);

        $this->assertCanManageAdminIdentity($request, requestedRole: $role);

        if ($role === UserRole::Patient->value) {
            $data['patient_status'] = $data['patient_status'] ?? 'free';
        } else {
            $data['patient_status'] = null;
        }

        $user = DB::transaction(function () use ($request, $auditLogger, $data, $password, $role) {
            $user = new User;
            $user->fill($data);

            // برای سازگاری با formatUser قدیمی
            $user->name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));

            $user->password = Hash::make($password);
            $user->save();

            // spatie role assignment
            $user->syncRoles([$role]);
            $user->load('roles');

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.user.created',
                subject: $user,
                riskLevel: 'critical',
                before: null,
                after: $this->auditedUserSnapshot($user),
            );

            return $user->fresh()->load('roles');
        });

        return $this->successResponse(
            data: ['user' => (new AdminUserResource($user))->resolve($request)],
            message: 'User created.',
        );
    }

    public function update(Request $request, User $user, AuditLogger $auditLogger)
    {
        $this->assertCanManageAdminIdentity($request, $user);

        $data = $request->validate([
            'role' => ['required', Rule::in(UserRole::adminAssignableValues())],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:30', Rule::unique('users', 'phone')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'birth_date' => ['required', 'date'],
            'NID' => ['required', 'string', 'size:10', Rule::unique('users', 'NID')->ignore($user->id)],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'patient_status' => ['nullable', Rule::in(['free', 'trial', 'active', 'expired', 'suspended'])],

        ]);

        $role = $data['role'];
        unset($data['role']);

        $this->assertCanManageAdminIdentity($request, $user, $role);

        if ($role === UserRole::Patient->value) {
            $data['patient_status'] = $data['patient_status'] ?? 'free';
        } else {
            $data['patient_status'] = null;
        }

        $user = DB::transaction(function () use ($request, $auditLogger, $user, $data, $role) {
            $user->load('roles');
            $before = $this->auditedUserSnapshot($user);

            $user->fill($data);
            $user->name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));
            $user->save();
            $user->syncRoles([$role]);
            $user->load('roles');

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.user.updated',
                subject: $user,
                riskLevel: 'critical',
                before: $before,
                after: $this->auditedUserSnapshot($user),
            );

            return $user->fresh()->load('roles');
        });

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

    /**
     * @return array<string, mixed>
     */
    private function auditedUserSnapshot(User $user): array
    {
        $user->loadMissing('roles');

        return [
            'id' => $user->id,
            'roles' => $user->roles->pluck('name')->values()->all(),
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'birth_date' => $user->birth_date?->format('Y-m-d'),
            'NID' => $user->NID,
            'city' => $user->city,
            'country' => $user->country,
            'zip_code' => $user->zip_code,
            'bio' => $user->bio,
            'patient_status' => $user->patient_status,
        ];
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
