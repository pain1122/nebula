<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ApiController extends Controller
{
    protected function successResponse(mixed $data = null, ?string $message = null, int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    protected function errorResponse(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors,
        ], $status);
    }

    /**
     * فرمت مشترک یوزر برای /api/me و auth
     */
    protected function formatUser(User $user): array
    {
        $user->loadMissing([
            'roles:id,name',
            'doctorProfile.specialty:id,name',
        ]);

        return [
            'id'    => $user->id,
            'name'  => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name'),
            'doctor_profile' => $user->doctorProfile ? [
                'id'        => $user->doctorProfile->id,
                'specialty' => $user->doctorProfile->specialty?->name,
                'fee'       => $user->doctorProfile->fee,
                'verified'  => (bool) $user->doctorProfile->verified,
            ] : null,
        ];
    }
}
