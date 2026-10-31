<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Services\PanelProfileService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PanelProfileController extends ApiController
{
    public function showSelf(Request $request, PanelProfileService $profiles)
    {
        return $this->respond($request, $request->user(), false, $profiles);
    }

    public function showSupport(Request $request, User $user, PanelProfileService $profiles)
    {
        return $this->respond($request, $user, true, $profiles);
    }

    public function updateSelf(Request $request, PanelProfileService $profiles)
    {
        return $this->save($request, $request->user(), false, $profiles);
    }

    public function updateSupport(Request $request, User $user, PanelProfileService $profiles)
    {
        return $this->save($request, $user, true, $profiles);
    }

    private function respond(Request $request, User $user, bool $support, PanelProfileService $profiles)
    {
        return $this->successResponse(data: $profiles->read($request->user(), $user, $support))
            ->header('Cache-Control', 'private, no-store');
    }

    private function save(Request $request, User $user, bool $support, PanelProfileService $profiles)
    {
        $profiles->authorize($request->user(), $user, $support);
        if (array_diff(array_keys($request->all()), ['first_name', 'last_name', 'reason', 'expected_revision'])) {
            throw ValidationException::withMessages(['profile' => 'Only display-name fields may be edited.']);
        }
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'reason' => ['required', 'string', 'max:1000'],
            'expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
        ]);
        $user = $profiles->update($request, $request->user(), $user, $support, $data);

        return $this->respond($request, $user, $support, $profiles);
    }
}
