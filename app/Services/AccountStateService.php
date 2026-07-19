<?php

namespace App\Services;

use App\Enums\AccountState;
use App\Models\User;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class AccountStateService
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
        private readonly BrowserSessionRevoker $browserSessionRevoker,
    ) {}

    public function change(
        Request $request,
        User $actor,
        User $target,
        AccountState $newState,
        string $reason
    ): User {
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('An account-state change reason is required.');
        }

        return DB::transaction(function () use ($request, $actor, $target, $newState, $reason): User {
            $lockedTarget = User::query()->lockForUpdate()->findOrFail($target->getKey());
            $currentState = $lockedTarget->account_state;

            if (! $currentState->canTransitionTo($newState)) {
                throw new DomainException(sprintf(
                    'Account state cannot transition from %s to %s.',
                    $currentState->value,
                    $newState->value
                ));
            }

            $before = $this->snapshot($lockedTarget);

            $lockedTarget->forceFill([
                'account_state' => $newState,
                'account_state_changed_at' => now(),
                'account_state_changed_by' => $actor->getKey(),
                'account_state_reason' => $reason,
                'closed_at' => $newState === AccountState::Closed ? now() : null,
            ])->save();

            if (! $newState->permitsAuthentication()) {
                $lockedTarget->tokens()->delete();
                $this->browserSessionRevoker->revokeAll($lockedTarget);
            }

            $this->auditLogger->log(
                request: $request,
                actor: $actor,
                action: 'admin.user.account_state.changed',
                subject: $lockedTarget,
                riskLevel: 'critical',
                before: $before,
                after: $this->snapshot($lockedTarget),
                reason: $reason,
            );

            return $lockedTarget->fresh();
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(User $user): array
    {
        return [
            'account_state' => $user->account_state->value,
            'account_state_changed_at' => $user->account_state_changed_at?->toISOString(),
            'account_state_changed_by' => $user->account_state_changed_by,
            'closed_at' => $user->closed_at?->toISOString(),
        ];
    }
}
