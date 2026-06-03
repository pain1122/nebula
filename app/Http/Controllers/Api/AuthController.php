<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\DoctorProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends ApiController
{
    /**
     * Backward-compatible patient registration endpoint used by routes/api.php.
     */
    public function registerPatient(Request $request)
    {
        return $this->register($request, UserRole::Patient->value);
    }

    /**
     * Generic registration helper.
     */
    public function register(Request $request, string $defaultRole = UserRole::Patient->value)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:users,phone'],
            'birth_date' => ['nullable', 'date'],
            'NID' => ['nullable', 'string', 'size:10', 'unique:users,NID'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        [$derivedFirstName, $derivedLastName] = $this->splitName($data['name']);

        $user = User::create([
            'name' => $data['name'],
            'first_name' => $data['first_name'] ?? $derivedFirstName,
            'last_name' => $data['last_name'] ?? $derivedLastName,
            'phone' => $data['phone'] ?? $this->generateUniquePhone(),
            'birth_date' => $data['birth_date'] ?? now()->subYears(18)->toDateString(),
            'NID' => $data['NID'] ?? $this->generateUniqueNid(),
            'patient_status' => 'free',
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        if (method_exists($user, 'assignRole')) {
            $user->assignRole($defaultRole);
        }

        $tokenName = $data['device_name'] ?? 'pwa';
        $token = $user->createToken($tokenName)->plainTextToken;

        return $this->successResponse(
            data: [
                'token' => $token,
                'user' => $this->formatUser($user),
            ],
            message: 'Registered successfully.',
            status: 201
        );
    }


    /**
     * POST /api/auth/register/doctor
     * ثبت‌نام دکتر (در انتظار تأیید ادمین)
     */
    public function registerDoctor(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:users,phone'],
            'birth_date' => ['nullable', 'date'],
            'NID' => ['nullable', 'string', 'size:10', 'unique:users,NID'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'device_name' => ['nullable', 'string', 'max:100'],

            'specialty_id' => ['required', 'exists:specialties,id'],
            'fee' => ['required', 'integer', 'min:0'],
            'bio' => ['nullable', 'string'],
            'experience_years' => ['nullable', 'integer', 'min:0'],
        ]);

        [$derivedFirstName, $derivedLastName] = $this->splitName($data['name']);

        $user = User::create([
            'name' => $data['name'],
            'first_name' => $data['first_name'] ?? $derivedFirstName,
            'last_name' => $data['last_name'] ?? $derivedLastName,
            'phone' => $data['phone'] ?? $this->generateUniquePhone(),
            'birth_date' => $data['birth_date'] ?? now()->subYears(18)->toDateString(),
            'NID' => $data['NID'] ?? $this->generateUniqueNid(),
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        if (method_exists($user, 'assignRole')) {
            $user->assignRole(UserRole::Doctor->value);
        }

        $doctorProfile = DoctorProfile::create([
            'user_id' => $user->id,
            'specialty_id' => $data['specialty_id'],
            'fee' => $data['fee'],
            'bio' => $data['bio'] ?? null,
            'experience_years' => $data['experience_years'] ?? null,
            'verified' => false, // بعداً ادمین تأیید می‌کند
        ]);

        $tokenName = $data['device_name'] ?? 'pwa';
        $token = $user->createToken($tokenName)->plainTextToken;

        return $this->successResponse(
            data: [
                'token' => $token,
                'user' => $this->formatUser($user),
                'doctor_profile' => [
                    'id' => $doctorProfile->id,
                    'fee' => $doctorProfile->fee,
                    'verified' => (bool) $doctorProfile->verified,
                ],
            ],
            message: 'Doctor registered. Waiting for admin approval.',
            status: 201
        );
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            return $this->errorResponse(
                message: 'Invalid credentials',
                status: 401
            );
        }

        $tokenName = $data['device_name'] ?? 'pwa';
        $token = $user->createToken($tokenName)->plainTextToken;

        return $this->successResponse(
            data: [
                'token' => $token,
                'user' => $this->formatUser($user),
            ],
            message: 'Logged in successfully.'
        );
    }

    public function refresh(Request $request)
    {
        $data = $request->validate([
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->user();
        $tokenName = $data['device_name'] ?? 'pwa';

        $request->user()->currentAccessToken()?->delete();
        $token = $user->createToken($tokenName)->plainTextToken;

        return $this->successResponse(
            data: [
                'token' => $token,
                'user' => $this->formatUser($user),
            ],
            message: 'Token refreshed successfully.'
        );
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->successResponse(
            data: null,
            message: 'Logged out successfully.'
        );
    }

    private function splitName(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $first = $parts[0] ?? 'User';
        $last = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : 'User';

        return [$first, $last];
    }

    private function generateUniquePhone(): string
    {
        do {
            $candidate = '09' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        } while (User::where('phone', $candidate)->exists());

        return $candidate;
    }

    private function generateUniqueNid(): string
    {
        do {
            $candidate = str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        } while (User::where('NID', $candidate)->exists());

        return $candidate;
    }
}
