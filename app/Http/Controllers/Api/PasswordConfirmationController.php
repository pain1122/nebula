<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class PasswordConfirmationController extends ApiController
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! $request->hasSession()) {
            return $this->errorResponse(
                message: 'Session-backed authentication is required for password confirmation.',
                status: 409,
                errors: ['session' => ['required']]
            );
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return $this->errorResponse(
                message: 'Invalid password.',
                status: 422,
                errors: ['password' => ['invalid']]
            );
        }

        $request->session()->put('auth.password_confirmed_at', time());

        $timeout = (int) config('auth.high_authority_password_timeout', 900);

        return $this->successResponse(
            data: [
                'confirmed_at' => now()->toISOString(),
                'expires_at' => now()->addSeconds($timeout)->toISOString(),
            ],
            message: 'Password confirmed.'
        );
    }
}
