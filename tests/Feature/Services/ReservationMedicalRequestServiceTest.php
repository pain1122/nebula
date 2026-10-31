<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Enums\ReservationMedicalRequestStatus;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ReservationMedicalRequestService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ReservationMedicalRequestServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigned_doctor_creates_a_locked_server_owned_request_with_minimal_audit(): void
    {
        config()->set('medical.records_retention_days', 730);
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $doctor = $reservation->doctor->user;
        $dueAt = now()->addWeek();

        $medicalRequest = app(ReservationMedicalRequestService::class)->create(
            $this->requestAs($doctor),
            $doctor,
            $reservation,
            'lab_result',
            'Complete blood count',
            'Upload every page, including identifying medical details.',
            $dueAt,
        );

        $this->assertSame($reservation->id, $medicalRequest->reservation_id);
        $this->assertSame($doctor->id, $medicalRequest->requested_by);
        $this->assertSame(ReservationMedicalRequestStatus::Open, $medicalRequest->status);
        $this->assertTrue($medicalRequest->due_at->equalTo($dueAt->startOfSecond()));
        $this->assertSame(730, (int) now()->startOfDay()->diffInDays($medicalRequest->retention_until->startOfDay()));

        $event = AuditEvent::query()->sole();
        $this->assertSame('reservation_medical_request.created', $event->action);
        $this->assertSame('critical', $event->risk_level);
        $this->assertEqualsCanonicalizing([
            'attachment_policy_revision',
            'request_public_id',
            'reservation_public_id',
            'status',
            'due_at',
            'retention_until',
        ], array_keys($event->after));
        $encodedAudit = json_encode($event->after, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('Complete blood count', $encodedAudit);
        $this->assertStringNotContainsString('identifying medical details', $encodedAudit);
    }

    public function test_patient_unassigned_doctor_and_marketplace_admins_cannot_create_requests(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $actors = [
            $reservation->user,
            User::factory()->doctor()->create(),
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ];

        foreach ($actors as $actor) {
            try {
                $this->create($actor, $reservation);
                $this->fail('An unauthorized actor created a medical request.');
            } catch (AuthorizationException) {
                $this->assertDatabaseCount('reservation_medical_requests', 0);
            }
        }

        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_only_confirmed_or_completed_reservations_accept_a_request(): void
    {
        foreach ([
            ReservationStatus::Pending,
            ReservationStatus::Cancelled,
            ReservationStatus::Expired,
        ] as $status) {
            $reservation = Reservation::factory()->create(['status' => $status]);

            try {
                $this->create($reservation->doctor->user, $reservation);
                $this->fail("A {$status->value} reservation accepted a medical request.");
            } catch (DomainException) {
                $this->assertDatabaseMissing('reservation_medical_requests', [
                    'reservation_id' => $reservation->id,
                ]);
            }
        }

        $completed = Reservation::factory()->create(['status' => ReservationStatus::Completed]);
        $this->create($completed->doctor->user, $completed);

        $this->assertDatabaseHas('reservation_medical_requests', [
            'reservation_id' => $completed->id,
            'status' => ReservationMedicalRequestStatus::Open->value,
        ]);
    }

    public function test_audit_failure_rolls_back_request_creation(): void
    {
        $reservation = Reservation::factory()->create([
            'status' => ReservationStatus::Confirmed,
        ]);
        $doctor = $reservation->doctor->user;
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            $this->create($doctor, $reservation);
            $this->fail('Audit failure must escape medical request creation.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertDatabaseCount('reservation_medical_requests', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_assigned_doctor_starts_review_only_when_a_clean_active_retained_file_exists(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;
        $fileAttributes = [
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ];
        $clean = ReservationFile::factory()->create($fileAttributes);
        ReservationFile::factory()->create(array_merge($fileAttributes, [
            'scan_status' => ReservationFileScanStatus::Quarantined,
            'scanned_at' => null,
        ]));
        ReservationFile::factory()->create(array_merge($fileAttributes, [
            'scan_status' => ReservationFileScanStatus::Infected,
        ]));
        ReservationFile::factory()->create(array_merge($fileAttributes, [
            'retention_until' => now()->subMinute(),
        ]));
        ReservationFile::factory()->create(array_merge($fileAttributes, [
            'disk' => 'public',
        ]));
        $archived = ReservationFile::factory()->create($fileAttributes);
        $archived->delete();

        $review = app(ReservationMedicalRequestService::class)->startReview(
            $this->requestAs($reservation->doctor->user),
            $reservation->doctor->user,
            $medicalRequest,
        );

        $this->assertSame(ReservationMedicalRequestStatus::InReview, $review->status);
        $this->assertNotNull($review->reviewed_at);
        $this->assertSame([$clean->id], $review->files()->availableForMedicalReview()->pluck('id')->all());

        $event = AuditEvent::query()->sole();
        $this->assertSame('reservation_medical_request.review_started', $event->action);
        $this->assertEqualsCanonicalizing([
            'request_public_id',
            'reservation_public_id',
            'status',
            'due_at',
            'reviewed_at',
            'closed_at',
            'retention_until',
            'attachment_policy_revision',
        ], array_keys($event->after));
    }

    public function test_review_is_assigned_doctor_only_requires_an_available_file_and_is_idempotent(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;

        foreach ([
            $reservation->user,
            User::factory()->doctor()->create(),
            User::factory()->admin()->create(),
            User::factory()->rootAdmin()->create(),
        ] as $actor) {
            try {
                app(ReservationMedicalRequestService::class)->startReview(
                    $this->requestAs($actor),
                    $actor,
                    $medicalRequest,
                );
                $this->fail('An unauthorized actor started medical review.');
            } catch (AuthorizationException) {
                $this->assertSame(ReservationMedicalRequestStatus::Open, $medicalRequest->fresh()->status);
            }
        }

        try {
            app(ReservationMedicalRequestService::class)->startReview(
                $this->requestAs($reservation->doctor->user),
                $reservation->doctor->user,
                $medicalRequest,
            );
            $this->fail('Review started without an available file.');
        } catch (DomainException) {
            $this->assertSame(ReservationMedicalRequestStatus::Open, $medicalRequest->fresh()->status);
        }

        ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ]);
        $service = app(ReservationMedicalRequestService::class);
        $first = $service->startReview(
            $this->requestAs($reservation->doctor->user),
            $reservation->doctor->user,
            $medicalRequest,
        );
        $second = $service->startReview(
            $this->requestAs($reservation->doctor->user),
            $reservation->doctor->user,
            $first,
        );

        $this->assertTrue($first->reviewed_at->equalTo($second->reviewed_at));
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_medical_request.review_started')->count());
    }

    public function test_review_audit_failure_rolls_back_state_and_timestamp(): void
    {
        $medicalRequest = ReservationMedicalRequest::factory()->create();
        $reservation = $medicalRequest->reservation;
        ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $medicalRequest->id,
            'uploaded_by' => $reservation->user_id,
        ]);
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            app(ReservationMedicalRequestService::class)->startReview(
                $this->requestAs($reservation->doctor->user),
                $reservation->doctor->user,
                $medicalRequest,
            );
            $this->fail('Audit failure must escape review.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertSame(ReservationMedicalRequestStatus::Open, $medicalRequest->fresh()->status);
        $this->assertNull($medicalRequest->fresh()->reviewed_at);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function create(User $actor, Reservation $reservation)
    {
        return app(ReservationMedicalRequestService::class)->create(
            $this->requestAs($actor),
            $actor,
            $reservation,
            'lab_result',
            'Complete blood count',
            'Upload every page.',
            now()->addWeek(),
        );
    }

    private function requestAs(User $user): Request
    {
        $request = Request::create('/api/doctor/reservations/1/medical-requests', 'POST');
        $request->setUserResolver(fn (): User => $user);

        return $request;
    }
}
