<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Jobs\ScanReservationFile;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ClamdScanner;
use App\Services\MedicalContentValidator;
use App\Services\ReservationFileService;
use App\Support\MedicalScanVerdict;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Fixtures\SyntheticMedicalFiles;
use Tests\TestCase;

class MedicalContentReleaseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_clean_antivirus_result_cannot_release_malformed_content_or_create_a_clean_audit(): void
    {
        $file = $this->upload("%PDF-1.4\n% malformed synthetic\n%%EOF\n");
        $digest = $file->checksum_sha256;
        try {
            app(ReservationFileService::class)->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $digest);
            $this->fail('Antivirus clean cannot bypass content validation.');
        } catch (DomainException $exception) {
            $this->assertSame('Medical content validation did not pass; file access remains blocked.', $exception->getMessage());
        }
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
        $this->assertNull($file->fresh()->scanned_at);
        $this->assertSame($digest, hash('sha256', Storage::disk('private')->get($file->path)));
        $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        $this->assertFalse($file->fresh()->newQuery()->availableForMedicalReview()->whereKey($file->id)->exists());
        $this->assertDatabaseCount('jobs', 0);
    }

    public function test_invalid_policy_cannot_disable_content_validation(): void
    {
        $file = $this->upload(SyntheticMedicalFiles::pdf());
        config(['medical_content.enabled' => false]);
        $this->expectException(DomainException::class);
        try {
            app(ReservationFileService::class)->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        } finally {
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
        }
    }

    public function test_infected_result_remains_blocked_without_running_a_content_parser(): void
    {
        $this->mock(MedicalContentValidator::class)->shouldNotReceive('validate');
        $file = $this->upload(SyntheticMedicalFiles::pdf());
        $result = app(ReservationFileService::class)->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Infected, $file->checksum_sha256);
        $this->assertSame(ReservationFileScanStatus::Infected, $result->scan_status);
        $this->assertArrayNotHasKey('content_policy_revision', AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->sole()->after);
    }

    public function test_job_retries_content_failure_then_records_failed_without_releasing_the_file(): void
    {
        $file = $this->upload("%PDF-1.4\n% malformed synthetic\n%%EOF\n");
        config(['medical.scanner.enabled' => true]);
        $scanner = $this->mock(ClamdScanner::class);
        $scanner->shouldReceive('scan')->once()->andReturn(new MedicalScanVerdict(
            ReservationFileScanStatus::Clean, $file->checksum_sha256, '1.5.4', '999999', now()->toIso8601String(),
        ));
        $job = new ScanReservationFile($file->public_id, $file->checksum_sha256);
        try {
            $job->handle($scanner, app(ReservationFileService::class));
            $this->fail('Content failure must not release a clean-antivirus file.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Medical scan could not complete; file access remains blocked.', $exception->getMessage());
        }
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
        $job->failed(new RuntimeException('synthetic parser failure'));
        $this->assertSame(ReservationFileScanStatus::Failed, $file->fresh()->scan_status);
        $this->assertFalse($file->newQuery()->availableForMedicalReview()->whereKey($file->id)->exists());
    }

    private function upload(string $content): \App\Models\ReservationFile
    {
        $patient = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $patient->id]);

        return app(ReservationFileService::class)->upload(
            Request::create('/upload', 'POST'), $patient, $reservation,
            UploadedFile::fake()->createWithContent('synthetic.pdf', $content), retentionUntil: now()->addYear(),
        );
    }
}
