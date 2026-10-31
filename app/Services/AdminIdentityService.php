<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class AdminIdentityService
{
    public function __construct(private readonly AuditLogger $auditLogger) {}

    /** @param array<string, mixed> $attributes */
    public function create(
        Request $request,
        User $actor,
        array $attributes,
        string $role,
        string $password,
        ?string $reason,
    ): User {
        $touchesAdminIdentity = $role === UserRole::Admin->value;

        if ($touchesAdminIdentity) {
            Gate::forUser($actor)->authorize('createAdminIdentity', User::class);
        }

        $reason = $this->normalizeReason($reason, $touchesAdminIdentity);

        return DB::transaction(function () use ($request, $actor, $attributes, $role, $password, $reason): User {
            $actor = User::with('roles')->lockForUpdate()->findOrFail($actor->id);
            abort_unless($actor->permitsAuthentication() && $actor->hasAnyRole(['admin', 'root-admin']), 403);
            abort_unless(in_array($role, UserRole::adminAssignableValues(), true), 422);
            if ($role === UserRole::Admin->value) {
                Gate::forUser($actor)->authorize('createAdminIdentity', User::class);
            }
            $user = new User;
            $user->fill($this->normalizePatientStatus($attributes, $role));
            $user->name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));
            $user->password = Hash::make($password);
            $user->save();
            $user->syncRoles([$role]);
            $user->load('roles');
            if ($role === UserRole::Doctor->value) {
                \App\Models\DoctorProfile::create(['user_id' => $user->id, 'verified' => false]);
            }

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'admin.user.created',
                subject: $user,
                riskLevel: 'critical',
                before: null,
                after: $this->snapshot($user),
                reason: $reason,
            );

            return $user->fresh()->load('roles');
        });
    }

    /** @param array<string, mixed> $attributes */
    public function update(
        Request $request,
        User $actor,
        User $target,
        array $attributes,
        string $role,
        ?string $reason,
        string $expectedRevision,
    ): User {
        $unknown = array_diff(array_keys($attributes), ['first_name', 'last_name', 'patient_status']);
        if (! in_array($role, UserRole::adminAssignableValues(), true)) {
            throw ValidationException::withMessages(['role' => 'This role cannot be assigned.']);
        }
        if ($unknown) {
            throw ValidationException::withMessages(['profile' => 'Private identity fields cannot be edited.']);
        }
        $touchesAdminIdentity = $target->hasAnyRole(UserRole::adminPanelValues())
            || $role === UserRole::Admin->value;

        if ($touchesAdminIdentity) {
            Gate::forUser($actor)->authorize('updateAdminIdentity', $target);
        }

        $reason = $this->normalizeReason($reason, true);

        return DB::transaction(function () use ($request, $actor, $target, $attributes, $role, $reason, $expectedRevision): User {
            $actor = User::query()->lockForUpdate()->findOrFail($actor->id);
            $lockedTarget = User::query()->lockForUpdate()->findOrFail($target->getKey());
            $lockedTarget->load('roles');
            abort_unless($actor->permitsAuthentication(), 403);
            $profiles = app(PanelProfileService::class);
            $profiles->authorize($actor, $lockedTarget, true);
            abort_unless(hash_equals($profiles->revision($lockedTarget), $expectedRevision), 409, 'Refresh the profile before editing.');
            $touchesAdminIdentity = $lockedTarget->hasAnyRole(UserRole::adminPanelValues())
                || $role === UserRole::Admin->value;

            if ($touchesAdminIdentity) {
                Gate::forUser($actor)->authorize('updateAdminIdentity', $lockedTarget);
            }

            $before = $this->snapshot($lockedTarget);
            $lockedTarget->fill($this->normalizePatientStatus($attributes, $role));
            $lockedTarget->name = trim(($lockedTarget->first_name ?? '').' '.($lockedTarget->last_name ?? ''));
            $lockedTarget->save();
            $lockedTarget->syncRoles([$role]);
            $lockedTarget->load('roles');

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'admin.user.updated',
                subject: $lockedTarget,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($lockedTarget),
                reason: $reason,
            );

            return $lockedTarget->fresh()->load('roles');
        });
    }

    private function normalizeReason(?string $reason, bool $required): ?string
    {
        $reason = trim((string) $reason);

        if ($required && $reason === '') {
            throw new InvalidArgumentException('An admin identity change reason is required.');
        }

        return $reason !== '' ? $reason : null;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function normalizePatientStatus(array $attributes, string $role): array
    {
        $attributes['patient_status'] = $role === UserRole::Patient->value
            ? ($attributes['patient_status'] ?? 'free')
            : null;

        return $attributes;
    }

    /** @return array<string, mixed> */
    private function snapshot(User $user): array
    {
        $user->loadMissing('roles');

        return [
            'id' => $user->id,
            'roles' => $user->roles->pluck('name')->values()->all(),
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'patient_status' => $user->patient_status,
        ];
    }
}
