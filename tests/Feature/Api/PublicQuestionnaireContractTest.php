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
            'conditions' => ['internal' => true],
            'priority' => 0,
        ]);

        return [$questionnaire, [$first->id, $second->id], [$firstChoice->id, $secondChoice->id]];
    }
}
