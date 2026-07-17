<?php

namespace Database\Factories;

use App\Models\Questionnaire;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionnaireRecommendationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'questionnaire_id' => Questionnaire::factory(),
            'min_score' => 0,
            'max_score' => 5,
            'title' => fake()->sentence(3),
            'body_html' => '<p>'.fake()->sentence().'</p>',
            'conditions' => null,
            'priority' => 10,
        ];
    }
}
