<?php

namespace Database\Factories;

use App\Models\Questionnaire;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionnaireQuestionFactory extends Factory
{
    public function definition(): array
    {
        return ['questionnaire_id' => Questionnaire::factory(), 'sort_order' => 1, 'text' => fake()->sentence().' ?'];
    }
}
