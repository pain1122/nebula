<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\DoctorProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends ApiController
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        if (method_exists($user, 'assignRole')) {
            $user->assignRole('user');
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
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'device_name' => ['nullable', 'string', 'max:100'],

            'specialty_id' => ['required', 'exists:specialties,id'],
            'fee' => ['required', 'integer', 'min:0'],
            'bio' => ['nullable', 'string'],
            'experience_years' => ['nullable', 'integer', 'min:0'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        if (method_exists($user, 'assignRole')) {
            $user->assignRole('doctor');
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

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->successResponse(
            data: null,
            message: 'Logged out successfully.'
        );
    }
}
