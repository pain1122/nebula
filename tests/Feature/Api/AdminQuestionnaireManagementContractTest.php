<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use RuntimeException;

class AdminQuestionnaireManagementContractTest extends AdminReservationPanelContractTest
{
    private function admin(): User
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum')->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $admin;
    }

    private function payload(): array
    {
        return ['title' => 'Synthetic questionnaire', 'slug' => 'synthetic-management', 'status' => 'published',
            'reason' => 'Synthetic management acceptance', 'content_html' => '<p>Safe</p><script>unsafe()</script>',
            'questions' => [['text' => 'Synthetic question?', 'choices' => [['text' => 'Synthetic choice', 'score' => 2]]]],
            'recommendations' => [['title' => 'Synthetic recommendation', 'min_score' => 0, 'max_score' => 10]],
        ];
    }

    public function test_questionnaire_revisions_preserve_answer_snapshots_and_reject_stale_edits(): void
    {
        $admin = $this->admin();
        $response = $this->postJson('/api/admin/questionnaires', $this->payload())->assertCreated()
            ->assertJsonPath('data.version', 1);
        $id = $response->json('data.id');
        $this->assertStringNotContainsString('<script', $response->json('data.content_html'));
        $snapshot = [['question_text' => 'Original question', 'choice_text' => 'Original choice', 'score' => 2]];
        $submission = QuestionnaireSubmission::factory()->create(['questionnaire_id' => $id, 'answers_json' => $snapshot]);
        $before = $submission->fresh()->getAttributes();
        $payload = $this->payload();
        $payload['title'] = 'Changed definition';
        $payload['expected_version'] = 1;
        $this->putJson('/api/admin/questionnaires/'.$id, $payload)->assertOk()->assertJsonPath('data.version', 2);
        $this->putJson('/api/admin/questionnaires/'.$id, $payload)->assertStatus(409);
        $this->deleteJson('/api/admin/questionnaires/'.$id, ['reason' => 'Stale archive', 'expected_version' => 1])->assertStatus(409);
        $this->assertSame($before, $submission->fresh()->getAttributes());
        $this->getJson('/api/admin/questionnaire-submissions/by-public-id/'.$submission->public_id)->assertOk()
            ->assertJsonPath('data.questionnaire_version', 1)->assertJsonPath('data.answers.0.question_text', 'Original question');
        $this->deleteJson('/api/admin/questionnaires/'.$id, ['reason' => 'Synthetic archive', 'expected_version' => 2])->assertNoContent();
        $this->assertSoftDeleted('questionnaires', ['id' => $id]);
        $this->assertSame($before, $submission->fresh()->getAttributes());
        $this->assertSame($admin->id, DB::table('audit_events')->where('action', 'admin.questionnaire.updated')->first()->actor_user_id);
    }

    public function test_submission_owner_version_dates_and_public_id_are_explicit(): void
    {
        $this->admin();
        $row = QuestionnaireSubmission::factory()->create(['submitter_name' => 'Synthetic Owner', 'submitter_phone' => '09120000000']);
        QuestionnaireSubmission::factory()->create(['user_id' => null, 'guest_token_hash' => hash('sha256', 'synthetic'), 'guest_phone' => '09120000001']);
        $this->getJson('/api/admin/questionnaire-submissions?'.http_build_query([
            'questionnaire_id' => $row->questionnaire_id, 'user_id' => $row->user_id, 'version' => 1, 'owner_type' => 'account', 'q' => 'Synthetic Owner',
        ]))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.user_id', $row->user_id)
            ->assertJsonMissingPath('data.0.answers')->assertJsonMissingPath('data.0.guest_token_hash')->assertJsonMissingPath('data.0.meta');
        $this->getJson('/api/admin/questionnaire-submissions?owner_type=guest')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.owner_type', 'guest');
        $this->getJson('/api/admin/questionnaire-submissions?score_min=-1&score_max=0')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/questionnaire-submissions?score_min=1&score_max=0')->assertUnprocessable();
        $row->forceFill(['retention_until' => now()->subSecond()])->save();
        $expired = $this->getJson('/api/admin/questionnaire-submissions/by-public-id/'.$row->public_id)->assertOk()
            ->assertJsonPath('data.answers_available', false)->assertJsonCount(0, 'data.answers')->assertJsonPath('data.result_body_html', null);
        $this->assertStringContainsString('no-store', $expired->headers->get('Cache-Control'));
        $this->getJson('/api/admin/questionnaire-submissions/by-public-id/'.$row->id)->assertNotFound();
        $this->getJson('/api/admin/questionnaire-submissions?user_id[]=1')->assertUnprocessable();
        $this->getJson('/api/admin/questionnaires?status=invalid')->assertUnprocessable();
        $this->getJson('/api/admin/questionnaires?version=-1')->assertUnprocessable();
        $this->getJson('/api/admin/questionnaires?from=2026-10-12&to=2026-10-11')->assertUnprocessable();
        foreach ([User::factory()->patient()->create(), User::factory()->doctor()->create()] as $actor) {
            $this->actingAs($actor, 'sanctum')->getJson('/api/admin/questionnaires')->assertForbidden();
            $this->getJson('/api/admin/questionnaire-submissions/by-public-id/'.$row->public_id)->assertForbidden();
        }
    }

    public function test_password_reason_bounds_and_transactional_audit_rollback(): void
    {
        $this->admin();
        $payload = $this->payload();
        $this->withSession(['auth.password_confirmed_at' => 0])->postJson('/api/admin/questionnaires', $payload)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        $invalid = $payload;
        unset($invalid['reason']);
        $this->postJson('/api/admin/questionnaires', $invalid)->assertUnprocessable();
        $invalid = $payload;
        $invalid['questions'] = array_fill(0, 101, $payload['questions'][0]);
        $this->postJson('/api/admin/questionnaires', $invalid)->assertUnprocessable();
        $invalid = $payload;
        $invalid['recommendations'] = [['title' => 'Invalid range', 'min_score' => 9, 'max_score' => 1]];
        $this->postJson('/api/admin/questionnaires', $invalid)->assertUnprocessable();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit failure'));
        });
        $this->postJson('/api/admin/questionnaires', $payload)->assertStatus(500);
        $this->assertSame(0, Questionnaire::count());
        $this->assertSame(0, DB::table('questionnaire_questions')->count());
    }
}
