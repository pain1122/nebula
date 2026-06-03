<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): View
    {
        return view('auth.register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30', Rule::unique(User::class, 'phone')],
            'birth_date' => ['nullable', 'date'],
            'NID' => ['nullable', 'string', 'size:10', Rule::unique(User::class, 'NID')],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:' . User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        [$derivedFirstName, $derivedLastName] = $this->splitName($request->name);

        $user = User::create([
            'name' => $request->name,
            'first_name' => $request->input('first_name', $derivedFirstName),
            'last_name' => $request->input('last_name', $derivedLastName),
            'phone' => $request->input('phone', $this->generateUniquePhone()),
            'birth_date' => $request->input('birth_date', now()->subYears(18)->toDateString()),
            'NID' => $request->input('NID', $this->generateUniqueNid()),
            'patient_status' => 'free',
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $user->assignRole(UserRole::Patient->value);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
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
