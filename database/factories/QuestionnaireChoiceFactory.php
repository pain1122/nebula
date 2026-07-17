<?php

namespace Database\Factories;

use App\Models\QuestionnaireQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionnaireChoiceFactory extends Factory
{
    public function definition(): array
    {
        return ['question_id' => QuestionnaireQuestion::factory(), 'sort_order' => 1, 'text' => fake()->words(2, true), 'score' => fake()->numberBetween(0, 4)];
    }
}
