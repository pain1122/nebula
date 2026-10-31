<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestionnaireSubmissionRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_equivalent_phone_formats_share_one_hashed_limit_bucket(): void
    {
        config([
            'questionnaires.submission_limits.per_user_per_minute' => 100,
            'questionnaires.submission_limits.per_phone_per_minute' => 1,
            'questionnaires.submission_limits.per_ip_per_minute' => 100,
        ]);
        [$questionnaire, $questionId, $choiceId] = $this->questionnaire();

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.41'])
            ->postJson($this->submitUrl($questionnaire), $this->payload($questionId, $choiceId, '+98 912 000 0041'))
            ->assertOk();

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.41'])
            ->postJson($this->submitUrl($questionnaire), $this->payload($questionId, $choiceId, '۰۹۱۲ ۰۰۰ ۰۰۴۱'))
            ->assertTooManyRequests()
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'rate_limited')
            ->assertJsonPath('meta.api_version', '1');

        $this->assertDatabaseCount('questionnaire_submissions', 1);
    }

    public function test_authenticated_user_limit_cannot_be_bypassed_with_another_phone(): void
    {
        config([
            'questionnaires.submission_limits.per_user_per_minute' => 1,
            'questionnaires.submission_limits.per_phone_per_minute' => 100,
            'questionnaires.submission_limits.per_ip_per_minute' => 100,
        ]);
        [$questionnaire, $questionId, $choiceId] = $this->questionnaire();
        $user = User::factory()->patient()->create();

        $this->actingAs($user, 'sanctum')
            ->withServerVariables(['REMOTE_ADDR' => '198.51.100.42'])
            ->postJson($this->submitUrl($questionnaire), $this->payload($questionId, $choiceId, '09120000042'))
            ->assertOk();

        $this->actingAs($user, 'sanctum')
            ->withServerVariables(['REMOTE_ADDR' => '198.51.100.42'])
            ->postJson($this->submitUrl($questionnaire), $this->payload($questionId, $choiceId, '09120000043'))
            ->assertTooManyRequests();

        $this->assertDatabaseCount('questionnaire_submissions', 1);
    }

    public function test_ip_limit_applies_across_guest_phone_numbers(): void
    {
        config([
            'questionnaires.submission_limits.per_user_per_minute' => 100,
            'questionnaires.submission_limits.per_phone_per_minute' => 100,
            'questionnaires.submission_limits.per_ip_per_minute' => 1,
        ]);
        [$questionnaire, $questionId, $choiceId] = $this->questionnaire();

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.43'])
            ->postJson($this->submitUrl($questionnaire), $this->payload($questionId, $choiceId, '09120000044'))
            ->assertOk();

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.43'])
            ->postJson($this->submitUrl($questionnaire), $this->payload($questionId, $choiceId, '09120000045'))
            ->assertTooManyRequests();

        $this->assertDatabaseCount('questionnaire_submissions', 1);
    }

    /** @return array{0: Questionnaire, 1: int, 2: int} */
    private function questionnaire(): array
    {
        $questionnaire = Questionnaire::query()->create([
            'title' => 'Rate limit contract',
            'slug' => 'rate-limit-contract-'.uniqid(),
            'status' => 'published',
            'published_at' => now(),
        ]);
        $question = $questionnaire->questions()->create([
            'text' => 'Question?',
            'sort_order' => 0,
        ]);
        $choice = $question->choices()->create([
            'text' => 'Answer',
            'score' => 1,
            'sort_order' => 0,
        ]);
        $questionnaire->recommendations()->create([
            'min_score' => 1,
            'max_score' => 1,
            'title' => 'Recommendation',
            'priority' => 0,
        ]);

        return [$questionnaire, $question->id, $choice->id];
    }

    /** @return array<string, mixed> */
    private function payload(int $questionId, int $choiceId, string $phone): array
    {
        return [
            'answers' => [[
                'question_id' => $questionId,
                'choice_id' => $choiceId,
            ]],
            'submitter_name' => 'Rate Limit Patient',
            'submitter_phone' => $phone,
        ];
    }

    private function submitUrl(Questionnaire $questionnaire): string
    {
        return '/api/questionnaires/'.$questionnaire->slug.'/submit';
    }
}
