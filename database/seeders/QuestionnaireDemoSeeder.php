<?php

namespace Database\Seeders;

use App\Enums\QuestionnaireStatus;
use App\Models\Questionnaire;
use App\Models\QuestionnaireChoice;
use App\Models\QuestionnaireQuestion;
use App\Models\QuestionnaireRecommendation;
use App\Models\User;
use Illuminate\Database\Seeder;

class QuestionnaireDemoSeeder extends Seeder
{
    public function run(): void
    {
        $questionnaire = Questionnaire::updateOrCreate(
            ['slug' => 'demo-heart-health-screen'],
            [
                'author_user_id' => User::where('email', 'rootadmin@checkupino.test')->firstOrFail()->id,
                'title' => 'Demo Heart Health Screen',
                'status' => QuestionnaireStatus::Published->value,
                'content_html' => '<p>This demo is informational and does not replace medical advice.</p>',
                'version' => 1,
                'published_at' => now(),
            ]
        );

        $questions = [
            [
                'text' => 'Do you experience chest discomfort during activity?',
                'choices' => [['Never', 0], ['Sometimes', 2], ['Often', 4]],
            ],
            [
                'text' => 'Do you become unusually short of breath during normal activity?',
                'choices' => [['Never', 0], ['Sometimes', 1], ['Often', 3]],
            ],
            [
                'text' => 'Do you have a family history of early heart disease?',
                'choices' => [['No', 0], ['Unsure', 1], ['Yes', 2]],
            ],
        ];

        foreach ($questions as $questionOrder => $questionData) {
            $question = QuestionnaireQuestion::updateOrCreate(
                ['questionnaire_id' => $questionnaire->id, 'sort_order' => $questionOrder + 1],
                ['text' => $questionData['text']]
            );

            foreach ($questionData['choices'] as $choiceOrder => [$text, $score]) {
                QuestionnaireChoice::updateOrCreate(
                    ['question_id' => $question->id, 'sort_order' => $choiceOrder + 1],
                    ['text' => $text, 'score' => $score]
                );
            }
        }

        $recommendations = [
            ['min_score' => 0, 'max_score' => 2, 'title' => 'Continue routine prevention', 'body_html' => '<p>Maintain routine preventive care.</p>', 'priority' => 10],
            ['min_score' => 3, 'max_score' => 6, 'title' => 'Consider a medical consultation', 'body_html' => '<p>Consider discussing these symptoms with a doctor.</p>', 'priority' => 20],
            ['min_score' => 7, 'max_score' => 9, 'title' => 'Arrange prompt medical advice', 'body_html' => '<p>Arrange prompt medical advice. Seek emergency care for severe symptoms.</p>', 'priority' => 30],
        ];

        foreach ($recommendations as $recommendation) {
            QuestionnaireRecommendation::updateOrCreate(
                ['questionnaire_id' => $questionnaire->id, 'min_score' => $recommendation['min_score'], 'max_score' => $recommendation['max_score']],
                $recommendation + ['conditions' => null]
            );
        }
    }
}
