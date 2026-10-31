<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Jobs\MaterializeDoctorVisitSlots;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\User;
use App\Services\MedicalScanQueue;
use App\Services\ReservationFileService;
use DomainException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class MedicalScannerIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $environment = '/tmp/checkupino-scanner-integration';
        if (getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Scanner integration must skip project environment and cached configuration.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->make(Kernel::class)->bootstrap();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url') || config('app.key') !== getenv('APP_KEY')) {
            throw new RuntimeException('Effective isolated SQLite configuration required before schema setup.');
        }

        return $app;
    }

    protected function setUp(): void
    {
        // Guard before RefreshDatabase runs: never initialize a live database.
        if (getenv('MEDICAL_SCANNER_INTEGRATION') !== 'true'
            || getenv('CHECKUPINO_SCANNER_INTEGRATION_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit actual-engine synthetic acceptance only.');
        }
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
            || getenv('DB_URL') || getenv('APP_KEY') !== 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
            || getenv('LARAVEL_STORAGE_PATH') !== '/tmp/checkupino-scanner-integration' || posix_geteuid() !== 33) {
            throw new RuntimeException('Scanner integration requires explicit testing/SQLite :memory:.');
        }
        parent::setUp();
        Storage::fake('private');
        config(['medical.scanner.enabled' => true, 'medical_parser.test_inline' => false]);
    }

    public function test_actual_clean_engine_queue_audit_download_and_later_tamper_rejection(): void
    {
        $unrelatedId = Queue::connection('database')->push(new MaterializeDoctorVisitSlots, '', 'default');
        $unrelated = (array) DB::table('jobs')->where('id', $unrelatedId)->sole();
        $file = $this->upload();
        $delivery = Queue::connection('medical-scan')->pop('medical-scan');
        $this->assertNotNull($delivery);
        $delivery->fire();
        $file->refresh();
        $this->assertSame(ReservationFileScanStatus::Clean, $file->scan_status);
        $this->assertDatabaseHas('jobs', ['id' => $unrelatedId, 'queue' => 'default', 'attempts' => 0, 'reserved_at' => null]);
        $this->assertSame($unrelated, (array) DB::table('jobs')->where('id', $unrelatedId)->sole());
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $audit = AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->sole();
        $this->assertSame('1.5.4', $audit->after['scanner_version']);
        $this->assertSame($file->checksum_sha256, $audit->after['scan_checksum_sha256']);
        $this->assertSame('qpdf-12.4.2/medical-v1', $audit->after['content_validator']);
        $response = app(ReservationFileService::class)->download(Request::create('/download'), $file->reservation->user, $file);
        ob_start();
        try {
            $response->sendContent();
            $bytes = ob_get_contents();
        } finally {
            ob_end_clean();
        }
        $this->assertSame($this->pdf(), $bytes);
        Storage::disk('private')->put($file->path, 'synthetic changed content');
        $this->expectException(DomainException::class);
        app(ReservationFileService::class)->download(Request::create('/download'), $file->reservation->user, $file);
    }

    public function test_actual_test_marker_verdict_records_infected_and_blocks_download(): void
    {
        // Deliberate test-only quarantined fixture, not a MIME-valid public upload.
        $marker = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);
        $file = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id, 'uploaded_by' => $owner->id,
            'scan_status' => ReservationFileScanStatus::Quarantined, 'scanned_at' => null,
            'size_bytes' => strlen($marker), 'checksum_sha256' => hash('sha256', $marker),
        ]);
        Storage::disk('private')->put($file->path, $marker);
        DB::transaction(fn () => app(MedicalScanQueue::class)->enqueue($file));
        $delivery = Queue::connection('medical-scan')->pop('medical-scan');
        $this->assertNotNull($delivery);
        $delivery->fire();
        $this->assertSame(ReservationFileScanStatus::Infected, $file->fresh()->scan_status);
        $this->expectException(DomainException::class);
        app(ReservationFileService::class)->download(Request::create('/download'), $owner, $file);
    }

    public function test_unavailable_actual_queue_scan_retains_quarantine_and_redacts_failure(): void
    {
        $file = $this->upload();
        config(['medical.scanner.socket' => '/run/medical-scan/synthetic-unavailable.sock']);
        $delivery = Queue::connection('medical-scan')->pop('medical-scan');
        $this->assertNotNull($delivery);
        try {
            $delivery->fire();
            $this->fail('An unavailable engine must not release content.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Medical scan could not complete; file access remains blocked.', $exception->getMessage());
            $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
            $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        }
    }

    private function upload(): ReservationFile
    {
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);

        return app(ReservationFileService::class)->upload(Request::create('/files', 'POST'), $owner, $reservation,
            UploadedFile::fake()->createWithContent('synthetic-scanner.pdf', $this->pdf()), retentionUntil: now()->addYear());
    }

    private function pdf(): string
    {
        $content = "BT /F1 12 Tf 20 50 Td (Synthetic scanner integration fixture) Tj ET\n";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Length '.strlen($content)." >>\nstream\n".$content.'endstream',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf('%010d 00000 n ', $offset)."\n";
        }

        return $pdf."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";
    }
}
