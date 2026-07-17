<?php

namespace Database\Factories;

use App\Enums\AccountState;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $firstName = fake()->firstName();
        $lastName = fake()->lastName();

        return [
            'name' => $firstName.' '.$lastName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone' => fake()->unique()->numerify('09#########'),
            'birth_date' => fake()->date('Y-m-d', '-18 years'),
            'NID' => fake()->unique()->numerify('##########'),
            'patient_status' => null,
            'account_state' => AccountState::Active->value,
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function patient(): static
    {
        return $this->state(fn (array $attributes) => [
            'patient_status' => 'free',
        ])->withRole(UserRole::Patient);
    }

    public function doctor(): static
    {
        return $this->state(fn (array $attributes) => [
            'patient_status' => null,
        ])->withRole(UserRole::Doctor);
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'patient_status' => null,
        ])->withRole(UserRole::Admin);
    }

    public function rootAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'patient_status' => null,
        ])->withRole(UserRole::RootAdmin);
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'account_state' => AccountState::Active->value,
            'account_state_changed_at' => null,
            'closed_at' => null,
        ]);
    }

    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'account_state' => AccountState::Suspended->value,
            'account_state_changed_at' => now(),
            'closed_at' => null,
        ]);
    }

    public function closed(): static
    {
        return $this->state(fn (array $attributes) => [
            'account_state' => AccountState::Closed->value,
            'account_state_changed_at' => now(),
            'closed_at' => now(),
        ]);
    }

    private function withRole(UserRole $role): static
    {
        return $this->afterCreating(function (User $user) use ($role): void {
            Role::firstOrCreate([
                'name' => $role->value,
                'guard_name' => 'sanctum',
            ]);

            $user->syncRoles([$role->value]);
        });
    }
}
