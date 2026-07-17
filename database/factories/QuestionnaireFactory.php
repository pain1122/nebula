<?php

namespace Database\Factories;

use App\Enums\QuestionnaireStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class QuestionnaireFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->unique()->sentence(4);

        return [
            'author_user_id' => User::factory()->rootAdmin(),
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(100, 999),
            'status' => QuestionnaireStatus::Draft->value,
            'content_html' => '<p>'.fake()->sentence().'</p>',
            'version' => 1,
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => ['status' => QuestionnaireStatus::Published->value, 'published_at' => now()]);
    }
}
