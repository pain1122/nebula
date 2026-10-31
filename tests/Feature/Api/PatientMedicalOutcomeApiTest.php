<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationNote;
use App\Models\ReservationReport;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\ReservationFileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PatientMedicalOutcomeApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_golden_backend_flow_reaches_patient_safe_published_outcome_and_download(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $doctor = $reservation->doctor->user;
        $patient = $reservation->user;
        $requestPublicId = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->public_id.'/medical-requests', [
                'request_type' => 'lab_result',
                'title' => 'Complete blood count',
                'instructions' => 'Upload every page.',
            ])
            ->assertCreated()
            ->json('data.public_id');
        $medicalRequest = ReservationMedicalRequest::query()
            ->where('public_id', $requestPublicId)
            ->sole();

        $filePublicId = $this->actingAs($patient, 'sanctum')
            ->post($this->filesPath($reservation, $medicalRequest), [
                'file' => UploadedFile::fake()->createWithContent('patient-result.pdf', \Tests\Fixtures\SyntheticMedicalFiles::pdf()),
                'label' => 'Requested result',
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.public_id');
        $file = ReservationFile::query()->where('public_id', $filePublicId)->sole();
        app(ReservationFileService::class)->recordScan(
            Request::create('/internal/medical-files/scan', 'POST'),
            $file,
            ReservationFileScanStatus::Clean,
            $file->checksum_sha256,
        );
        $contentAudit = \App\Models\AuditEvent::query()->where('action', 'reservation_medical_file.scan_recorded')->sole();
        $this->assertSame(\App\Support\MedicalContentPolicy::current()->revision, $contentAudit->after['content_policy_revision']);
        $this->assertSame('qpdf-12.4.2/medical-v1', $contentAudit->after['content_validator']);
        $this->assertArrayNotHasKey('path', $contentAudit->after);
        $this->assertArrayNotHasKey('original_filename', $contentAudit->after);

        $this->actingAs($doctor, 'sanctum')
            ->postJson($this->doctorBasePath($reservation, $medicalRequest).'/review')
            ->assertOk();
        $reportPublicId = $this->actingAs($doctor, 'sanctum')
            ->postJson($this->doctorBasePath($reservation, $medicalRequest).'/reports', [
                'body' => 'The reviewed result is within the expected range.',
            ])
            ->assertCreated()
            ->json('data.public_id');
        $this->actingAs($doctor, 'sanctum')
            ->postJson(
                $this->doctorBasePath($reservation, $medicalRequest)
                .'/reports/'.$reportPublicId.'/publish'
            )
            ->assertOk();

        ReservationNote::factory()->create([
            'reservation_id' => $reservation->id,
            'body' => 'Care-team-only note that must never reach the patient outcome.',
        ]);

        $outcome = $this->actingAs($patient, 'sanctum')
            ->getJson($this->outcomePath($reservation, $medicalRequest))
            ->assertOk()
            ->assertJsonPath('data.medical_request.status', ReservationMedicalRequestStatus::Completed->value)
            ->assertJsonPath('data.latest_report.public_id', $reportPublicId)
            ->assertJsonPath('data.latest_report.status', ReservationReportStatus::Published->value)
            ->assertJsonPath('data.latest_report.body', 'The reviewed result is within the expected range.')
            ->assertJsonPath('data.latest_report.body_format', 'plain_text')
            ->assertJsonCount(1, 'data.report_history')
            ->assertJsonCount(1, 'data.files')
            ->assertJsonPath('data.files.0.public_id', $filePublicId)
            ->assertJsonPath('data.files.0.available', true);

        $encoded = $outcome->getContent();
        $this->assertStringNotContainsString('Care-team-only note', $encoded);
        $this->assertStringNotContainsString('reservation-files/', $encoded);
        $this->assertStringNotContainsString($file->checksum_sha256, $encoded);
        $outcome
            ->assertJsonMissingPath('data.files.0.disk')
            ->assertJsonMissingPath('data.files.0.path')
            ->assertJsonMissingPath('data.files.0.scan_status')
            ->assertJsonMissingPath('data.files.0.retention_until')
            ->assertJsonMissingPath('data.latest_report.author_user_id')
            ->assertJsonMissingPath('data.latest_report.retention_until');

        $this->actingAs($patient, 'sanctum')
            ->get($this->downloadPath($reservation, $medicalRequest, $file), ['Accept' => 'application/json'])
            ->assertOk();
    }

    public function test_patient_cannot_see_draft_outcome_or_download_before_publication(): void
    {
        [$reservation, $medicalRequest, $file] = $this->publishedFixture(published: false);

        $this->actingAs($reservation->user, 'sanctum')
            ->getJson($this->outcomePath($reservation, $medicalRequest))
            ->assertNotFound();

        $this->actingAs($reservation->user, 'sanctum')
            ->get($this->downloadPath($reservation, $medicalRequest, $file), ['Accept' => 'application/json'])
            ->assertNotFound();
    }

    public function test_patient_can_rediscover_only_their_reservation_requests(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;
        $path = '/api/reservations/'.$reservation->public_id.'/medical-requests';

        $this->actingAs($reservation->user, 'sanctum')
            ->getJson($path)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.public_id', $medicalRequest->public_id)
            ->assertJsonPath('data.0.instructions', $medicalRequest->instructions)
            ->assertJsonMissingPath('data.0.requested_by')
            ->assertJsonMissingPath('data.0.retention_until');

        foreach ([
            User::factory()->patient()->create(),
            $reservation->doctor->user,
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ] as $actor) {
            $this->actingAs($actor, 'sanctum')
                ->getJson($path)
                ->assertNotFound();
        }
    }

    public function test_other_users_doctors_and_marketplace_admins_cannot_read_medical_outcome(): void
    {
        [$reservation, $medicalRequest, $file, $report] = $this->publishedFixture();
        $actors = [
            User::factory()->patient()->create(),
            $reservation->doctor->user,
            User::factory()->doctor()->create(),
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ];

        foreach ($actors as $actor) {
            $this->actingAs($actor, 'sanctum')
                ->getJson($this->outcomePath($reservation, $medicalRequest))
                ->assertNotFound();
            $this->actingAs($actor, 'sanctum')
                ->get($this->downloadPath($reservation, $medicalRequest, $file), ['Accept' => 'application/json'])
                ->assertNotFound();
        }

        $admin = User::factory()->admin()->create();
        $this->assertFalse(Gate::forUser($admin)->allows('view', $medicalRequest));
        $this->assertFalse(Gate::forUser($admin)->allows('view', $file));
        $this->assertFalse(Gate::forUser($admin)->allows('view', $report));
    }

    public function test_patient_history_contains_only_published_retained_reports_and_safe_files(): void
    {
        [$reservation, $medicalRequest, $clean, $original] = $this->publishedFixture();
        $amendment = ReservationReport::factory()->published()->create([
            'medical_request_id' => $medicalRequest->id,
            'body' => 'Amended published outcome.',
            'supersedes_report_id' => $original->id,
            'published_at' => now()->addSecond(),
        ]);
        ReservationReport::factory()->create([
            'medical_request_id' => $medicalRequest->id,
            'body' => 'Draft must remain hidden.',
        ]);
        ReservationReport::factory()->published()->create([
            'medical_request_id' => $medicalRequest->id,
            'body' => 'Expired report must remain hidden.',
            'retention_until' => now()->subMinute(),
        ]);
        $fileAttributes = [
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ];
        foreach ([
            ReservationFileScanStatus::Quarantined,
            ReservationFileScanStatus::Infected,
            ReservationFileScanStatus::Failed,
        ] as $status) {
            ReservationFile::factory()->create(array_merge($fileAttributes, [
                'scan_status' => $status,
                'scanned_at' => $status === ReservationFileScanStatus::Quarantined ? null : now(),
            ]));
        }
        ReservationFile::factory()->create(array_merge($fileAttributes, [
            'retention_until' => now()->subMinute(),
        ]));

        $response = $this->actingAs($reservation->user, 'sanctum')
            ->getJson($this->outcomePath($reservation, $medicalRequest))
            ->assertOk()
            ->assertJsonCount(2, 'data.report_history')
            ->assertJsonPath('data.report_history.0.public_id', $original->public_id)
            ->assertJsonPath('data.report_history.1.public_id', $amendment->public_id)
            ->assertJsonPath('data.latest_report.public_id', $amendment->public_id)
            ->assertJsonCount(1, 'data.files')
            ->assertJsonPath('data.files.0.public_id', $clean->public_id);

        $encoded = $response->getContent();
        $this->assertStringNotContainsString('Draft must remain hidden.', $encoded);
        $this->assertStringNotContainsString('Expired report must remain hidden.', $encoded);
    }

    /** @return array{0: Reservation, 1: ReservationMedicalRequest, 2: ReservationFile, 3?: ReservationReport} */
    private function publishedFixture(bool $published = true): array
    {
        $reservation = Reservation::factory()->create();
        $medicalRequest = ReservationMedicalRequest::factory()->create([
            'reservation_id' => $reservation->id,
            'status' => $published
                ? ReservationMedicalRequestStatus::Completed
                : ReservationMedicalRequestStatus::InReview,
            'reviewed_at' => now(),
            'closed_at' => $published ? now() : null,
        ]);
        $file = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ]);
        Storage::disk('private')->put($file->path, 'clean fixture');
        $file->forceFill(['checksum_sha256' => hash('sha256', 'clean fixture'), 'size_bytes' => strlen('clean fixture')])->save();

        if (! $published) {
            ReservationReport::factory()->create([
                'medical_request_id' => $medicalRequest->id,
                'body' => 'Unpublished draft.',
            ]);

            return [$reservation, $medicalRequest, $file];
        }

        $report = ReservationReport::factory()->published()->create([
            'medical_request_id' => $medicalRequest->id,
            'body' => 'Original published outcome.',
        ]);

        return [$reservation, $medicalRequest, $file, $report];
    }

    private function doctorBasePath(
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): string {
        return '/api/doctor/reservations/'.$reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id;
    }

    private function filesPath(
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): string {
        return '/api/reservations/'.$reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/files';
    }

    private function outcomePath(
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): string {
        return '/api/reservations/'.$reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/outcome';
    }

    private function downloadPath(
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
        ReservationFile $file,
    ): string {
        return '/api/reservations/'.$reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/files/'.$file->public_id
            .'/download';
    }
}
