<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicQuestionnaireContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_definition_hides_scoring_rules_but_submission_returns_result(): void
    {
        [$questionnaire, $questionIds, $choiceIds] = $this->publishedQuestionnaire();

        $definition = $this->getJson('/api/questionnaires/'.$questionnaire->slug)
            ->assertOk()
            ->assertJsonMissingPath('questions.0.choices.0.score')
            ->assertJsonMissingPath('recommendations')
            ->json();

        $this->assertArrayNotHasKey('score', $definition['questions'][0]['choices'][0]);

        $response = $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', [
            'answers' => [
                ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[0]],
                ['question_id' => $questionIds[1], 'choice_id' => $choiceIds[1]],
            ],
            'submitter_name' => 'Questionnaire Patient',
            'submitter_phone' => '09120000000',
        ])->assertOk();

        $response
            ->assertJsonPath('total_score', 3)
            ->assertJsonPath('recommendation.title', 'Follow-up');

        $this->assertSame(26, strlen($response->json('submission_id')));
        $this->assertDatabaseHas('questionnaire_submissions', [
            'questionnaire_id' => $questionnaire->id,
            'total_score' => 3,
        ]);
    }

    public function test_submission_requires_exactly_one_answer_for_every_question(): void
    {
        [$questionnaire, $questionIds, $choiceIds] = $this->publishedQuestionnaire();

        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', [
            'answers' => [
                ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[0]],
                ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[0]],
            ],
            'submitter_name' => 'Duplicate Answer',
            'submitter_phone' => '09120000001',
        ])->assertStatus(422);

        $this->assertDatabaseCount('questionnaire_submissions', 0);
    }

    public function test_submission_rejects_missing_foreign_mismatched_and_client_scoring_facts(): void
    {
        [$questionnaire, $questionIds, $choiceIds] = $this->publishedQuestionnaire();
        [, , $foreignChoiceIds] = $this->publishedQuestionnaire();
        $base = [
            'submitter_name' => 'Tamper Test',
            'submitter_phone' => '09120000002',
        ];

        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', $base + [
            'answers' => [
                ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[0]],
            ],
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'validation_failed')
            ->assertJsonPath('errors.answers.0', 'question_set_mismatch');

        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', $base + [
            'answers' => [
                ['question_id' => $questionIds[0], 'choice_id' => $foreignChoiceIds[0]],
                ['question_id' => $questionIds[1], 'choice_id' => $choiceIds[1]],
            ],
        ])->assertUnprocessable()
            ->assertJsonPath('errors.answers.0', 'choice_not_in_questionnaire');

        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', $base + [
            'answers' => [
                ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[1]],
                ['question_id' => $questionIds[1], 'choice_id' => $choiceIds[0]],
            ],
        ])->assertUnprocessable()
            ->assertJsonPath('errors.answers.0', 'choice_question_mismatch');

        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', $base + [
            'answers' => [
                ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[0], 'score' => 999],
                ['question_id' => $questionIds[1], 'choice_id' => $choiceIds[1]],
            ],
            'total_score' => 999,
            'result_title' => 'Attacker result',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['answers.0', 'total_score', 'result_title']);

        $this->assertDatabaseCount('questionnaire_submissions', 0);
        $this->assertDatabaseCount('leads', 0);
    }

    public function test_submission_snapshots_the_actual_locked_questionnaire_version(): void
    {
        [$questionnaire, $questionIds, $choiceIds] = $this->publishedQuestionnaire();
        $questionnaire->forceFill(['version' => 7])->save();
        $answers = [
            ['question_id' => $questionIds[0], 'choice_id' => $choiceIds[0]],
            ['question_id' => $questionIds[1], 'choice_id' => $choiceIds[1]],
        ];

        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', [
            'answers' => $answers,
            'submitter_name' => 'Version Seven',
            'submitter_phone' => '09120000007',
        ])->assertOk();

        $questionnaire->forceFill(['version' => 8])->save();
        $this->postJson('/api/questionnaires/'.$questionnaire->slug.'/submit', [
            'answers' => $answers,
            'submitter_name' => 'Version Eight',
            'submitter_phone' => '09120000008',
        ])->assertOk();

        $this->assertDatabaseHas('questionnaire_submissions', [
            'questionnaire_id' => $questionnaire->id,
            'submitter_phone' => '09120000007',
            'questionnaire_version' => 7,
        ]);
        $this->assertDatabaseHas('questionnaire_submissions', [
            'questionnaire_id' => $questionnaire->id,
            'submitter_phone' => '09120000008',
            'questionnaire_version' => 8,
        ]);
    }

    /**
     * @return array{Questionnaire, list<int>, list<int>}
     */
    private function publishedQuestionnaire(): array
    {
        $questionnaire = Questionnaire::query()->create([
            'title' => 'Public scoring contract',
            'slug' => 'public-scoring-contract-'.uniqid(),
            'status' => 'published',
            'published_at' => now(),
        ]);
        $first = $questionnaire->questions()->create(['text' => 'First?', 'sort_order' => 0]);
        $firstChoice = $first->choices()->create(['text' => 'Yes', 'score' => 1, 'sort_order' => 0]);
        $second = $questionnaire->questions()->create(['text' => 'Second?', 'sort_order' => 1]);
        $secondChoice = $second->choices()->create(['text' => 'Yes', 'score' => 2, 'sort_order' => 0]);
        $questionnaire->recommendations()->create([
            'min_score' => 3,
            'max_score' => 3,
            'title' => 'Follow-up',
            'body_html' => '<p>Please follow up.</p>',
            'conditions' => null,
            'priority' => 0,
        ]);

        return [$questionnaire, [$first->id, $second->id], [$firstChoice->id, $secondChoice->id]];
    }
}
