<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Http\Resources\ReservationMedicalRequestResource;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use RuntimeException;
use Tests\TestCase;

class PatientMedicalUploadProgressApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_UPLOAD_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated upload/progress acceptance only.');
        }
        parent::setUp();
    }

    public function createApplication()
    {
        $environment = '/tmp/checkupino-upload-tests';
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
            || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL') || posix_geteuid() !== 33
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || getenv('LARAVEL_STORAGE_PATH') !== $environment
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Progress tests require isolated SQLite and must skip project environment/cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->make(Kernel::class)->bootstrap();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective SQLite guard failed before schema setup.');
        }

        return $app;
    }

    public function test_open_owner_request_has_zero_receipts_without_exposing_an_outcome(): void
    {
        $medical = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $this->actingAs($medical->reservation->user, 'sanctum')
            ->getJson($this->path($medical))->assertOk()
            ->assertJsonPath('data.0.upload_progress', ['received_count' => 0, 'awaiting_checks_count' => 0])
            ->assertJsonMissingPath('data.0.files')
            ->assertJsonMissingPath('data.0.reports');
        $this->getJson($this->path($medical).'/'.$medical->public_id.'/outcome')->assertNotFound();
    }

    public function test_receipts_are_owner_request_reservation_private_and_retention_bound(): void
    {
        $medical = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $base = [
            'reservation_id' => $medical->reservation_id,
            'medical_request_id' => $medical->id,
            'uploaded_by' => $medical->reservation->user_id,
        ];
        $files = [];
        foreach (ReservationFileScanStatus::cases() as $status) {
            $files[] = ReservationFile::factory()->create($base + ['scan_status' => $status]);
        }
        foreach ([
            ['medical_request_id' => ReservationMedicalRequest::factory()->create([
                'reservation_id' => $medical->reservation_id, 'created_at' => now()->subMinute(),
            ])->id],
            ['uploaded_by' => User::factory()->patient()->create()->id],
            ['disk' => 'public'],
            ['classification' => 'other'],
            ['retention_until' => now()->subSecond()],
            ['deleted_at' => now()],
        ] as $exclude) {
            $files[] = ReservationFile::factory()->create(array_merge($base, $exclude));
        }
        // The composite foreign key prevents a file/request reservation mismatch.
        $other = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $files[] = ReservationFile::factory()->create([
            'reservation_id' => $other->reservation_id, 'medical_request_id' => $other->id,
            'uploaded_by' => $medical->reservation->user_id,
        ]);
        $response = $this->actingAs($medical->reservation->user, 'sanctum')
            ->getJson($this->path($medical))->assertOk()
            ->assertJsonPath('data.0.upload_progress', ['received_count' => 4, 'awaiting_checks_count' => 1])
            ->assertJsonMissingPath('data.0.files')
            ->assertJsonMissingPath('data.0.patient_received_count')
            ->assertJsonMissingPath('data.0.patient_awaiting_checks_count');
        foreach ($files as $file) {
            $this->assertStringNotContainsString($file->public_id, $response->getContent());
            $this->assertStringNotContainsString($file->path, $response->getContent());
            $this->assertStringNotContainsString($file->checksum_sha256, $response->getContent());
        }
        foreach (['scan_status', 'scanned_at', 'uploaded_by', 'available', 'active_scanning'] as $fact) {
            $this->assertStringNotContainsString('"'.$fact.'":', $response->getContent());
        }
    }

    public function test_progress_is_absent_from_doctor_resources_and_other_actors_are_denied(): void
    {
        $medical = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $reservation = $medical->reservation;
        $this->actingAs($reservation->doctor->user, 'sanctum')
            ->getJson('/api/doctor/reservations/'.$reservation->public_id.'/medical-requests')
            ->assertOk()->assertJsonMissingPath('data.0.upload_progress');
        foreach ([User::factory()->patient()->create(), $reservation->doctor->user,
            User::factory()->admin()->create(), User::factory()->rootAdmin()->create()] as $actor) {
            $this->actingAs($actor, 'sanctum')->getJson($this->path($medical))->assertNotFound();
        }
    }

    public function test_resource_rechecks_owner_even_when_count_attributes_are_loaded(): void
    {
        $medical = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $medical->setAttribute('patient_received_count', 2);
        $medical->setAttribute('patient_awaiting_checks_count', 1);
        $request = Request::create('/synthetic');
        $request->setUserResolver(fn () => $medical->reservation->doctor->user);
        $resource = (new ReservationMedicalRequestResource($medical))->resolve($request);
        $this->assertArrayNotHasKey('upload_progress', $resource);
    }

    private function path(ReservationMedicalRequest $medical): string
    {
        return '/api/reservations/'.$medical->reservation->public_id.'/medical-requests';
    }
}
