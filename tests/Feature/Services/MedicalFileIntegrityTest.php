<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\User;
use App\Services\ReservationFileService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MedicalFileIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_generic_signed_storage_urls_cannot_read_or_overwrite_medical_files(): void
    {
        [, $file] = $this->upload();
        config(['filesystems.disks.local.root' => Storage::disk('private')->path('')]);
        Storage::forgetDisk('local');
        $path = '/storage/'.$file->path;
        $query = 'expires='.now()->addMinute()->timestamp;
        $url = $path.'?'.$query;
        $this->get($url.'&signature='.hash_hmac('sha256', $url, config('app.key')))->assertNotFound();
        $url = $path.'?'.$query.'&upload=1';
        $this->call('PUT', $url.'&signature='.hash_hmac('sha256', $url, config('app.key')), [], [], [], [], 'harmless overwrite')->assertNotFound();
        $this->assertSame($file->checksum_sha256, hash('sha256', Storage::disk('private')->get($file->path)));
    }

    public function test_missing_blob_cannot_receive_a_clean_scan_verdict(): void
    {
        [, $file] = $this->upload();
        Storage::disk('private')->delete($file->path);
        try {
            app(ReservationFileService::class)->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
            $this->fail('Missing bytes must not be approved.');
        } catch (DomainException) {
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
            $this->assertDatabaseCount('audit_events', 1);
        }
    }

    public function test_mismatched_scanner_digest_cannot_approve_another_content_version(): void
    {
        [, $file] = $this->upload();
        try {
            app(ReservationFileService::class)->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, hash('sha256', 'other version'));
            $this->fail('Wrong content identity must not be approved.');
        } catch (DomainException) {
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
            $this->assertDatabaseCount('audit_events', 1);
        }
    }

    public function test_changed_bytes_cannot_download_under_an_old_clean_verdict(): void
    {
        [$owner, $file] = $this->upload();
        $service = app(ReservationFileService::class);
        $file = $service->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        Storage::disk('private')->put($file->path, 'harmless changed bytes');
        try {
            $service->download(Request::create('/download'), $owner, $file);
            $this->fail('Changed bytes must not be downloaded.');
        } catch (DomainException) {
            $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.accessed')->count());
        }
    }

    public function test_download_streams_the_verified_copy_and_has_private_attachment_headers(): void
    {
        [$owner, $file] = $this->upload();
        $service = app(ReservationFileService::class);
        $original = Storage::disk('private')->get($file->path);
        $file = $service->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        $response = $service->download(Request::create('/download'), $owner, $file);
        Storage::disk('private')->put($file->path, 'harmless replacement after response creation');
        ob_start();
        try {
            $response->sendContent();
            $content = ob_get_contents();
        } finally {
            ob_end_clean();
        }
        $this->assertSame($original, $content);
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertStringStartsWith('attachment;', $response->headers->get('Content-Disposition'));
        $this->assertSame((string) strlen($original), $response->headers->get('Content-Length'));
    }

    public function test_private_metadata_cannot_redirect_the_download_to_another_path_or_disk(): void
    {
        [$owner, $file] = $this->upload();
        $service = app(ReservationFileService::class);
        $file = $service->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        $original = $file->getAttributes();
        foreach ([
            ['path' => '../other.pdf'],
            ['path' => 'unrelated-private-object.pdf'],
            ['disk' => 'local'],
            ['safe_filename' => 'other.pdf'],
            ['extension' => 'php'],
            ['size_bytes' => 10 * 1024 * 1024 + 1],
        ] as $metadata) {
            $file->forceFill($metadata)->save();
            try {
                $service->download(Request::create('/download'), $owner, $file);
                $this->fail('Invalid private metadata must not release bytes.');
            } catch (DomainException) {
                $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.accessed')->count());
            }
            $file->forceFill($original)->save();
        }
    }

    public function test_bytes_exceeding_the_recorded_size_cannot_be_approved(): void
    {
        [, $file] = $this->upload();
        Storage::disk('private')->put($file->path, Storage::disk('private')->get($file->path).'extra bytes');
        try {
            app(ReservationFileService::class)->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
            $this->fail('A growing blob must not be approved.');
        } catch (DomainException) {
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
        }
    }

    public function test_large_file_stream_uses_the_verified_copy_after_spooling(): void
    {
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);
        $contents = \Tests\Fixtures\SyntheticMedicalFiles::pdf(paddingBytes: 2 * 1024 * 1024);
        $service = app(ReservationFileService::class);
        $file = $service->upload(Request::create('/upload', 'POST'), $owner, $reservation, UploadedFile::fake()->createWithContent('large.pdf', $contents), retentionUntil: now()->addYear());
        $file = $service->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        $response = $service->download(Request::create('/download'), $owner, $file);
        Storage::disk('private')->delete($file->path);
        ob_start();
        try {
            $response->sendContent();
            $this->assertSame(hash('sha256', $contents), hash('sha256', ob_get_contents()));
        } finally {
            ob_end_clean();
        }
    }

    public function test_lowering_new_upload_limit_does_not_revoke_an_existing_verified_file(): void
    {
        [$owner, $file] = $this->upload();
        $service = app(ReservationFileService::class);
        $original = Storage::disk('private')->get($file->path);
        $file = $service->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        config(['uploads.sections.medical.max_bytes' => 1]);

        $response = $service->download(Request::create('/download'), $owner, $file);
        ob_start();
        try {
            $response->sendContent();
            $this->assertSame($original, ob_get_contents());
        } finally {
            ob_end_clean();
        }
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_file.accessed')->count());
    }

    private function upload(): array
    {
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);
        $upload = UploadedFile::fake()->createWithContent('synthetic.pdf', \Tests\Fixtures\SyntheticMedicalFiles::pdf());

        return [$owner, app(ReservationFileService::class)->upload(Request::create('/upload', 'POST'), $owner, $reservation, $upload, retentionUntil: now()->addYear())];
    }
}
