<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ReservationMedicalFileApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_reservation_patient_uploads_to_an_open_request_with_safe_response_and_audit(): void
    {
        [$reservation, $medicalRequest] = $this->request();

        $response = $this->actingAs($reservation->user, 'sanctum')
            ->post($this->path($reservation, $medicalRequest), [
                'file' => UploadedFile::fake()->create('private-medical-result.pdf', 12, 'application/pdf'),
                'label' => 'Requested result',
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.label', 'Requested result')
            ->assertJsonPath('data.mime_type', 'application/pdf')
            ->assertJsonPath('data.available', false);

        $file = $medicalRequest->files()->sole();
        $this->assertSame($reservation->id, $file->reservation_id);
        $this->assertSame($medicalRequest->id, $file->medical_request_id);
        $this->assertSame($reservation->user_id, $file->uploaded_by);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->scan_status);
        $this->assertTrue($file->retention_until->equalTo($medicalRequest->retention_until));
        Storage::disk('private')->assertExists($file->path);

        $response
            ->assertJsonMissingPath('data.disk')
            ->assertJsonMissingPath('data.path')
            ->assertJsonMissingPath('data.original_filename')
            ->assertJsonMissingPath('data.safe_filename')
            ->assertJsonMissingPath('data.checksum_sha256')
            ->assertJsonMissingPath('data.scan_status')
            ->assertJsonMissingPath('data.scanned_at')
            ->assertJsonMissingPath('data.retention_until')
            ->assertJsonMissingPath('data.uploaded_by');

        $event = AuditEvent::query()->sole();
        $this->assertSame('reservation_medical_file.uploaded', $event->action);
        $this->assertEqualsCanonicalizing([
            'attachment_policy_revision',
            'effective_attachment_policy_revision',
            'file_public_id',
            'request_public_id',
            'reservation_public_id',
            'scan_status',
            'scanned_at',
            'retention_until',
            'archived_at',
        ], array_keys($event->after));
        $encodedAudit = json_encode($event->after, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('private-medical-result.pdf', $encodedAudit);
        $this->assertStringNotContainsString('Requested result', $encodedAudit);
        $this->assertStringNotContainsString('reservation-files', $encodedAudit);
    }

    public function test_exact_ten_mib_synthetic_file_is_quarantined_with_accurate_size_and_digest(): void
    {
        [$reservation, $medicalRequest] = $this->request();
        $contents = "%PDF-1.4\n% synthetic size-boundary fixture\n";
        $contents = str_pad($contents, 10 * 1024 * 1024 - 6, ' ')."%%EOF\n";

        $this->actingAs($reservation->user, 'sanctum')
            ->post($this->path($reservation, $medicalRequest), [
                'file' => UploadedFile::fake()->createWithContent('synthetic-boundary.pdf', $contents),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.available', false);

        $file = $medicalRequest->files()->sole();
        $this->assertSame(10 * 1024 * 1024, $file->size_bytes);
        $this->assertSame(hash('sha256', $contents), $file->checksum_sha256);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->scan_status);
        $this->assertDatabaseCount('reservation_files', 1);
    }

    public function test_one_byte_over_ten_mib_is_rejected_without_storage_or_audit_side_effects(): void
    {
        [$reservation, $medicalRequest] = $this->request();
        $contents = "%PDF-1.4\n% synthetic oversized fixture\n";
        $contents = str_pad($contents, 10 * 1024 * 1024 - 5, ' ')."%%EOF\n";

        $this->actingAs($reservation->user, 'sanctum')
            ->post($this->path($reservation, $medicalRequest), [
                'file' => UploadedFile::fake()->createWithContent('synthetic-oversized.pdf', $contents),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'validation_failed')
            ->assertJsonValidationErrors('file');

        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_only_the_reservation_patient_can_use_the_request_upload_endpoint(): void
    {
        [$reservation, $medicalRequest] = $this->request();
        $actors = [
            User::factory()->patient()->create(),
            $reservation->doctor->user,
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ];

        foreach ($actors as $actor) {
            $this->actingAs($actor, 'sanctum')
                ->post($this->path($reservation, $medicalRequest), [
                    'file' => UploadedFile::fake()->create('result.pdf', 12, 'application/pdf'),
                ], ['Accept' => 'application/json'])
                ->assertNotFound();
        }

        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_request_from_another_reservation_and_non_open_request_are_rejected(): void
    {
        [$reservation] = $this->request();
        [, $foreignRequest] = $this->request();

        $this->actingAs($reservation->user, 'sanctum')
            ->post($this->path($reservation, $foreignRequest), [
                'file' => UploadedFile::fake()->create('foreign.pdf', 12, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertNotFound();

        foreach ([
            ReservationMedicalRequestStatus::InReview,
            ReservationMedicalRequestStatus::Completed,
            ReservationMedicalRequestStatus::Cancelled,
        ] as $status) {
            [$ownedReservation, $medicalRequest] = $this->request($status);

            $this->actingAs($ownedReservation->user, 'sanctum')
                ->post($this->path($ownedReservation, $medicalRequest), [
                    'file' => UploadedFile::fake()->create('closed.pdf', 12, 'application/pdf'),
                ], ['Accept' => 'application/json'])
                ->assertUnprocessable()
                ->assertJsonPath('errors.file.0', 'upload_rejected');
        }

        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_client_owned_storage_scan_and_retention_fields_are_prohibited(): void
    {
        [$reservation, $medicalRequest] = $this->request();

        $this->actingAs($reservation->user, 'sanctum')
            ->post($this->path($reservation, $medicalRequest), [
                'file' => UploadedFile::fake()->create('result.pdf', 12, 'application/pdf'),
                'medical_request_id' => 999,
                'disk' => 'public',
                'path' => 'chosen/by/client',
                'scan_status' => ReservationFileScanStatus::Clean->value,
                'retention_until' => now()->addYears(50)->toISOString(),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'medical_request_id',
                'disk',
                'path',
                'scan_status',
                'retention_until',
            ]);

        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_medical_upload_audit_failure_removes_storage_and_database_rows(): void
    {
        [$reservation, $medicalRequest] = $this->request();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        $this->actingAs($reservation->user, 'sanctum')
            ->post($this->path($reservation, $medicalRequest), [
                'file' => UploadedFile::fake()->create('result.pdf', 12, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertServerError();

        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    /** @return array{0: Reservation, 1: ReservationMedicalRequest} */
    private function request(
        ReservationMedicalRequestStatus $status = ReservationMedicalRequestStatus::Open,
    ): array {
        $reservation = Reservation::factory()->create();
        $attributes = [
            'reservation_id' => $reservation->id,
            'status' => $status,
        ];

        if ($status === ReservationMedicalRequestStatus::InReview) {
            $attributes['reviewed_at'] = now();
        }

        if ($status === ReservationMedicalRequestStatus::Completed) {
            $attributes['reviewed_at'] = now();
            $attributes['closed_at'] = now();
        }

        if ($status === ReservationMedicalRequestStatus::Cancelled) {
            $attributes['closed_at'] = now();
        }

        return [
            $reservation,
            ReservationMedicalRequest::factory()->withAttachmentPolicy()->create($attributes),
        ];
    }

    private function path(
        Reservation $reservation,
        ReservationMedicalRequest $medicalRequest,
    ): string {
        return '/api/reservations/'.$reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/files';
    }
}
