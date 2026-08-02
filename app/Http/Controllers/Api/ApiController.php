<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ApiController extends Controller
{
    /** @param array<string, mixed> $meta */
    protected function successResponse(
        mixed $data = null,
        ?string $message = null,
        int $status = 200,
        array $meta = [],
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => array_merge($meta, $this->responseMeta()),
        ], $status);
    }

    protected function errorResponse(
        string $message,
        int $status = 400,
        ?array $errors = null,
        ?string $code = null,
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => $code ?? $this->defaultErrorCode($status),
            'errors' => $errors,
            'meta' => $this->responseMeta(),
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
            'id' => $user->id,
            'public_id' => $user->public_id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name'),
            'doctor_profile' => $user->doctorProfile ? [
                'id' => $user->doctorProfile->id,
                'public_id' => $user->doctorProfile->public_id,
                'specialty' => $user->doctorProfile->specialty?->name,
                'fee' => $user->doctorProfile->fee,
                'verified' => (bool) $user->doctorProfile->verified,
            ] : null,
        ];
    }

    /** @return array{api_version: string, correlation_id: mixed} */
    private function responseMeta(): array
    {
        return [
            'api_version' => '1',
            'correlation_id' => request()->attributes->get('correlation_id'),
        ];
    }

    private function defaultErrorCode(int $status): string
    {
        return match ($status) {
            400 => 'bad_request',
            401 => 'unauthenticated',
            403 => 'forbidden',
            404 => 'not_found',
            409 => 'conflict',
            422 => 'validation_failed',
            423 => 'recent_password_required',
            429 => 'rate_limited',
            default => 'request_failed',
        };
    }
}
