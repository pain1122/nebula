<?php

namespace Database\Factories;

use App\Models\Questionnaire;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuestionnaireSubmissionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'questionnaire_id' => Questionnaire::factory()->published(),
            'questionnaire_version' => 1,
            'questionnaire_title' => 'Factory Questionnaire',
            'questionnaire_slug' => 'factory-questionnaire',
            'user_id' => User::factory()->patient(),
            'answers_json' => [['question' => 'fixture', 'choice' => 'fixture']],
            'total_score' => 0,
            'result_title' => 'Factory Result',
            'data_classification' => 'medical',
            'retention_until' => now()->addYear(),
        ];
    }
}
