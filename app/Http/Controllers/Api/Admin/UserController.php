<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\User;
use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class UserController extends ApiController
{

    public function index(Request $request)
    {
        $q = $request->query('q');
        $role = $request->query('role');
        $range = $request->query('range', 'all'); // all|week|month|year

        if ($role === UserRole::RootAdmin->value) {
            abort(403, 'Root admin users are not accessible from admin user management.');
        }

        $from = match ($range) {
            'week' => Carbon::now()->subDays(7),
            'month' => Carbon::now()->subDays(30),
            'year' => Carbon::now()->subDays(365),
            default => null,
        };

        $users = User::query()
            ->with('roles')
            ->whereDoesntHave('roles', fn($r) => $r->where('name', UserRole::RootAdmin->value))
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
                $query->whereHas('roles', fn($r) => $r->where('name', $role));
            })
            ->when($from, fn($query) => $query->where('created_at', '>=', $from))
            ->latest('id')
            ->get()
            ->map(function (User $u) {
                return [
                    'id' => $u->id,
                    'role' => $u->roles->pluck('name')->first(),
                    'first_name' => $u->first_name,
                    'last_name' => $u->last_name,
                    'name' => $u->name,
                    'email' => $u->email,
                    'phone' => $u->phone,
                    'birth_date' => $u->birth_date?->format('Y-m-d'),
                    'NID' => $u->NID,
                    'city' => $u->city,
                    'country' => $u->country,
                    'zip_code' => $u->zip_code,
                    'bio' => $u->bio,
                    'patient_status' => $u->patient_status,
                    'created_at' => optional($u->created_at)->toISOString(),
                ];
            });

        return $this->successResponse(data: ['users' => $users]);
    }

    public function show(User $user)
    {
        if ($user->isRootAdmin()) {
            abort(403, 'Root admin users are not accessible from admin user management.');
        }

        return $this->successResponse(data: [
            'user' => [
                'id' => $user->id,
                'role' => $user->roles->pluck('name')->first(), // spatie
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'phone' => $user->phone,
                'email' => $user->email,
                'birth_date' => $user->birth_date?->format('Y-m-d'),
                'NID' => $user->NID,
                'city' => $user->city,
                'country' => $user->country,
                'zip_code' => $user->zip_code,
                'bio' => $user->bio,
                'patient_status' => $user->patient_status,
            ],
        ]);
    }

    public function store(Request $request)
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

        $user = new User();
        $role = $data['role'];
        unset($data['role']);

        if ($role === UserRole::Patient->value) {
            $data['patient_status'] = $data['patient_status'] ?? 'free';
        } else {
            $data['patient_status'] = null;
        }

        $user->fill($data);

        // برای سازگاری با formatUser قدیمی
        $user->name = trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''));

        $user->password = Hash::make($password);
        $user->save();

        // spatie role assignment
        $user->syncRoles([$role]);

        return $this->successResponse(data: ['user' => $user], message: 'User created.');
    }

    public function update(Request $request, User $user)
    {
        if ($user->isRootAdmin()) {
            abort(403, 'Root admin users are not accessible from admin user management.');
        }

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

        if ($role === UserRole::Patient->value) {
            $data['patient_status'] = $data['patient_status'] ?? 'free';
        } else {
            $data['patient_status'] = null;
        }

        $user->fill($data);
        $user->name = trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''));
        $user->save();

        $user->syncRoles([$role]);

        return $this->successResponse(data: ['user' => $user], message: 'User updated.');
    }
}
