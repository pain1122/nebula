<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApiV1ContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_success_envelope_adds_version_correlation_and_public_ids(): void
    {
        $user = User::factory()->patient()->create();
        $correlationId = (string) Str::uuid();

        $this->actingAs($user, 'sanctum')
            ->withHeader('X-Correlation-ID', $correlationId)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertHeader('X-API-Version', '1')
            ->assertHeader('X-Correlation-ID', $correlationId)
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.api_version', '1')
            ->assertJsonPath('meta.correlation_id', $correlationId)
            ->assertJsonPath('data.public_id', (string) $user->public_id);
    }

    public function test_validation_error_has_stable_code_and_generated_correlation_id(): void
    {
        $response = $this->postJson('/api/auth/register', []);

        $response->assertUnprocessable()
            ->assertHeader('X-API-Version', '1')
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'validation_failed')
            ->assertJsonPath('meta.api_version', '1');

        $correlationId = $response->headers->get('X-Correlation-ID');
        $this->assertTrue(is_string($correlationId) && Str::isUuid($correlationId));
        $this->assertSame($correlationId, $response->json('meta.correlation_id'));
    }

    public function test_admin_submission_resource_caps_pagination_and_excludes_contact_and_answer_payloads(): void
    {
        $admin = User::factory()->admin()->create();
        $questionnaire = Questionnaire::query()->create([
            'title' => 'Contract questionnaire',
            'slug' => 'contract-questionnaire',
            'status' => 'published',
            'content_html' => '<p>Safe public content.</p>',
        ]);
        $submission = QuestionnaireSubmission::query()->create([
            'questionnaire_id' => $questionnaire->id,
            'questionnaire_title' => $questionnaire->title,
            'questionnaire_slug' => $questionnaire->slug,
            'submitter_name' => 'Private Name',
            'submitter_phone' => '09121111111',
            'guest_token_hash' => hash('sha256', 'private-token'),
            'guest_phone' => '09122222222',
            'answers_json' => [['question' => 'Private question', 'answer' => 'Private answer']],
            'total_score' => 4,
            'result_title' => 'Result',
            'result_body_html' => '<p>Private result body.</p>',
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/questionnaire-submissions?per_page=500')
            ->assertOk()
            ->assertJsonPath('meta.pagination.per_page', 100)
            ->assertJsonPath('data.0.public_id', (string) $submission->public_id);

        $encoded = $response->getContent();
        $this->assertStringNotContainsString('09121111111', $encoded);
        $this->assertStringNotContainsString('09122222222', $encoded);
        $this->assertStringNotContainsString('Private answer', $encoded);
        $this->assertStringNotContainsString('Private result body', $encoded);
    }
}
