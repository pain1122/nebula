<?php

namespace Tests\Feature\Api;

use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;
use RuntimeException;

/** Reuses the mandatory no-env/network/SQLite guard, never the live application. */
class AdminMedicalManagementContractTest extends AdminReservationPanelContractTest
{
    private function admin(): User
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum')->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $admin;
    }

    public function test_medical_read_roles_filters_and_redaction(): void
    {
        $row = ReservationMedicalRequest::factory()->create();
        $other = ReservationMedicalRequest::factory()->create();
        ReservationFile::factory()->create(['medical_request_id' => $row->id, 'reservation_id' => $row->reservation_id, 'scan_status' => 'quarantined']);
        foreach ([User::factory()->patient()->create(), User::factory()->doctor()->create()] as $user) {
            $this->actingAs($user, 'sanctum')->getJson('/api/admin/medical-requests')->assertForbidden();
        }
        $this->admin();
        $this->getJson('/api/admin/medical-requests?'.http_build_query([
            'doctor_id' => $row->reservation->doctor_profile_id, 'user_id' => $row->reservation->user_id,
            'reservation_id' => $row->reservation_id, 'status' => 'open', 'stage' => 'awaiting_checks',
        ]))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.public_id', $row->public_id)
            ->assertJsonPath('data.0.awaiting_checks_count', 1)->assertJsonPath('data.0.eligible_count', 0);
        $this->getJson('/api/admin/medical-requests/'.$row->public_id)->assertOk()->assertJsonCount(0, 'data.files')
            ->assertJsonMissingPath('data.medical_request.attachment_policy')->assertJsonMissingPath('data.medical_request.path');
        $this->getJson('/api/admin/medical-requests?user_id[]=1')->assertUnprocessable();
        $this->getJson('/api/admin/medical-requests?from=2026-10-12&to=2026-10-11')->assertUnprocessable();
        $this->getJson('/api/admin/medical-requests?stage=ready')->assertOk()->assertJsonCount(0, 'data');
        $this->assertNotSame($other->public_id, $row->public_id);
    }

    public function test_admin_creation_keeps_actual_actor_policy_reason_and_recent_password(): void
    {
        $admin = $this->admin();
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        $data = ['reservation_id' => $reservation->id, 'title' => 'Synthetic admin request', 'maximum_bytes' => 1024, 'reason' => 'Synthetic oversight'];
        $this->withSession(['auth.password_confirmed_at' => 0])->postJson('/api/admin/medical-requests', $data)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()])->postJson('/api/admin/medical-requests', $data)->assertCreated();
        $row = ReservationMedicalRequest::firstOrFail();
        $this->assertSame($admin->id, $row->requested_by);
        $this->assertNotNull($row->attachment_policy_revision);
        $audit = DB::table('audit_events')->where('action', 'admin.medical_request.created')->first();
        $this->assertSame($admin->id, $audit->actor_user_id);
        $this->assertSame('Synthetic oversight', $audit->reason);
        $this->postJson('/api/admin/medical-requests', $data + ['instructions' => str_repeat('x', 5001)])->assertUnprocessable();
    }

    public function test_admin_review_reports_amendment_and_immutable_authorship(): void
    {
        $admin = $this->admin();
        $row = ReservationMedicalRequest::factory()->create();
        $base = '/api/admin/medical-requests/'.$row->public_id;
        $this->postJson($base.'/review', ['reason' => 'Synthetic review'])->assertUnprocessable();
        ReservationFile::factory()->create(['medical_request_id' => $row->id, 'reservation_id' => $row->reservation_id]);
        $this->postJson($base.'/review', ['reason' => 'Synthetic review'])->assertOk();
        $draft = $this->postJson($base.'/reports', ['body' => 'Synthetic plain text <script>', 'reason' => 'Synthetic draft'])
            ->assertOk()->json('data.public_id');
        $this->assertSame($admin->id, ReservationReport::where('public_id', $draft)->first()->author_user_id);
        $this->postJson($base.'/reports', ['body' => 'Synthetic edited report', 'draft_id' => $draft, 'expected_body' => 'Synthetic plain text <script>', 'reason' => 'Synthetic edit'])->assertOk();
        $this->postJson($base.'/reports', ['body' => 'Stale overwrite', 'draft_id' => $draft, 'expected_body' => 'Synthetic plain text <script>', 'reason' => 'Synthetic stale edit'])->assertStatus(409);
        $this->postJson($base.'/reports/'.$draft.'/publish', ['reason' => 'Synthetic publication'])->assertOk();
        $this->assertSame('completed', $row->fresh()->status->value);
        $this->postJson($base.'/reports', ['body' => 'Overwrite', 'draft_id' => $draft, 'reason' => 'Synthetic'])->assertUnprocessable();
        $amend = $this->postJson($base.'/reports', ['body' => 'Synthetic amendment', 'supersedes_report_id' => $draft, 'reason' => 'Synthetic amendment'])
            ->assertOk()->json('data.public_id');
        $this->postJson($base.'/reports/'.$amend.'/publish', ['reason' => 'Synthetic publication'])->assertOk();
        $this->assertSame(2, ReservationReport::where('status', 'published')->count());
        $this->getJson($base)->assertOk()->assertJsonCount(2, 'data.reports');
        $other = ReservationMedicalRequest::factory()->create();
        $this->postJson('/api/admin/medical-requests/'.$other->public_id.'/reports/'.$draft.'/publish', ['reason' => 'Synthetic'])->assertNotFound();
        $this->postJson('/api/admin/medical-requests/'.$other->public_id.'/reports', ['draft_id' => $amend, 'expected_body' => 'Synthetic amendment', 'body' => 'Cross request', 'reason' => 'Synthetic'])->assertNotFound();
    }

    public function test_other_authors_and_ordinary_doctor_routes_stay_separate(): void
    {
        $this->admin();
        $row = ReservationMedicalRequest::factory()->create(['status' => 'in_review', 'reviewed_at' => now()]);
        $report = ReservationReport::factory()->create(['medical_request_id' => $row->id, 'reservation_id' => $row->reservation_id]);
        $this->postJson('/api/admin/medical-requests/'.$row->public_id.'/reports/'.$report->public_id.'/publish', ['reason' => 'Synthetic'])->assertForbidden();
        $this->postJson('/api/doctor/reservations/'.$row->reservation->public_id.'/medical-requests', [])->assertForbidden();
        $row->forceFill(['retention_until' => now()->subSecond()])->save();
        $this->getJson('/api/admin/medical-requests/'.$row->public_id)->assertOk()->assertJsonCount(0, 'data.reports');
        $this->postJson('/api/admin/medical-requests/'.$row->public_id.'/reports', ['body' => 'Expired', 'reason' => 'Synthetic'])->assertUnprocessable();
    }

    public function test_admin_download_preserves_integrity_quarantine_binding_retention_and_access_audit(): void
    {
        $admin = $this->admin();
        Storage::fake('private');
        $row = ReservationMedicalRequest::factory()->create();
        $bytes = '%PDF-1.4 synthetic download only';
        $file = ReservationFile::factory()->create([
            'medical_request_id' => $row->id, 'reservation_id' => $row->reservation_id,
            'size_bytes' => strlen($bytes), 'checksum_sha256' => hash('sha256', $bytes),
        ]);
        Storage::disk('private')->put($file->path, $bytes);
        $path = '/api/admin/medical-requests/'.$row->public_id.'/files/'.$file->public_id.'/download';
        $this->getJson($path)->assertOk()->assertStreamedContent($bytes)->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame($admin->id, DB::table('audit_events')->where('action', 'reservation_medical_file.accessed')->first()->actor_user_id);
        Storage::disk('private')->put($file->path, str_repeat('x', strlen($bytes)));
        $this->getJson($path)->assertUnprocessable()->assertJsonMissingPath('data.path');
        Storage::disk('private')->put($file->path, $bytes);
        $file->forceFill(['scan_status' => 'quarantined'])->save();
        $this->getJson($path)->assertUnprocessable();
        $other = ReservationMedicalRequest::factory()->create();
        $this->getJson('/api/admin/medical-requests/'.$other->public_id.'/files/'.$file->public_id.'/download')->assertNotFound();
        $row->forceFill(['retention_until' => now()->subSecond()])->save();
        $this->getJson($path)->assertForbidden();
        $this->assertSame(1, DB::table('audit_events')->where('action', 'reservation_medical_file.accessed')->count());
    }

    public function test_admin_clinical_creation_rolls_back_when_audit_fails(): void
    {
        $this->admin();
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit failure'));
        });
        $this->postJson('/api/admin/medical-requests', ['reservation_id' => $reservation->id, 'title' => 'Synthetic rollback', 'maximum_bytes' => 1024, 'reason' => 'Synthetic rollback'])->assertStatus(500);
        $this->assertSame(0, ReservationMedicalRequest::count());
        $this->assertSame(0, DB::table('audit_events')->count());
    }
}
