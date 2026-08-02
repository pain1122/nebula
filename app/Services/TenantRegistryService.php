<?php

namespace App\Services;

use App\Models\TenantInstance;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class TenantRegistryService
{
    private const MUTABLE_FIELDS = [
        'display_name',
        'domain',
        'state',
        'plan_key',
        'subscription_status',
        'feature_set_version',
    ];

    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array<string, mixed>  $changes
     */
    public function update(
        Request $request,
        User $actor,
        TenantInstance $tenantInstance,
        array $changes,
        string $reason,
    ): TenantInstance {
        Gate::forUser($actor)->authorize('update', $tenantInstance);

        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A tenant registry change reason is required.');
        }

        $unknownFields = array_diff(array_keys($changes), self::MUTABLE_FIELDS);

        if ($unknownFields !== []) {
            throw ValidationException::withMessages([
                'changes' => 'Unsupported tenant registry fields: '.implode(', ', $unknownFields).'.',
            ]);
        }

        if ($changes === []) {
            throw ValidationException::withMessages([
                'changes' => 'At least one tenant registry field is required.',
            ]);
        }

        $validated = Validator::make($changes, [
            'display_name' => ['sometimes', 'required', 'string', 'max:255'],
            'domain' => [
                'sometimes',
                'required',
                'string',
                'max:191',
                'lowercase',
                'regex:/^(?!https?:\/\/)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/',
                Rule::unique('tenant_instances', 'domain')->ignore($tenantInstance->getKey()),
            ],
            'state' => ['sometimes', 'required', Rule::in(['active', 'disabled'])],
            'plan_key' => ['sometimes', 'nullable', 'string', 'max:100', 'regex:/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/'],
            'subscription_status' => [
                'sometimes',
                'nullable',
                Rule::in(['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired']),
            ],
            'feature_set_version' => ['sometimes', 'nullable', 'string', 'max:100'],
        ])->validate();

        return DB::transaction(function () use ($request, $actor, $tenantInstance, $validated, $reason): TenantInstance {
            $lockedTenant = TenantInstance::query()->lockForUpdate()->findOrFail($tenantInstance->getKey());
            $before = $this->snapshot($lockedTenant);

            $lockedTenant->forceFill($validated)->save();

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'tenant.registry.updated',
                subject: $lockedTenant,
                riskLevel: 'high',
                before: $before,
                after: $this->snapshot($lockedTenant),
                reason: $reason,
            );

            return $lockedTenant->fresh();
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(TenantInstance $tenantInstance): array
    {
        return $tenantInstance->only(self::MUTABLE_FIELDS);
    }
}
