<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Passport\HasApiTokens;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        // Validate input
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Invalid credentials.'], 422);
        }

        // Attempt login
        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['error' => 'Unauthorized.'], 401);
        }

        $user = Auth::user();
        $token = $user->createToken('API Token')->accessToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user
        ]);
    }
}
