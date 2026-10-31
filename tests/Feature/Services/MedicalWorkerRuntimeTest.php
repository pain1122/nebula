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
use Database\Seeders\RolesSeeder;
use DomainException;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Symfony\Component\Process\Process;
use Tests\Fixtures\SyntheticMedicalFiles;
use Tests\TestCase;

class MedicalWorkerRuntimeTest extends TestCase
{
    private ?string $directory = null;

    private ?Process $parser = null;

    private ?int $daemonPid = null;

    private array $unrelated;

    public function createApplication()
    {
        $environment = '/tmp/checkupino-worker-tests';
        if (getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || file_exists($environment.'/config.php') || file_exists($environment.'/.env')
            || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Worker rehearsal must not load project environment or cached configuration.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }

    protected function setUp(): void
    {
        // Guard before Laravel/schema initialization. All writes are container tmpfs only.
        if (getenv('CHECKUPINO_WORKER_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated worker rehearsal only.');
        }
        if (getenv('APP_ENV') !== 'testing'
            || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== ':memory:'
            || getenv('APP_KEY') !== 'base64:YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
            || getenv('DB_URL') || getenv('LARAVEL_STORAGE_PATH') !== '/tmp/checkupino-worker-tests') {
            throw new RuntimeException('Worker rehearsal requires explicit isolated testing/SQLite memory.');
        }
        parent::setUp();
        $this->assertSame('sqlite', DB::getDefaultConnection());
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertEmpty(config('database.connections.sqlite.url'));
        $this->directory = '/tmp/checkupino-worker-'.bin2hex(random_bytes(8));
        mkdir($this->directory, 0700);
        // This is an empty in-memory schema, not a live migrate/reset/reseed.
        Artisan::call('migrate', ['--force' => true]);
        $this->seed(RolesSeeder::class);
        config([
            'filesystems.disks.private.root' => $this->directory.'/private',
            'medical.scanner.enabled' => true,
            'medical_uploads.cache_store' => 'array',
        ]);
        Storage::forgetDisk('private');
        Queue::connection('database')->push(new MaterializeDoctorVisitSlots, '', 'default');
        $this->unrelated = (array) DB::table('jobs')->where('queue', 'default')->sole();
    }

    protected function tearDown(): void
    {
        $this->parser?->stop(0);
        if ($this->daemonPid !== null) {
            posix_kill($this->daemonPid, SIGKILL);
            pcntl_waitpid($this->daemonPid, $status);
        }
        if ($this->directory !== null) {
            DB::disconnect('rehearsal');
            // The exact random directory was created above; never traverse symlinks.
            $this->removeDirectory($this->directory);
        }
        parent::tearDown();
    }

    public function test_actual_bounded_worker_decrypts_delivery_validates_content_and_skips_duplicate(): void
    {
        $file = $this->upload();
        DB::transaction(fn () => app(MedicalScanQueue::class)->enqueue($file));
        $this->snapshotDatabase($file);
        $payload = json_decode(DB::table('jobs')->where('queue', 'medical-scan')->first()->payload, true);
        $this->assertIsString($payload['data']['command']);
        $this->assertStringNotContainsString($file->public_id, $payload['data']['command']);
        $this->assertStringNotContainsString($file->checksum_sha256, $payload['data']['command']);
        $this->startParser();
        $this->startDaemon('clean');
        $this->runWorker();
        $this->finishDaemon();
        $this->assertSame(ReservationFileScanStatus::Clean, $file->fresh()->scan_status);
        $audit = AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->sole();
        $this->assertSame($file->checksum_sha256, $audit->after['scan_checksum_sha256']);
        $this->assertSame('qpdf-12.4.2/medical-v1', $audit->after['content_validator']);
        $this->assertSame(1, DB::table('jobs')->where('queue', 'medical-scan')->count());
        // The fixture socket is now closed: a duplicate must exit without scanning again.
        $this->runWorker();
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertUnrelatedUntouched();
    }

    public static function blockedScans(): array
    {
        return [
            'unavailable socket' => ['unavailable'],
            'engine error' => ['error'],
            'stale definitions' => ['stale'],
            'bounded timeout' => ['timeout'],
            'missing content parser' => ['clean'],
        ];
    }

    #[DataProvider('blockedScans')]
    public function test_worker_releases_failed_delivery_with_backoff_and_access_blocked(string $scenario): void
    {
        $file = $this->upload();
        $this->snapshotDatabase($file);
        if ($scenario !== 'unavailable') {
            $this->startDaemon($scenario);
        }
        $before = time();
        $this->runWorker();
        $this->finishDaemon();
        $job = DB::table('jobs')->where('queue', 'medical-scan')->sole();
        $this->assertSame(1, $job->attempts);
        $this->assertNull($job->reserved_at);
        $this->assertGreaterThanOrEqual($before + 15, $job->available_at);
        $this->assertLessThanOrEqual(time() + 15, $job->available_at);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->fresh()->scan_status);
        $this->assertSame(0, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertDownloadBlocked($file);
        $this->assertUnrelatedUntouched();
        if ($scenario === 'unavailable') {
            // Observe the real first backoff before delivering the same encrypted job again.
            usleep(max(0, $job->available_at - time()) * 1000000 + 10000);
            $this->startParser();
            $this->startDaemon('clean');
            $this->runWorker();
            $this->finishDaemon();
            $this->assertSame(ReservationFileScanStatus::Clean, $file->fresh()->scan_status);
            $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
            $this->assertSame(0, DB::table('failed_jobs')->count());
            $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
            $this->assertUnrelatedUntouched();
        }
    }

    public function test_worker_infected_protocol_verdict_blocks_access_without_content_release(): void
    {
        $file = $this->upload();
        $this->snapshotDatabase($file);
        $this->startDaemon('infected');
        $this->runWorker();
        $this->finishDaemon();
        $this->assertSame(ReservationFileScanStatus::Infected, $file->fresh()->scan_status);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        $this->assertDownloadBlocked($file);
        $this->assertUnrelatedUntouched();
    }

    public function test_exhausted_worker_delivery_records_failure_without_provider_details(): void
    {
        $file = $this->upload();
        $this->snapshotDatabase($file);
        // Explicit synthetic queue fixture represents two earlier attempts, not a live queue edit.
        DB::table('jobs')->where('queue', 'medical-scan')->update(['attempts' => 2]);
        $this->runWorker();
        $this->assertSame(ReservationFileScanStatus::Failed, $file->fresh()->scan_status);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $failure = DB::table('failed_jobs')->sole();
        $this->assertSame('medical-scan', $failure->connection);
        $this->assertSame('medical-scan', $failure->queue);
        $this->assertStringContainsString('Medical scan could not complete; file access remains blocked.', $failure->exception);
        $this->assertStringNotContainsString('clamd.sock', $failure->exception);
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->count());
        $this->assertDownloadBlocked($file);
        $this->assertUnrelatedUntouched();
    }

    #[Group('medical-engine')]
    public function test_actual_engine_bounded_worker_accepts_synthetic_pdf_with_remote_parser(): void
    {
        $this->requireActualEngine();
        $file = $this->upload();
        $this->snapshotDatabase($file);
        $this->runWorker('engine');
        $this->assertSame(ReservationFileScanStatus::Clean, $file->fresh()->scan_status);
        $audit = AuditEvent::query()->where('action', 'reservation_file.scan_recorded')->sole();
        $this->assertSame('1.5.4', $audit->after['scanner_version']);
        $this->assertSame($file->checksum_sha256, $audit->after['scan_checksum_sha256']);
        $this->assertSame('qpdf-12.4.2/medical-v1', $audit->after['content_validator']);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertUnrelatedUntouched();
    }

    #[Group('medical-engine')]
    public function test_actual_engine_worker_blocks_harmless_antivirus_test_marker(): void
    {
        $this->requireActualEngine();
        $marker = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
        // Deliberate isolated quarantine fixture; not a MIME-valid ordinary upload.
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);
        $file = ReservationFile::factory()->create([
            'reservation_id' => $reservation->id, 'uploaded_by' => $owner->id,
            'scan_status' => ReservationFileScanStatus::Quarantined, 'scanned_at' => null,
            'size_bytes' => strlen($marker), 'checksum_sha256' => hash('sha256', $marker),
        ]);
        Storage::disk('private')->put($file->path, $marker);
        DB::transaction(fn () => app(MedicalScanQueue::class)->enqueue($file));
        $this->snapshotDatabase($file);
        $this->runWorker('engine');
        $this->assertSame(ReservationFileScanStatus::Infected, $file->fresh()->scan_status);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'medical-scan')->count());
        $this->assertSame(0, DB::table('failed_jobs')->count());
        $this->assertDownloadBlocked($file);
        $this->assertUnrelatedUntouched();
    }

    private function requireActualEngine(): void
    {
        if (getenv('MEDICAL_SCANNER_INTEGRATION') !== 'true') {
            throw new RuntimeException('Actual engine mode must be explicitly enabled in the isolated runner.');
        }
        $this->assertSame(0, Artisan::call('medical:scanner-check', ['--probe' => true]),
            'Actual fresh-definition clean/test-marker probe must pass before the bounded worker.');
    }

    private function upload(): ReservationFile
    {
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);

        return app(ReservationFileService::class)->upload(Request::create('/synthetic', 'POST'), $owner, $reservation,
            UploadedFile::fake()->createWithContent('synthetic-worker.pdf', SyntheticMedicalFiles::pdf()), retentionUntil: now()->addYear());
    }

    private function snapshotDatabase(ReservationFile $file): void
    {
        DB::statement('VACUUM INTO ?', [$this->directory.'/database.sqlite']);
        config(['database.connections.rehearsal' => array_replace(config('database.connections.sqlite'), [
            'database' => $this->directory.'/database.sqlite', 'url' => null,
        ])]);
        DB::setDefaultConnection('rehearsal');
        $file->setConnection('rehearsal');
    }

    private function runWorker(string $mode = 'protocol'): void
    {
        // Remove all inherited environment entries; allow only synthetic configuration.
        $env = array_fill_keys(array_unique(array_merge(array_keys(getenv()), array_keys($_ENV))), false);
        $env = array_replace($env, [
            'PATH' => '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'APP_ENV' => 'testing', 'APP_DEBUG' => 'false', 'APP_KEY' => config('app.key'),
            'DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => $this->directory.'/database.sqlite', 'DB_URL' => '',
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'LOG_CHANNEL' => 'null',
            'QUEUE_CONNECTION' => 'database', 'MAIL_MAILER' => 'array', 'MEDICAL_STORAGE_DRIVER' => 'local',
            'MEDICAL_LOCAL_STORAGE_ROOT' => $this->directory.'/private',
            'LARAVEL_STORAGE_PATH' => $this->directory, 'APP_CONFIG_CACHE' => $this->directory.'/config.php',
            'VIEW_COMPILED_PATH' => $this->directory.'/views',
            'MEDICAL_SCANNER_INTEGRATION' => $mode === 'engine' ? 'true' : 'false',
        ]);
        $worker = new Process([PHP_BINARY, base_path('tests/Fixtures/medical-worker-entry.php'), $this->directory, $mode], base_path(), $env, timeout: $mode === 'engine' ? 125 : 20);
        $worker->run();
        $this->assertSame(0, $worker->getExitCode(), 'Bounded isolated worker must exit successfully.');
        $this->assertStringNotContainsString('synthetic-worker.pdf', $worker->getOutput().$worker->getErrorOutput());
    }

    private function startParser(): void
    {
        $this->parser = new Process([PHP_BINARY, base_path('scripts/media/serve-medical-content.php'), $this->directory.'/content.sock'], timeout: 30);
        $this->parser->start();
        $deadline = microtime(true) + 3;
        while (microtime(true) < $deadline && $this->parser->isRunning()) {
            if (file_exists($this->directory.'/content.sock')) {
                return;
            }
            usleep(10000);
        }
        $this->fail('Isolated synthetic parser fixture must start.');
    }

    private function startDaemon(string $scenario): void
    {
        $socket = stream_socket_server('unix://'.$this->directory.'/clamd.sock', $code, $error);
        $this->assertIsResource($socket);
        $pid = pcntl_fork();
        if ($pid === -1) {
            fclose($socket);
            $this->fail('Protocol fixture must fork.');
        }
        if ($pid === 0) {
            $count = in_array($scenario, ['stale', 'timeout'], true) ? 1 : 3;
            $version = 'ClamAV 1.5.4/999999/'.gmdate('D M j H:i:s Y', time() - ($scenario === 'stale' ? 172900 : 0));
            for ($index = 0; $index < $count; $index++) {
                $client = @stream_socket_accept($socket, 15);
                if (! is_resource($client)) {
                    exit(1);
                }
                stream_set_timeout($client, 3);
                $command = '';
                while (! str_ends_with($command, "\0") && strlen($command) < 20) {
                    $command .= $this->readExactly($client, 1);
                }
                if ($scenario === 'timeout') {
                    usleep(1200000);
                } elseif ($command === "zVERSION\0") {
                    fwrite($client, $version."\0");
                } elseif ($command === "zINSTREAM\0") {
                    $hash = hash_init('sha256');
                    $total = 0;
                    while (($length = unpack('N', $this->readExactly($client, 4))[1]) !== 0) {
                        $total += $length;
                        if ($length > 65536 || $total > 1048576) {
                            exit(1);
                        }
                        hash_update($hash, $this->readExactly($client, $length));
                    }
                    if (! hash_equals(hash('sha256', SyntheticMedicalFiles::pdf()), hash_final($hash))) {
                        exit(1);
                    }
                    $reply = match ($scenario) {
                        'error' => 'stream: synthetic-provider-detail ERROR',
                        'infected' => 'stream: Synthetic-Signature FOUND',
                        default => 'stream: OK',
                    };
                    fwrite($client, $reply."\0");
                } else {
                    exit(1);
                }
                fclose($client);
            }
            fclose($socket);
            exit(0);
        }
        $this->daemonPid = $pid;
        fclose($socket);
    }

    private function finishDaemon(): void
    {
        if ($this->daemonPid !== null) {
            pcntl_waitpid($this->daemonPid, $status);
            $this->daemonPid = null;
            $this->assertTrue(pcntl_wifexited($status));
            $this->assertSame(0, pcntl_wexitstatus($status), 'Protocol fixture must observe bounded correct traffic.');
        }
    }

    private function readExactly(mixed $client, int $length): string
    {
        $bytes = '';
        while (strlen($bytes) < $length) {
            $chunk = fread($client, $length - strlen($bytes));
            if ($chunk === '' || $chunk === false) {
                exit(1);
            }
            $bytes .= $chunk;
        }

        return $bytes;
    }

    private function assertDownloadBlocked(ReservationFile $file): void
    {
        try {
            app(ReservationFileService::class)->download(Request::create('/synthetic-download'), $file->reservation->user, $file->fresh());
            $this->fail('Unsafe synthetic content must remain inaccessible.');
        } catch (DomainException) {
            $this->addToAssertionCount(1);
        }
    }

    private function assertUnrelatedUntouched(): void
    {
        $this->assertSame($this->unrelated, (array) DB::table('jobs')->where('queue', 'default')->sole());
    }

    private function removeDirectory(string $directory): void
    {
        foreach (new \FilesystemIterator($directory) as $entry) {
            if ($entry->isDir() && ! $entry->isLink()) {
                $this->removeDirectory($entry->getPathname());
            } else {
                unlink($entry->getPathname());
            }
        }
        rmdir($directory);
    }
}
