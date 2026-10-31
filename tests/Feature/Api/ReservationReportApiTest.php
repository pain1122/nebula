<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Models\AuditEvent;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationReportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigned_doctor_saves_updates_and_publishes_plain_text_report(): void
    {
        $medicalRequest = $this->reviewableRequest();
        $doctor = $medicalRequest->reservation->doctor->user;
        $basePath = $this->basePath($medicalRequest);

        $create = $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath, [
                'body' => '<script>plain text, never executable HTML</script>',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', ReservationReportStatus::Draft->value)
            ->assertJsonPath('data.body', '<script>plain text, never executable HTML</script>')
            ->assertJsonPath('data.body_format', 'plain_text')
            ->assertJsonPath('data.author_name', $doctor->name);

        $reportPublicId = $create->json('data.public_id');
        $this->actingAs($doctor, 'sanctum')
            ->putJson($basePath.'/'.$reportPublicId, [
                'body' => 'Corrected patient-visible outcome.',
            ])
            ->assertOk()
            ->assertJsonPath('data.body', 'Corrected patient-visible outcome.');

        $publish = $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath.'/'.$reportPublicId.'/publish')
            ->assertOk()
            ->assertJsonPath('data.status', ReservationReportStatus::Published->value)
            ->assertJsonPath('data.body', 'Corrected patient-visible outcome.');

        $publish
            ->assertJsonMissingPath('data.reservation_id')
            ->assertJsonMissingPath('data.medical_request_id')
            ->assertJsonMissingPath('data.author_user_id')
            ->assertJsonMissingPath('data.author_name_snapshot')
            ->assertJsonMissingPath('data.retention_until')
            ->assertJsonMissingPath('data.archived_by');

        $this->assertSame(ReservationMedicalRequestStatus::Completed, $medicalRequest->fresh()->status);
        $this->assertDatabaseHas('reservation_reports', [
            'public_id' => $reportPublicId,
            'status' => ReservationReportStatus::Published->value,
            'body' => 'Corrected patient-visible outcome.',
        ]);

        foreach (AuditEvent::query()->whereIn('action', [
            'reservation_report.draft_saved',
            'reservation_report.published',
        ])->get() as $event) {
            $encoded = json_encode([$event->before, $event->after], JSON_THROW_ON_ERROR);
            $this->assertStringNotContainsString('patient-visible outcome', $encoded);
            $this->assertStringNotContainsString('<script>', $encoded);
        }
    }

    public function test_publication_rejects_client_owned_facts_and_published_report_cannot_be_updated(): void
    {
        $medicalRequest = $this->reviewableRequest();
        $doctor = $medicalRequest->reservation->doctor->user;
        $basePath = $this->basePath($medicalRequest);
        $reportPublicId = $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath, ['body' => 'Outcome.'])
            ->json('data.public_id');

        $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath.'/'.$reportPublicId.'/publish', [
                'status' => ReservationReportStatus::Published->value,
                'published_at' => now()->subYear()->toISOString(),
                'author_user_id' => User::factory()->doctor()->create()->id,
                'retention_until' => now()->addYears(50)->toISOString(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'status',
                'published_at',
                'author_user_id',
                'retention_until',
            ]);

        $this->assertSame(ReservationReportStatus::Draft, ReservationReport::query()->where('public_id', $reportPublicId)->sole()->status);

        $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath.'/'.$reportPublicId.'/publish')
            ->assertOk();

        $this->actingAs($doctor, 'sanctum')
            ->putJson($basePath.'/'.$reportPublicId, ['body' => 'Overwrite attempt.'])
            ->assertForbidden();

        $this->assertDatabaseHas('reservation_reports', [
            'public_id' => $reportPublicId,
            'body' => 'Outcome.',
        ]);
    }

    public function test_unassigned_doctor_gets_not_found_and_patient_and_admins_are_denied(): void
    {
        $medicalRequest = $this->reviewableRequest();
        $basePath = $this->basePath($medicalRequest);

        $this->actingAs(User::factory()->doctor()->create(), 'sanctum')
            ->postJson($basePath, ['body' => 'Unauthorized.'])
            ->assertNotFound();

        foreach ([
            $medicalRequest->reservation->user,
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ] as $actor) {
            $this->actingAs($actor, 'sanctum')
                ->postJson($basePath, ['body' => 'Unauthorized.'])
                ->assertForbidden();
        }

        $this->assertDatabaseCount('reservation_reports', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_assigned_doctor_publishes_amendment_as_new_history_row(): void
    {
        $medicalRequest = $this->reviewableRequest();
        $doctor = $medicalRequest->reservation->doctor->user;
        $basePath = $this->basePath($medicalRequest);
        $originalPublicId = $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath, ['body' => 'Original outcome.'])
            ->json('data.public_id');
        $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath.'/'.$originalPublicId.'/publish')
            ->assertOk();

        $amendmentPublicId = $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath, [
                'body' => 'Amended outcome.',
                'supersedes_report_id' => $originalPublicId,
            ])
            ->assertCreated()
            ->assertJsonPath('data.supersedes_report_public_id', $originalPublicId)
            ->json('data.public_id');
        $this->actingAs($doctor, 'sanctum')
            ->postJson($basePath.'/'.$amendmentPublicId.'/publish')
            ->assertOk()
            ->assertJsonPath('data.supersedes_report_public_id', $originalPublicId);

        $original = ReservationReport::query()->where('public_id', $originalPublicId)->sole();
        $amendment = ReservationReport::query()->where('public_id', $amendmentPublicId)->sole();
        $this->assertSame(ReservationReportStatus::Published, $original->status);
        $this->assertSame('Original outcome.', $original->body);
        $this->assertSame($original->id, $amendment->supersedes_report_id);
        $this->assertDatabaseCount('reservation_reports', 2);
    }

    private function reviewableRequest(): ReservationMedicalRequest
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create([
            'status' => ReservationMedicalRequestStatus::InReview,
            'reviewed_at' => now(),
        ]);
        ReservationFile::factory()->create([
            'reservation_id' => $medicalRequest->reservation_id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $medicalRequest->reservation->user_id,
        ]);

        return $medicalRequest;
    }

    private function basePath(ReservationMedicalRequest $medicalRequest): string
    {
        return '/api/doctor/reservations/'.$medicalRequest->reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/reports';
    }
}
