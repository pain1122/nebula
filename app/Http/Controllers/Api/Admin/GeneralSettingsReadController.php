<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\User;
use App\Services\GeneralMarketplaceSettings;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GeneralSettingsReadController extends ApiController
{
    public function index(Request $request, GeneralMarketplaceSettings $settings)
    {
        $actor = $this->actor($request);
        abort_if(array_diff(array_keys($request->query()), ['scope_type']), 422, 'Unsupported settings filters.');
        $input = validator($request->query(), ['scope_type' => ['sometimes', Rule::in(['platform', 'site'])]])->validate();
        $scope = $input['scope_type'] ?? 'platform';
        $snapshot = $settings->capture($scope);
        $verify = $settings->capture($scope);
        abort_unless(hash_equals($this->digest($snapshot['binding']), $this->digest($verify['binding'])), 409, 'Settings changed; refresh before continuing.');
        $fresh = $this->actor($request);
        abort_unless($actor->roles->pluck('name')->sort()->values()->all() === $fresh->roles->pluck('name')->sort()->values()->all(), 403);

        return $this->successResponse(data: ['settings' => $snapshot['settings']], meta: [
            'read_only' => true, 'managed_scopes' => ['platform', 'site'], 'scope_type' => $scope,
            'revision' => $settings->revision($actor, $snapshot),
            'write_controls_ready' => true, 'runtime_binding_ready' => true, 'generated_at' => now()->toISOString(),
        ])->header('Cache-Control', 'no-store, private');
    }

    private function actor(Request $request): User
    {
        abort_unless($request->user() instanceof User, 401);
        $actor = User::with('roles')->findOrFail($request->user()->id);
        abort_unless($actor->permitsAuthentication() && $actor->isRootAdmin(), 403);

        return $actor;
    }

    private function digest(array $state): string
    {
        return hash_hmac('sha256', json_encode($state, JSON_THROW_ON_ERROR), (string) config('app.key'));
    }
}
