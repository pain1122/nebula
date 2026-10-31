<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Jobs\MaterializeDoctorVisitSlots;
use App\Jobs\ScanReservationFile;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ClamdScanner;
use App\Services\ReservationFileService;
use App\Support\MedicalScanVerdict;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class MedicalScanJobTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        config(['medical.scanner.enabled' => true]);
    }

    public function test_upload_enqueues_an_encrypted_job_only_on_the_medical_queue(): void
    {
        $file = $this->upload();
        $row = DB::table('jobs')->sole();
        $this->assertSame('medical-scan', $row->queue);
        $payload = json_decode($row->payload, true, flags: JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString($file->public_id, $row->payload);
        $this->assertStringNotContainsString($file->checksum_sha256, $row->payload);
        $this->assertStringNotContainsString('synthetic-report.pdf', $row->payload);
        $command = unserialize(app('encrypter')->decrypt($payload['data']['command']));
        $this->assertInstanceOf(ScanReservationFile::class, $command);
        $this->assertSame('medical-scan', $command->connection);
        $this->assertSame('medical-scan', $command->queue);
        $this->assertSame($file->checksum_sha256, $command->checksumSha256);
        $this->assertFalse($command->afterCommit);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->scan_status);
    }

    public function test_disabled_scanning_does_not_dispatch_or_allow_download(): void
    {
        config(['medical.scanner.enabled' => false]);
        $file = $this->upload();
        $this->assertDatabaseCount('jobs', 0);
        $this->expectException(DomainException::class);
        app(ReservationFileService::class)->download(Request::create('/download'), $file->reservation->user, $file);
    }

    public function test_actual_database_queue_delivery_processes_only_the_scan_job(): void
    {
        $unrelatedId = Queue::connection('database')->push(new MaterializeDoctorVisitSlots, '', 'default');
        $file = $this->upload();
        $this->scanner($file, ReservationFileScanStatus::Clean);
        $delivery = Queue::connection('medical-scan')->pop('medical-scan');
        $this->assertNotNull($delivery);
        $delivery->fire();
        $this->assertSame(ReservationFileScanStatus::Clean, $file->fresh()->scan_status);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $this->assertDatabaseHas('jobs', ['id' => $unrelatedId, 'queue' => 'default', 'attempts' => 0, 'reserved_at' => null]);
    }

    public function test_dispatch_failure_rolls_back_rows_audit_and_uploaded_bytes(): void
    {
        Queue::shouldReceive('connection')->once()->with('medical-scan')->andThrow(new RuntimeException('synthetic dispatch failure'));
        try {
            $this->upload();
            $this->fail('Dispatch failure must roll back the upload.');
        } catch (RuntimeException) {
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertDatabaseCount('audit_events', 0);
            $this->assertDatabaseCount('jobs', 0);
            $this->assertSame([], Storage::disk('private')->allFiles());
        }
    }

    public function test_unsafe_queue_configuration_cannot_enqueue_on_default_or_sync_connections(): void
    {
        foreach (['driver' => 'sync', 'queue' => 'default', 'table' => 'other_jobs', 'after_commit' => true, 'connection' => 'other_database', 'retry_after' => 90] as $key => $value) {
            $original = config('queue.connections.medical-scan');
            config(['queue.connections.medical-scan.'.$key => $value]);
            try {
                $this->upload();
                $this->fail('Unsafe scan queue configuration must reject upload.');
            } catch (DomainException) {
                $this->assertDatabaseCount('reservation_files', 0);
                $this->assertDatabaseCount('jobs', 0);
                $this->assertSame([], Storage::disk('private')->allFiles());
            } finally {
                config(['queue.connections.medical-scan' => $original]);
            }
        }
    }

    public function test_clean_scan_records_provenance_and_duplicate_delivery_does_not_scan_again(): void
    {
        $file = $this->upload();
        $scanner = $this->scanner($file, ReservationFileScanStatus::Clean);
        $job = new ScanReservationFile($file->public_id, $file->checksum_sha256);
        $job->handle($scanner, app(ReservationFileService::class));
        $job->handle($scanner, app(ReservationFileService::class));
        $this->assertSame(ReservationFileScanStatus::Clean, $file->fresh()->scan_status);
        $event = AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->sole();
        $this->assertSame('clamav', $event->after['scanner_engine']);
        $this->assertSame('1.5.4', $event->after['scanner_version']);
        $this->assertSame('999999', $event->after['scanner_database_version']);
        $this->assertSame($file->checksum_sha256, $event->after['scan_checksum_sha256']);
        $this->assertSame(\App\Support\MedicalContentPolicy::current()->revision, $event->after['content_policy_revision']);
        $this->assertSame('qpdf-12.4.2/medical-v1', $event->after['content_validator']);
        $this->assertArrayNotHasKey('path', $event->after);
        $this->assertArrayNotHasKey('original_filename', $event->after);
    }

    public function test_infected_scan_blocks_download_and_exhausted_failure_stays_unavailable(): void
    {
        $file = $this->upload();
        (new ScanReservationFile($file->public_id, $file->checksum_sha256))->handle($this->scanner($file, ReservationFileScanStatus::Infected), app(ReservationFileService::class));
        $this->assertSame(ReservationFileScanStatus::Infected, $file->fresh()->scan_status);
        $failed = $this->upload();
        (new ScanReservationFile($failed->public_id, $failed->checksum_sha256))->failed(new RuntimeException('private raw scanner details'));
        $this->assertSame(ReservationFileScanStatus::Failed, $failed->fresh()->scan_status);
        foreach ([$file, $failed] as $blocked) {
            try {
                app(ReservationFileService::class)->download(Request::create('/download'), $blocked->reservation->user, $blocked);
                $this->fail('An unsafe file must not be downloadable.');
            } catch (DomainException) {
                $this->assertTrue(true);
            }
        }
    }

    public function test_changed_or_missing_bytes_cannot_reach_the_engine_or_clean_state(): void
    {
        $scanner = $this->mock(ClamdScanner::class);
        $scanner->shouldNotReceive('scan');
        foreach (['changed', 'missing'] as $case) {
            $file = $this->upload();
            if ($case === 'changed') {
                Storage::disk('private')->put($file->path, 'synthetic replacement');
            } else {
                Storage::disk('private')->delete($file->path);
            }
            try {
                (new ScanReservationFile($file->public_id, $file->checksum_sha256))->handle($scanner, app(ReservationFileService::class));
                $this->fail('Invalid bytes must keep access blocked.');
            } catch (RuntimeException $exception) {
                $this->assertSame('Medical scan could not complete; file access remains blocked.', $exception->getMessage());
                $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
            }
        }
    }

    public function test_scanner_error_retries_without_leaking_details_or_setting_clean(): void
    {
        $file = $this->upload();
        $scanner = $this->mock(ClamdScanner::class);
        $scanner->shouldReceive('scan')->once()->andThrow(new RuntimeException('secret/path/signature'));
        $job = new ScanReservationFile($file->public_id, $file->checksum_sha256);
        try {
            $job->handle($scanner, app(ReservationFileService::class));
            $this->fail('Scanner errors must retry while blocked.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Medical scan could not complete; file access remains blocked.', $exception->getMessage());
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
            $this->assertSame([15, 60], $job->backoff());
            $this->assertSame(3, $job->tries);
            $this->assertLessThan(config('queue.connections.medical-scan.retry_after'), $job->timeout);
        }
    }

    public function test_archive_expiry_and_changed_job_identity_skip_scanning(): void
    {
        $scanner = $this->mock(ClamdScanner::class);
        $scanner->shouldNotReceive('scan');
        $archived = $this->upload();
        $archived->delete();
        $expired = $this->upload();
        $expired->forceFill(['retention_until' => now()->subSecond()])->save();
        $mismatch = $this->upload();
        foreach ([$archived, $expired, $mismatch] as $file) {
            (new ScanReservationFile($file->public_id, $file === $mismatch ? hash('sha256', 'other version') : $file->checksum_sha256))->handle($scanner, app(ReservationFileService::class));
        }
        $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
    }

    public function test_scanner_digest_mismatch_or_audit_failure_cannot_set_clean(): void
    {
        $file = $this->upload();
        $scanner = $this->mock(ClamdScanner::class);
        $scanner->shouldReceive('scan')->once()->andReturn(new MedicalScanVerdict(ReservationFileScanStatus::Clean, hash('sha256', 'other version'), '1.5.4', '999999', now()->toIso8601String()));
        try {
            (new ScanReservationFile($file->public_id, $file->checksum_sha256))->handle($scanner, app(ReservationFileService::class));
            $this->fail('Wrong scanner identity must fail.');
        } catch (RuntimeException) {
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
        }
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andThrow(new RuntimeException('synthetic audit failure'));
        try {
            (new ScanReservationFile($file->public_id, $file->checksum_sha256))->handle($this->scanner($file, ReservationFileScanStatus::Clean), app(ReservationFileService::class));
            $this->fail('Audit failure must roll back clean acceptance.');
        } catch (RuntimeException) {
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
            $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        }
    }

    private function scanner(ReservationFile $file, ReservationFileScanStatus $status): ClamdScanner
    {
        $scanner = $this->mock(ClamdScanner::class);
        $scanner->shouldReceive('scan')->once()->withArgs(function ($stream) use ($file): bool {
            return is_resource($stream) && hash_equals($file->checksum_sha256, hash('sha256', stream_get_contents($stream)));
        })->andReturn(new MedicalScanVerdict($status, $file->checksum_sha256, '1.5.4', '999999', now()->toIso8601String()));

        return $scanner;
    }

    private function upload(): ReservationFile
    {
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);

        return app(ReservationFileService::class)->upload(Request::create('/files', 'POST'), $owner, $reservation,
            UploadedFile::fake()->createWithContent('synthetic-report.pdf', \Tests\Fixtures\SyntheticMedicalFiles::pdf()),
            retentionUntil: now()->addYear());
    }
}
