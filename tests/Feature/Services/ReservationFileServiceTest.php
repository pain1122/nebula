<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ReservationFileService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class ReservationFileServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_private_upload_is_quarantined_guarded_checksummed_and_audited(): void
    {
        [$owner, $reservation] = $this->reservation();
        $upload = UploadedFile::fake()->create('medical-report.pdf', 12, 'application/pdf');
        $file = app(ReservationFileService::class)->upload(
            Request::create('/api/reservations/'.$reservation->public_id.'/files', 'POST'),
            $owner,
            $reservation,
            $upload,
            'Lab report',
            now()->addYear(),
        );

        $this->assertSame('private', $file->disk);
        $this->assertSame('medical', $file->classification);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->scan_status);
        $this->assertSame(64, strlen($file->checksum_sha256));
        $this->assertStringStartsWith('reservation-files/quarantine/', $file->path);
        Storage::disk('private')->assertExists($file->path);

        $event = AuditEvent::query()->sole();
        $this->assertSame('reservation_file.uploaded', $event->action);
        $this->assertArrayNotHasKey('path', $event->after);
        $this->assertArrayNotHasKey('disk', $event->after);
    }

    public function test_only_clean_authorized_private_file_can_be_downloaded(): void
    {
        [$owner, $reservation] = $this->reservation();
        $file = $this->upload($owner, $reservation);
        $service = app(ReservationFileService::class);

        try {
            $service->download(Request::create('/file', 'GET'), $owner, $file);
            $this->fail('Quarantined file must not be downloadable.');
        } catch (DomainException) {
            $this->assertDatabaseCount('audit_events', 1);
        }

        $file = $service->recordScan(
            Request::create('/internal/files/scan', 'POST'),
            $file,
            ReservationFileScanStatus::Clean,
        );
        $response = $service->download(Request::create('/file', 'GET'), $owner, $file);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('reservation_file.accessed', AuditEvent::query()->latest('id')->value('action'));

        $this->expectException(AuthorizationException::class);
        $service->download(Request::create('/file', 'GET'), User::factory()->create(), $file);
    }

    public function test_infected_expired_archived_and_public_disk_files_are_denied(): void
    {
        [$owner, $reservation] = $this->reservation();
        $service = app(ReservationFileService::class);
        $infected = $service->recordScan(
            Request::create('/scan', 'POST'),
            $this->upload($owner, $reservation),
            ReservationFileScanStatus::Infected,
        );

        try {
            $service->download(Request::create('/file', 'GET'), $owner, $infected);
            $this->fail('Infected file must be denied.');
        } catch (DomainException) {
            $this->assertTrue(true);
        }

        $expired = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'uploaded_by' => $owner->id,
            'retention_until' => now()->subSecond(),
        ]);
        Storage::disk('private')->put($expired->path, 'fixture');

        try {
            $service->download(Request::create('/file', 'GET'), $owner, $expired);
            $this->fail('Expired retention must be denied.');
        } catch (DomainException) {
            $this->assertTrue(true);
        }

        $publicDisk = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id,
            'uploaded_by' => $owner->id,
            'disk' => 'public',
        ]);

        try {
            $service->download(Request::create('/file', 'GET'), $owner, $publicDisk);
            $this->fail('Public disk metadata must be denied.');
        } catch (DomainException) {
            $this->assertTrue(true);
        }

        $clean = $service->recordScan(
            Request::create('/scan', 'POST'),
            $this->upload($owner, $reservation),
            ReservationFileScanStatus::Clean,
        );
        $service->archive(Request::create('/file', 'DELETE'), $owner, $clean, 'Replaced document');

        $this->assertSoftDeleted('reservation_files', ['id' => $clean->id]);
        $this->expectException(DomainException::class);
        $service->download(Request::create('/file', 'GET'), $owner, $clean);
    }

    public function test_invalid_upload_and_audit_failure_leave_no_private_file(): void
    {
        [$owner, $reservation] = $this->reservation();

        try {
            app(ReservationFileService::class)->upload(
                Request::create('/files', 'POST'),
                $owner,
                $reservation,
                UploadedFile::fake()->create('payload.exe', 4, 'application/x-msdownload'),
            );
            $this->fail('Executable upload must be rejected.');
        } catch (ValidationException) {
            $this->assertSame([], Storage::disk('private')->allFiles());
        }

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            $this->upload($owner, $reservation);
            $this->fail('Audit failure must escape upload.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_replacement_archives_old_file_and_quarantines_new_file_atomically(): void
    {
        [$owner, $reservation] = $this->reservation();
        $oldFile = $this->upload($owner, $reservation);
        $newFile = app(ReservationFileService::class)->replace(
            Request::create('/files/'.$oldFile->public_id.'/replacement', 'POST'),
            $owner,
            $oldFile,
            UploadedFile::fake()->create('replacement.pdf', 8, 'application/pdf'),
            'Incorrect document replaced',
            'Replacement report',
            now()->addYear(),
        );

        $this->assertSoftDeleted('reservation_files', ['id' => $oldFile->id]);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $newFile->scan_status);
        Storage::disk('private')->assertExists($oldFile->path);
        Storage::disk('private')->assertExists($newFile->path);
        $this->assertSame(
            ['reservation_file.uploaded', 'reservation_file.uploaded', 'reservation_file.archived'],
            AuditEvent::query()->orderBy('id')->pluck('action')->all(),
        );
    }

    /**
     * @return array{0: User, 1: Reservation}
     */
    private function reservation(): array
    {
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);

        return [$owner, $reservation];
    }

    private function upload(User $owner, Reservation $reservation): ReservationFile
    {
        return app(ReservationFileService::class)->upload(
            Request::create('/files', 'POST'),
            $owner,
            $reservation,
            UploadedFile::fake()->create('medical-report.pdf', 12, 'application/pdf'),
            retentionUntil: now()->addYear(),
        );
    }
}
