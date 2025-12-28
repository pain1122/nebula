<?php

namespace App\Http\Controllers\Api;

use App\Models\UserProfile;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserProfileController extends ApiController
{
    /**
     * GET /api/auth/profile
     */
    public function show(Request $request)
    {
        $user = $request->user()->load('profile');

        /** @var UserProfile|null $profile */
        $profile = $user->profile;

        return $this->successResponse(
            data: [
                'user' => [
                    // اگر formatUser شما همین‌ها را برمی‌گرداند، می‌توانی فقط همان را نگه داری
                    // ولی من صریحاً فیلدهای جدید را هم اضافه می‌کنم که مطمئن باشیم به فرانت می‌رسد
                    ...$this->formatUser($user),

                    'role'       => $user->role,
                    'first_name' => $user->first_name,
                    'last_name'  => $user->last_name,
                    'phone'      => $user->phone,
                    'email'      => $user->email,
                    'birth_date' => $user->birth_date?->format('Y-m-d'),
                    'NID'        => $user->NID,

                    'city'       => $user->city,
                    'country'    => $user->country,
                    'zip_code'   => $user->zip_code,
                    'bio'        => $user->bio,
                ],

                'profile' => $profile ? [
                    'blood_type'              => $profile->blood_type,
                    'allergies'               => $profile->allergies,
                    'chronic_diseases'        => $profile->chronic_diseases,
                    'emergency_contact_name'  => $profile->emergency_contact_name,
                    'emergency_contact_phone' => $profile->emergency_contact_phone,
                ] : null,
            ],
            message: 'User profile.'
        );
    }

    /**
     * PUT /api/auth/profile
     */
    public function update(Request $request)
    {
        $user = $request->user();

        // 1) validate user core fields (required)
        $userData = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],

            // اگر می‌خواهی شماره تلفن/کدملی در سیستم unique باشد:
            // در migration گفتی unique می‌شود، پس validation هم باید unique باشد و رکورد خودش exclude شود
            'phone' => [
                'required',
                'string',
                'max:30',
                Rule::unique('users', 'phone')->ignore($user->id),
            ],

            'birth_date' => ['required', 'date'],

            'NID' => [
                'required',
                'string',
                'size:10',
                Rule::unique('users', 'NID')->ignore($user->id),
            ],

            // optional user fields
            'city'     => ['nullable', 'string', 'max:120'],
            'country'  => ['nullable', 'string', 'max:120'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'bio'      => ['nullable', 'string', 'max:2000'],

            // role را در پروفایل کاربر عادی اجازه تغییر نمی‌دهیم
            // اگر لازم شد، یک endpoint ادمین جدا می‌زنیم
        ]);

        // 2) validate medical profile fields (nullable)
        $profileData = $request->validate([
            'blood_type'              => ['nullable', 'string', 'max:10'],
            'allergies'               => ['nullable', 'string', 'max:1000'],
            'chronic_diseases'        => ['nullable', 'string', 'max:1000'],
            'emergency_contact_name'  => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:50'],
        ]);

        // Update user table
        $user->fill($userData);
        $user->save();

        // Update or create user_profile
        /** @var UserProfile $profile */
        $profile = $user->profile ?? new UserProfile(['user_id' => $user->id]);
        $profile->fill($profileData);
        $profile->user_id = $user->id;
        $profile->save();

        $freshUser = $user->fresh()->load('profile');

        return $this->successResponse(
            data: [
                'user' => [
                    ...$this->formatUser($freshUser),
                    'role'       => $freshUser->role,
                    'first_name' => $freshUser->first_name,
                    'last_name'  => $freshUser->last_name,
                    'phone'      => $freshUser->phone,
                    'email'      => $freshUser->email,
                    'birth_date' => $freshUser->birth_date?->format('Y-m-d'),
                    'NID'        => $freshUser->NID,
                    'city'       => $freshUser->city,
                    'country'    => $freshUser->country,
                    'zip_code'   => $freshUser->zip_code,
                    'bio'        => $freshUser->bio,
                ],
                'profile' => $freshUser->profile,
            ],
            message: 'Profile updated successfully.'
        );
    }
}
