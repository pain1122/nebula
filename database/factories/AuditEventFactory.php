<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AuditEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'actor_user_id' => User::factory()->rootAdmin(),
            'actor_name_snapshot' => 'Factory Root Admin',
            'action' => 'factory.created',
            'subject_type' => User::class,
            'subject_id' => 1,
            'risk_level' => 'low',
            'reason' => 'Automated test fixture.',
            'outcome' => 'succeeded',
            'before' => null,
            'after' => ['fixture' => true],
            'route' => 'factory',
        ];
    }
}
