<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestionnaireRecommendationValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_invalid_range_and_non_empty_conditions_are_rejected(): void
    {
        $admin = User::factory()->admin()->create();
        $payload = $this->payload('invalid-recommendation-'.uniqid(), [[
            'min_score' => 10,
            'max_score' => 5,
            'title' => 'Invalid',
            'priority' => 0,
            'conditions' => ['age' => ['min' => 18]],
        ]]);

        $response = $this->statefulAdmin($admin)
            ->postJson('/api/admin/questionnaires', $payload)
            ->assertUnprocessable();

        $this->assertSame(
            ['invalid_score_range'],
            $response->json('errors')['recommendations.0.min_score'],
        );
        $this->assertSame(
            ['unsupported_conditions'],
            $response->json('errors')['recommendations.0.conditions'],
        );

        $this->assertDatabaseCount('questionnaires', 0);
        $this->assertDatabaseCount('questionnaire_recommendations', 0);
    }

    public function test_inclusive_overlap_at_the_same_priority_is_rejected(): void
    {
        $admin = User::factory()->admin()->create();
        $payload = $this->payload('overlap-recommendation-'.uniqid(), [
            [
                'min_score' => 0,
                'max_score' => 5,
                'title' => 'First',
                'priority' => 0,
            ],
            [
                'min_score' => 5,
                'max_score' => 10,
                'title' => 'Second',
                'priority' => 0,
            ],
        ]);

        $response = $this->statefulAdmin($admin)
            ->postJson('/api/admin/questionnaires', $payload)
            ->assertUnprocessable();

        $this->assertSame(
            ['ambiguous_score_range'],
            $response->json('errors')['recommendations.1.min_score'],
        );

        $this->assertDatabaseCount('questionnaires', 0);
    }

    public function test_overlapping_ranges_with_distinct_priorities_select_deterministically_at_the_boundary(): void
    {
        $admin = User::factory()->admin()->create();
        $slug = 'priority-recommendation-'.uniqid();
        $payload = $this->payload($slug, [
            [
                'min_score' => 0,
                'max_score' => 5,
                'title' => 'Lower precedence',
                'priority' => 10,
            ],
            [
                'min_score' => 5,
                'max_score' => 10,
                'title' => 'Higher precedence',
                'priority' => 0,
            ],
        ]);

        $this->statefulAdmin($admin)
            ->postJson('/api/admin/questionnaires', $payload)
            ->assertCreated();

        $questionnaire = Questionnaire::query()->where('slug', $slug)->firstOrFail();
        $question = $questionnaire->questions()->sole();
        $choice = $question->choices()->sole();

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.50'])
            ->postJson('/api/questionnaires/'.$slug.'/submit', [
                'answers' => [[
                    'question_id' => $question->id,
                    'choice_id' => $choice->id,
                ]],
                'submitter_name' => 'Boundary Patient',
                'submitter_phone' => '09120000050',
            ])
            ->assertOk()
            ->assertJsonPath('total_score', 5)
            ->assertJsonPath('recommendation.title', 'Higher precedence');
    }

    /**
     * @param  list<array<string, mixed>>  $recommendations
     * @return array<string, mixed>
     */
    private function payload(string $slug, array $recommendations): array
    {
        return [
            'title' => 'Recommendation validation',
            'slug' => $slug,
            'status' => 'published',
            'reason' => 'Verify deterministic recommendation rules',
            'questions' => [[
                'text' => 'Question?',
                'sort_order' => 0,
                'choices' => [[
                    'text' => 'Boundary answer',
                    'score' => 5,
                    'sort_order' => 0,
                ]],
            ]],
            'recommendations' => $recommendations,
        ];
    }

    private function statefulAdmin(User $admin): static
    {
        return $this->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()]);
    }
}
