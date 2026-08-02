<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\Questionnaire;
use App\Models\QuestionnaireChoice;
use App\Models\QuestionnaireQuestion;
use App\Models\QuestionnaireRecommendation;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class AdminQuestionnaireSoftDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_questionnaire_delete_soft_deletes_without_cascading_related_rows(): void
    {
        $admin = $this->adminUser();
        $questionnaire = $this->questionnaire();
        $question = QuestionnaireQuestion::query()->create([
            'questionnaire_id' => $questionnaire->id,
            'text' => 'How are you feeling?',
            'sort_order' => 1,
        ]);
        $choice = QuestionnaireChoice::query()->create([
            'question_id' => $question->id,
            'text' => 'Good',
            'score' => 1,
            'sort_order' => 1,
        ]);
        $recommendation = QuestionnaireRecommendation::query()->create([
            'questionnaire_id' => $questionnaire->id,
            'min_score' => 0,
            'max_score' => 5,
            'title' => 'General advice',
            'body_html' => '<p>Keep monitoring.</p>',
            'priority' => 1,
        ]);
        $submission = $this->submission($questionnaire);

        $this
            ->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()])
            ->deleteJson('/api/admin/questionnaires/'.$questionnaire->id, [
                'reason' => 'Questionnaire retired',
            ])
            ->assertNoContent();

        $this->assertSoftDeleted('questionnaires', [
            'id' => $questionnaire->id,
        ]);
        $this->assertSame(0, Questionnaire::query()->whereKey($questionnaire->id)->count());
        $this->assertSame(1, Questionnaire::withTrashed()->whereKey($questionnaire->id)->count());

        $this->assertDatabaseHas('questionnaire_questions', [
            'id' => $question->id,
            'questionnaire_id' => $questionnaire->id,
        ]);
        $this->assertDatabaseHas('questionnaire_choices', [
            'id' => $choice->id,
            'question_id' => $question->id,
        ]);
        $this->assertDatabaseHas('questionnaire_recommendations', [
            'id' => $recommendation->id,
            'questionnaire_id' => $questionnaire->id,
        ]);
        $this->assertDatabaseHas('questionnaire_submissions', [
            'id' => $submission->id,
            'questionnaire_id' => $questionnaire->id,
            'deleted_at' => null,
        ]);
    }

    public function test_admin_questionnaire_submission_delete_soft_deletes_submission_only(): void
    {
        $admin = $this->adminUser();
        $questionnaire = $this->questionnaire();
        $submission = $this->submission($questionnaire);

        $this
            ->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()])
            ->deleteJson('/api/admin/questionnaire-submissions/'.$submission->id, [
                'reason' => 'Retention-approved archival',
            ])
            ->assertNoContent();

        $this->assertSoftDeleted('questionnaire_submissions', [
            'id' => $submission->id,
        ]);
        $this->assertSame(0, QuestionnaireSubmission::query()->whereKey($submission->id)->count());
        $this->assertSame(1, QuestionnaireSubmission::withTrashed()->whereKey($submission->id)->count());

        $this->assertDatabaseHas('questionnaires', [
            'id' => $questionnaire->id,
            'deleted_at' => null,
        ]);

        $event = AuditEvent::query()->sole();
        $this->assertSame('admin.questionnaire_submission.archived', $event->action);
        $this->assertSame('Retention-approved archival', $event->reason);
        $this->assertArrayNotHasKey('answers_json', $event->before);
        $this->assertArrayNotHasKey('submitter_phone', $event->before);
    }

    public function test_submission_archive_requires_step_up_reason_and_rolls_back_on_audit_failure(): void
    {
        $admin = $this->adminUser();
        $submission = $this->submission($this->questionnaire());

        $this->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->deleteJson('/api/admin/questionnaire-submissions/'.$submission->id, [
                'reason' => 'Missing step-up',
            ])
            ->assertStatus(423);

        $this->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()])
            ->deleteJson('/api/admin/questionnaire-submissions/'.$submission->id)
            ->assertUnprocessable();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        $this->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()])
            ->deleteJson('/api/admin/questionnaire-submissions/'.$submission->id, [
                'reason' => 'Must roll back',
            ])
            ->assertStatus(500);

        $this->assertDatabaseHas('questionnaire_submissions', [
            'id' => $submission->id,
            'deleted_at' => null,
        ]);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function adminUser(): User
    {
        $admin = User::factory()->create();
        $admin->syncRoles([UserRole::Admin->value]);

        return $admin;
    }

    private function questionnaire(): Questionnaire
    {
        return Questionnaire::query()->create([
            'title' => 'Soft delete questionnaire',
            'slug' => 'soft-delete-questionnaire-'.uniqid(),
            'status' => 'published',
            'cover_image_url' => null,
            'content_html' => '<p>Public copy.</p>',
        ]);
    }

    private function submission(Questionnaire $questionnaire): QuestionnaireSubmission
    {
        return QuestionnaireSubmission::query()->create([
            'questionnaire_id' => $questionnaire->id,
            'questionnaire_title' => $questionnaire->title,
            'questionnaire_slug' => $questionnaire->slug,
            'user_id' => null,
            'submitter_name' => 'Test Submitter',
            'submitter_phone' => '09120000000',
            'guest_token_hash' => hash('sha256', 'guest-token-'.uniqid()),
            'guest_phone' => '09120000000',
            'answers_json' => [
                ['question' => 'How are you feeling?', 'answer' => 'Good'],
            ],
            'total_score' => 1,
            'result_title' => 'Low risk',
            'result_body_html' => '<p>Keep monitoring.</p>',
        ]);
    }
}
