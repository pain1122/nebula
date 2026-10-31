<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DoctorMedicalReviewApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_assigned_doctor_starts_review_and_receives_only_safe_available_metadata(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;
        $attributes = [
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ];
        $clean = ReservationFile::factory()->create($attributes);
        $quarantined = ReservationFile::factory()->create(array_merge($attributes, [
            'scan_status' => ReservationFileScanStatus::Quarantined,
            'scanned_at' => null,
        ]));
        ReservationFile::factory()->create(array_merge($attributes, [
            'scan_status' => ReservationFileScanStatus::Infected,
        ]));
        ReservationFile::factory()->create(array_merge($attributes, [
            'retention_until' => now()->subMinute(),
        ]));
        ReservationFile::factory()->create(array_merge($attributes, [
            'disk' => 'public',
        ]));

        $response = $this->actingAs($reservation->doctor->user, 'sanctum')
            ->postJson($this->reviewPath($medicalRequest))
            ->assertOk()
            ->assertJsonPath('data.medical_request.status', ReservationMedicalRequestStatus::InReview->value)
            ->assertJsonCount(1, 'data.files')
            ->assertJsonPath('data.files.0.public_id', $clean->public_id)
            ->assertJsonPath('data.files.0.available', true);

        $response
            ->assertJsonMissing(['public_id' => $quarantined->public_id])
            ->assertJsonMissingPath('data.files.0.disk')
            ->assertJsonMissingPath('data.files.0.path')
            ->assertJsonMissingPath('data.files.0.original_filename')
            ->assertJsonMissingPath('data.files.0.safe_filename')
            ->assertJsonMissingPath('data.files.0.checksum_sha256')
            ->assertJsonMissingPath('data.files.0.scan_status')
            ->assertJsonMissingPath('data.files.0.scanned_at')
            ->assertJsonMissingPath('data.files.0.retention_until')
            ->assertJsonMissingPath('data.files.0.uploaded_by');
    }

    public function test_assigned_doctor_downloads_only_clean_private_active_retained_file(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;
        $attributes = [
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ];
        $clean = ReservationFile::factory()->create($attributes);
        Storage::disk('private')->put($clean->path, 'clean fixture');
        $clean->forceFill(['checksum_sha256' => hash('sha256', 'clean fixture'), 'size_bytes' => strlen('clean fixture')])->save();

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->get($this->downloadPath($medicalRequest, $clean), ['Accept' => 'application/json'])
            ->assertOk();

        foreach ([
            ReservationFileScanStatus::Quarantined,
            ReservationFileScanStatus::Infected,
            ReservationFileScanStatus::Failed,
        ] as $scanStatus) {
            $file = ReservationFile::factory()->create(array_merge($attributes, [
                'scan_status' => $scanStatus,
                'scanned_at' => $scanStatus === ReservationFileScanStatus::Quarantined ? null : now(),
            ]));
            Storage::disk('private')->put($file->path, 'blocked fixture');

            $this->actingAs($reservation->doctor->user, 'sanctum')
                ->get($this->downloadPath($medicalRequest, $file), ['Accept' => 'application/json'])
                ->assertUnprocessable()
                ->assertJsonPath('errors.file.0', 'file_unavailable');
        }

        $expired = ReservationFile::factory()->create(array_merge($attributes, [
            'retention_until' => now()->subMinute(),
        ]));
        Storage::disk('private')->put($expired->path, 'expired fixture');

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->get($this->downloadPath($medicalRequest, $expired), ['Accept' => 'application/json'])
            ->assertUnprocessable();
    }

    public function test_wrong_actor_and_cross_request_file_receive_no_medical_content(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;
        $file = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ]);
        Storage::disk('private')->put($file->path, 'private contents');

        $this->actingAs(User::factory()->doctor()->create(), 'sanctum')
            ->postJson($this->reviewPath($medicalRequest))
            ->assertNotFound();

        foreach ([
            $reservation->user,
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ] as $actor) {
            $this->actingAs($actor, 'sanctum')
                ->get($this->downloadPath($medicalRequest, $file), ['Accept' => 'application/json'])
                ->assertForbidden();
        }

        $foreignRequest = ReservationMedicalRequest::factory()->create([
            'reservation_id' => $reservation->id,
        ]);

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->get($this->downloadPath($foreignRequest, $file), ['Accept' => 'application/json'])
            ->assertNotFound();
    }

    private function reviewPath(ReservationMedicalRequest $medicalRequest): string
    {
        return '/api/doctor/reservations/'.$medicalRequest->reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/review';
    }

    private function downloadPath(
        ReservationMedicalRequest $medicalRequest,
        ReservationFile $file,
    ): string {
        return '/api/doctor/reservations/'.$medicalRequest->reservation->public_id
            .'/medical-requests/'.$medicalRequest->public_id
            .'/files/'.$file->public_id
            .'/download';
    }
}
