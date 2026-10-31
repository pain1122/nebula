<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationMedicalRequestStatus;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\ReservationStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationMedicalRequestApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_categories_are_owned_scoped_and_do_not_expose_editable_size_limits(): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        $path = '/api/doctor/reservations/'.$reservation->public_id.'/attachment-options';
        $this->actingAs($reservation->doctor->user, 'sanctum')->getJson($path)
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.0.key', 'document')->assertJsonPath('data.0.available', true)
            ->assertJsonPath('data.1.available', true)->assertJsonPath('data.2.available', false)
            ->assertJsonPath('data.3.available', false)->assertJsonMissingPath('data.0.max_bytes');
        $this->actingAs(User::factory()->doctor()->create(), 'sanctum')->getJson($path)->assertNotFound();
        $this->actingAs($reservation->user, 'sanctum')->getJson($path)->assertForbidden();
    }

    public function test_multiple_categories_issue_server_owned_limits_and_reject_unsupported_or_mixed_rules(): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        $path = '/api/doctor/reservations/'.$reservation->public_id.'/medical-requests';
        $payload = ['request_type' => 'attachments', 'title' => 'Synthetic documents and images', 'attachment_categories' => ['document', 'media']];
        $this->actingAs($reservation->doctor->user, 'sanctum')->postJson($path, $payload)
            ->assertCreated()->assertJsonCount(3, 'data.attachment_rules.allowed_mime_types');
        $record = ReservationMedicalRequest::query()->sole();
        $this->assertSame(10 * 1024 * 1024, $record->attachment_policy['max_bytes_by_mime']['application/pdf']);
        foreach ([['archive'], ['multimedia'], ['document', 'archive'], ['document', 'document']] as $categories) {
            $this->postJson($path, [...$payload, 'attachment_categories' => $categories])->assertUnprocessable();
        }
        $this->postJson($path, [...$payload, 'attachment_rules' => ['max_bytes' => 1]])->assertUnprocessable();
        $this->assertDatabaseCount('reservation_medical_requests', 1);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_assigned_doctor_creates_a_request_by_reservation_public_id(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $doctor = $reservation->doctor->user;

        $response = $this->actingAs($doctor, 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->public_id.'/medical-requests', [
                'request_type' => 'lab_result',
                'title' => 'Complete blood count',
                'instructions' => 'Upload every page.',
                'due_at' => now()->addWeek()->toISOString(),
            ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.reservation_public_id', $reservation->public_id)
            ->assertJsonPath('data.status', ReservationMedicalRequestStatus::Open->value)
            ->assertJsonPath('data.instructions', 'Upload every page.');

        $this->assertNotNull($response->json('data.public_id'));
        $response
            ->assertJsonMissingPath('data.reservation_id')
            ->assertJsonMissingPath('data.requested_by')
            ->assertJsonMissingPath('data.retention_until')
            ->assertJsonMissingPath('data.archived_by')
            ->assertJsonMissingPath('data.archive_reason');
    }

    public function test_request_api_rejects_client_owned_lifecycle_and_retention_facts(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->public_id.'/medical-requests', [
                'request_type' => 'lab_result',
                'title' => 'Complete blood count',
                'reservation_id' => Reservation::factory()->create()->id,
                'requested_by' => User::factory()->doctor()->create()->id,
                'status' => ReservationMedicalRequestStatus::Completed->value,
                'retention_until' => now()->addYears(20)->toISOString(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'reservation_id',
                'requested_by',
                'status',
                'retention_until',
            ]);

        $this->assertDatabaseCount('reservation_medical_requests', 0);
    }

    public function test_unassigned_doctor_receives_not_found_and_admins_and_patients_are_denied(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $payload = [
            'request_type' => 'lab_result',
            'title' => 'Complete blood count',
        ];

        $this->actingAs(User::factory()->doctor()->create(), 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->public_id.'/medical-requests', $payload)
            ->assertNotFound();

        foreach ([
            $reservation->user,
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ] as $actor) {
            $this->actingAs($actor, 'sanctum')
                ->postJson('/api/doctor/reservations/'.$reservation->public_id.'/medical-requests', $payload)
                ->assertForbidden();
        }

        $this->assertDatabaseCount('reservation_medical_requests', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_internal_numeric_reservation_id_is_not_an_api_identifier(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->postJson('/api/doctor/reservations/'.$reservation->id.'/medical-requests', [
                'request_type' => 'lab_result',
                'title' => 'Complete blood count',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('reservation_medical_requests', 0);
    }

    public function test_assigned_doctor_can_rediscover_requests_and_safe_working_details(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create([
            'status' => ReservationMedicalRequestStatus::InReview,
            'reviewed_at' => now(),
        ]);
        $reservation = $medicalRequest->reservation;
        $clean = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ]);
        $draft = ReservationReport::factory()->create([
            'medical_request_id' => $medicalRequest->id,
            'body' => 'Doctor working draft.',
        ]);
        $basePath = '/api/doctor/reservations/'.$reservation->public_id.'/medical-requests';

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->getJson($basePath)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.public_id', $medicalRequest->public_id);

        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->getJson($basePath.'/'.$medicalRequest->public_id)
            ->assertOk()
            ->assertJsonPath('data.medical_request.public_id', $medicalRequest->public_id)
            ->assertJsonPath('data.files.0.public_id', $clean->public_id)
            ->assertJsonPath('data.reports.0.public_id', $draft->public_id)
            ->assertJsonPath('data.reports.0.body', 'Doctor working draft.')
            ->assertJsonMissingPath('data.files.0.path')
            ->assertJsonMissingPath('data.files.0.scan_status');

        $this->actingAs(User::factory()->doctor()->create(), 'sanctum')
            ->getJson($basePath.'/'.$medicalRequest->public_id)
            ->assertNotFound();
    }
}
