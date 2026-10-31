<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Models\AuditEvent;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ReservationReportService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ReservationReportServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigned_doctor_creates_and_replaces_one_original_draft_without_auditing_body(): void
    {
        [$medicalRequest, $doctor] = $this->reviewableRequest();
        $service = app(ReservationReportService::class);
        $draft = $service->saveDraft(
            $this->requestAs($doctor),
            $doctor,
            $medicalRequest,
            'Initial private patient outcome.',
        );

        $this->assertSame(ReservationReportStatus::Draft, $draft->status);
        $this->assertSame($medicalRequest->reservation_id, $draft->reservation_id);
        $this->assertSame($medicalRequest->id, $draft->medical_request_id);
        $this->assertSame($doctor->id, $draft->author_user_id);
        $this->assertSame($doctor->name, $draft->author_name_snapshot);
        $this->assertNull($draft->published_at);
        $this->assertTrue($draft->retention_until->equalTo($medicalRequest->retention_until));

        $updated = $service->saveDraft(
            $this->requestAs($doctor),
            $doctor,
            $medicalRequest,
            'Corrected private patient outcome.',
            draft: $draft,
        );

        $this->assertSame($draft->id, $updated->id);
        $this->assertSame('Corrected private patient outcome.', $updated->body);
        $this->assertDatabaseCount('reservation_reports', 1);

        $events = AuditEvent::query()->where('action', 'reservation_report.draft_saved')->get();
        $this->assertCount(2, $events);

        foreach ($events as $event) {
            $encoded = json_encode([$event->before, $event->after], JSON_THROW_ON_ERROR);
            $this->assertStringNotContainsString('patient outcome', $encoded);
            $this->assertStringNotContainsString($doctor->name, $encoded);
            $this->assertEqualsCanonicalizing([
                'report_public_id',
                'request_public_id',
                'reservation_public_id',
                'status',
                'published_at',
                'supersedes_report_public_id',
                'request_status',
                'request_closed_at',
                'retention_until',
            ], array_keys($event->after));
        }
    }

    public function test_publication_is_atomic_closes_original_request_and_is_idempotent(): void
    {
        [$medicalRequest, $doctor] = $this->reviewableRequest();
        $service = app(ReservationReportService::class);
        $draft = $service->saveDraft(
            $this->requestAs($doctor),
            $doctor,
            $medicalRequest,
            'Patient-visible published outcome.',
        );
        $published = $service->publish(
            $this->requestAs($doctor),
            $doctor,
            $draft,
        );
        $again = $service->publish(
            $this->requestAs($doctor),
            $doctor,
            $published,
        );

        $this->assertSame(ReservationReportStatus::Published, $published->status);
        $this->assertNotNull($published->published_at);
        $this->assertTrue($published->published_at->equalTo($again->published_at));
        $this->assertSame(ReservationMedicalRequestStatus::Completed, $medicalRequest->fresh()->status);
        $this->assertNotNull($medicalRequest->fresh()->closed_at);
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_report.published')->count());

        $event = AuditEvent::query()->where('action', 'reservation_report.published')->sole();
        $encoded = json_encode([$event->before, $event->after], JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('Patient-visible published outcome.', $encoded);
        $this->assertSame(ReservationReportStatus::Published->value, $event->after['status']);
        $this->assertSame(ReservationMedicalRequestStatus::Completed->value, $event->after['request_status']);
    }

    public function test_patient_unassigned_doctor_and_admins_cannot_manage_or_publish_reports(): void
    {
        [$medicalRequest, $doctor] = $this->reviewableRequest();
        $draft = ReservationReport::factory()->create([
            'medical_request_id' => $medicalRequest->id,
        ]);
        $actors = [
            $medicalRequest->reservation->user,
            User::factory()->doctor()->create(),
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ];

        foreach ($actors as $actor) {
            try {
                app(ReservationReportService::class)->saveDraft(
                    $this->requestAs($actor),
                    $actor,
                    $medicalRequest,
                    'Unauthorized draft.',
                );
                $this->fail('An unauthorized actor created a report draft.');
            } catch (AuthorizationException) {
                $this->assertDatabaseCount('reservation_reports', 1);
            }

            try {
                app(ReservationReportService::class)->publish(
                    $this->requestAs($actor),
                    $actor,
                    $draft,
                );
                $this->fail('An unauthorized actor published a report.');
            } catch (AuthorizationException) {
                $this->assertSame(ReservationReportStatus::Draft, $draft->fresh()->status);
            }
        }

        $this->assertSame($doctor->id, $draft->author_user_id);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_report_requires_review_state_and_a_clean_active_retained_file(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $doctor = $medicalRequest->reservation->doctor->user;

        try {
            app(ReservationReportService::class)->saveDraft(
                $this->requestAs($doctor),
                $doctor,
                $medicalRequest,
                'Too early.',
            );
            $this->fail('An open request accepted an original draft.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_reports', 0);
        }

        $medicalRequest->forceFill([
            'status' => ReservationMedicalRequestStatus::InReview,
            'reviewed_at' => now(),
        ])->save();
        $draft = ReservationReport::factory()->create([
            'medical_request_id' => $medicalRequest->id,
        ]);

        $this->expectException(DomainException::class);
        app(ReservationReportService::class)->publish(
            $this->requestAs($doctor),
            $doctor,
            $draft,
        );
    }

    public function test_amendment_is_a_new_published_row_and_preserves_predecessor_history(): void
    {
        [$medicalRequest, $doctor] = $this->reviewableRequest();
        $service = app(ReservationReportService::class);
        $original = $service->publish(
            $this->requestAs($doctor),
            $doctor,
            $service->saveDraft(
                $this->requestAs($doctor),
                $doctor,
                $medicalRequest,
                'Original patient outcome.',
            ),
        );
        $amendmentDraft = $service->saveDraft(
            $this->requestAs($doctor),
            $doctor,
            $medicalRequest->fresh(),
            'Amended patient outcome.',
            supersedes: $original,
        );
        $amendmentDraft = $service->saveDraft(
            $this->requestAs($doctor),
            $doctor,
            $medicalRequest->fresh(),
            'Corrected amended patient outcome.',
            draft: $amendmentDraft,
        );
        $amendment = $service->publish(
            $this->requestAs($doctor),
            $doctor,
            $amendmentDraft,
        );

        $this->assertNotSame($original->id, $amendment->id);
        $this->assertSame($original->id, $amendment->supersedes_report_id);
        $this->assertSame('Original patient outcome.', $original->fresh()->body);
        $this->assertSame('Corrected amended patient outcome.', $amendment->body);
        $this->assertSame(ReservationReportStatus::Published, $original->fresh()->status);
        $this->assertSame(ReservationReportStatus::Published, $amendment->status);
        $this->assertDatabaseCount('reservation_reports', 2);

        $this->expectException(DomainException::class);
        $service->saveDraft(
            $this->requestAs($doctor),
            $doctor,
            $medicalRequest->fresh(),
            'Competing amendment.',
            supersedes: $original,
        );
    }

    public function test_audit_failure_rolls_back_draft_and_publication(): void
    {
        [$medicalRequest, $doctor] = $this->reviewableRequest();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(ReservationReportService::class)->saveDraft(
                $this->requestAs($doctor),
                $doctor,
                $medicalRequest,
                'Draft that must roll back.',
            );
            $this->fail('Draft audit failure must escape.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertDatabaseCount('reservation_reports', 0);

        $draft = ReservationReport::factory()->create([
            'medical_request_id' => $medicalRequest->id,
        ]);
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('publish audit failed'));
        });

        try {
            app(ReservationReportService::class)->publish(
                $this->requestAs($doctor),
                $doctor,
                $draft,
            );
            $this->fail('Publication audit failure must escape.');
        } catch (RuntimeException $exception) {
            $this->assertSame('publish audit failed', $exception->getMessage());
        }

        $this->assertSame(ReservationReportStatus::Draft, $draft->fresh()->status);
        $this->assertNull($draft->fresh()->published_at);
        $this->assertSame(ReservationMedicalRequestStatus::InReview, $medicalRequest->fresh()->status);
        $this->assertNull($medicalRequest->fresh()->closed_at);
        $this->assertDatabaseCount('audit_events', 0);
    }

    /** @return array{0: ReservationMedicalRequest, 1: User} */
    private function reviewableRequest(): array
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create([
            'status' => ReservationMedicalRequestStatus::InReview,
            'reviewed_at' => now(),
        ]);
        $reservation = $medicalRequest->reservation;
        ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ]);

        return [$medicalRequest, $reservation->doctor->user];
    }

    private function requestAs(User $user): Request
    {
        $request = Request::create('/api/doctor/medical-reports', 'POST');
        $request->setUserResolver(fn (): User => $user);

        return $request;
    }
}
