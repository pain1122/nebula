<?php

namespace Tests\Feature\Database;

use App\Enums\ReservationMedicalRequestStatus;
use App\Enums\ReservationReportStatus;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReservationMedicalRequestReportSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_medical_request_report_and_file_link_have_retention_safe_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('reservation_medical_requests', [
            'public_id', 'reservation_id', 'requested_by', 'request_type', 'title', 'instructions',
            'status', 'due_at', 'reviewed_at', 'closed_at', 'retention_until', 'archived_by',
            'archive_reason', 'deleted_at',
        ]));
        $this->assertTrue(Schema::hasColumn('reservation_files', 'medical_request_id'));
        $this->assertTrue(Schema::hasColumns('reservation_reports', [
            'public_id', 'reservation_id', 'medical_request_id', 'author_user_id',
            'author_name_snapshot', 'status', 'body', 'published_at', 'supersedes_report_id',
            'retention_until', 'archived_by', 'archive_reason', 'deleted_at',
        ]));
        $this->assertFalse(Schema::hasColumn('reservation_reports', 'path'));
        $this->assertFalse(Schema::hasColumn('reservation_reports', 'internal_notes'));
    }

    public function test_models_cast_states_and_exclude_owned_lifecycle_and_publication_facts_from_mass_assignment(): void
    {
        $request = new ReservationMedicalRequest;
        $request->fill([
            'reservation_id' => 123,
            'requested_by' => 456,
            'request_type' => 'lab_result',
            'title' => 'CBC result',
            'instructions' => 'Upload the complete report.',
            'status' => ReservationMedicalRequestStatus::Completed->value,
            'reviewed_at' => now(),
            'closed_at' => now(),
            'retention_until' => now()->addYear(),
            'archived_by' => 789,
        ]);

        $this->assertNull($request->reservation_id);
        $this->assertNull($request->requested_by);
        $this->assertSame(ReservationMedicalRequestStatus::Open, $request->status);
        $this->assertNull($request->reviewed_at);
        $this->assertNull($request->closed_at);
        $this->assertNull($request->retention_until);
        $this->assertNull($request->archived_by);
        $this->assertSame('lab_result', $request->request_type);

        $report = new ReservationReport;
        $report->fill([
            'reservation_id' => 123,
            'medical_request_id' => 456,
            'author_user_id' => 789,
            'author_name_snapshot' => 'Untrusted author',
            'status' => ReservationReportStatus::Published->value,
            'body' => 'Patient-visible outcome.',
            'published_at' => now(),
            'supersedes_report_id' => 987,
            'retention_until' => now()->addYear(),
            'archived_by' => 654,
        ]);

        $this->assertNull($report->reservation_id);
        $this->assertNull($report->medical_request_id);
        $this->assertNull($report->author_user_id);
        $this->assertNull($report->author_name_snapshot);
        $this->assertSame(ReservationReportStatus::Draft, $report->status);
        $this->assertNull($report->published_at);
        $this->assertNull($report->supersedes_report_id);
        $this->assertNull($report->retention_until);
        $this->assertNull($report->archived_by);
        $this->assertSame('Patient-visible outcome.', $report->body);

        $file = new ReservationFile;
        $file->fill([
            'reservation_id' => 123,
            'medical_request_id' => 456,
            'uploaded_by' => 789,
            'label' => 'Permitted label',
        ]);

        $this->assertNull($file->reservation_id);
        $this->assertNull($file->medical_request_id);
        $this->assertNull($file->uploaded_by);
        $this->assertSame('Permitted label', $file->label);
    }

    public function test_file_and_report_request_links_cannot_cross_reservations(): void
    {
        $firstReservation = Reservation::factory()->create();
        $secondReservation = Reservation::factory()->create();
        $request = $this->medicalRequest($firstReservation);

        try {
            ReservationFile::factory()->create([
                'reservation_id' => $secondReservation->id,
                'medical_request_id' => $request->id,
            ]);
            $this->fail('A file must not link to another reservation\'s medical request.');
        } catch (QueryException) {
            $this->assertDatabaseCount('reservation_files', 0);
        }

        $this->expectException(QueryException::class);
        $this->report($secondReservation, $request);
    }

    public function test_supersession_cannot_cross_request_history_and_restricts_physical_deletion(): void
    {
        $firstReservation = Reservation::factory()->create();
        $firstRequest = $this->medicalRequest($firstReservation);
        $published = $this->report(
            $firstReservation,
            $firstRequest,
            ReservationReportStatus::Published,
        );

        $amendment = $this->report(
            $firstReservation,
            $firstRequest,
            ReservationReportStatus::Draft,
            $published,
        );
        $this->assertTrue($amendment->supersedes->is($published));

        try {
            DB::table('reservation_reports')->where('id', $published->id)->delete();
            $this->fail('A superseded published report must remain physically retained.');
        } catch (QueryException) {
            $this->assertDatabaseHas('reservation_reports', ['id' => $published->id]);
        }

        $secondReservation = Reservation::factory()->create();
        $secondRequest = $this->medicalRequest($secondReservation);

        $this->expectException(QueryException::class);
        $this->report(
            $secondReservation,
            $secondRequest,
            ReservationReportStatus::Draft,
            $published,
        );
    }

    public function test_published_report_requires_complete_publication_facts_and_is_immutable(): void
    {
        $reservation = Reservation::factory()->create();
        $request = $this->medicalRequest($reservation);

        $invalid = new ReservationReport;
        $invalid->forceFill([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $request->id,
            'author_user_id' => $request->requested_by,
            'author_name_snapshot' => 'Assigned doctor',
            'status' => ReservationReportStatus::Published,
            'body' => 'Missing publication timestamp.',
        ]);

        try {
            $invalid->save();
            $this->fail('Published reports require a publication timestamp.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_reports', 0);
        }

        $published = $this->report($reservation, $request, ReservationReportStatus::Published);
        $this->assertSame(ReservationReportStatus::Published, $published->status);

        try {
            $published->forceFill(['body' => 'Overwritten outcome.'])->save();
            $this->fail('Published reports must not be updated.');
        } catch (DomainException) {
            $this->assertSame('Published patient outcome.', $published->fresh()->body);
        }

        $this->expectException(DomainException::class);
        $published->fresh()->delete();
    }

    public function test_request_state_timestamps_and_report_predecessor_must_be_consistent(): void
    {
        $reservation = Reservation::factory()->create();
        $request = $this->medicalRequest($reservation);

        try {
            $request->forceFill([
                'status' => ReservationMedicalRequestStatus::Completed,
                'closed_at' => now(),
            ])->save();
            $this->fail('A completed request requires a review timestamp.');
        } catch (DomainException) {
            $this->assertSame(
                ReservationMedicalRequestStatus::Open,
                $request->fresh()->status,
            );
        }

        $draft = $this->report($reservation, $request);

        $this->expectException(DomainException::class);
        $this->report(
            $reservation,
            $request,
            ReservationReportStatus::Draft,
            $draft,
        );
    }

    public function test_report_history_restricts_physical_request_and_author_deletion(): void
    {
        $reservation = Reservation::factory()->create();
        $request = $this->medicalRequest($reservation);
        $author = User::factory()->create();
        $this->report($reservation, $request, ReservationReportStatus::Published, author: $author);

        try {
            DB::table('reservation_medical_requests')->where('id', $request->id)->delete();
            $this->fail('A request with report history must remain physically retained.');
        } catch (QueryException) {
            $this->assertDatabaseHas('reservation_medical_requests', ['id' => $request->id]);
        }

        $this->expectException(QueryException::class);
        $author->delete();
    }

    private function medicalRequest(Reservation $reservation): ReservationMedicalRequest
    {
        $request = new ReservationMedicalRequest;
        $request->forceFill([
            'reservation_id' => $reservation->id,
            'requested_by' => $reservation->doctor->user_id,
            'request_type' => 'lab_result',
            'title' => 'Requested laboratory result',
            'instructions' => 'Upload one complete PDF.',
            'status' => ReservationMedicalRequestStatus::Open,
            'due_at' => now()->addWeek(),
            'retention_until' => now()->addYear(),
        ])->save();

        return $request;
    }

    private function report(
        Reservation $reservation,
        ReservationMedicalRequest $request,
        ReservationReportStatus $status = ReservationReportStatus::Draft,
        ?ReservationReport $supersedes = null,
        ?User $author = null,
    ): ReservationReport {
        $report = new ReservationReport;
        $report->forceFill([
            'reservation_id' => $reservation->id,
            'medical_request_id' => $request->id,
            'author_user_id' => $author?->id ?? $request->requested_by,
            'author_name_snapshot' => 'Assigned doctor',
            'status' => $status,
            'body' => 'Published patient outcome.',
            'published_at' => $status === ReservationReportStatus::Published ? now() : null,
            'supersedes_report_id' => $supersedes?->id,
            'retention_until' => now()->addYear(),
        ])->save();

        return $report;
    }
}
