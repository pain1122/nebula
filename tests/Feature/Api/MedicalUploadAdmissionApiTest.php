<?php

namespace Tests\Feature\Api;

use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MedicalUploadAdmissionApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        config(['medical_uploads.cache_store' => 'array']);
    }

    public function test_account_throttle_counts_invalid_attempts_and_returns_existing_safe_429_contract(): void
    {
        config(['medical_uploads.requests_per_user_per_minute' => 1]);
        [$reservation, $path] = $this->fixture();
        $this->actingAs($reservation->user, 'sanctum')->postJson($path, [])->assertUnprocessable();
        $this->postJson($path, [])->assertStatus(429)
            ->assertJsonPath('code', 'rate_limited')->assertJsonPath('success', false)->assertHeader('Retry-After');
        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
        $this->travel(61)->seconds();
        $this->postJson($path, [])->assertUnprocessable();
        $this->travelBack();
    }

    public function test_ip_throttle_spans_accounts_without_exposing_their_identity(): void
    {
        config(['medical_uploads.requests_per_ip_per_minute' => 1]);
        [$first, $firstPath] = $this->fixture();
        [$second, $secondPath] = $this->fixture();
        $this->actingAs($first->user, 'sanctum')->postJson($firstPath, [])->assertUnprocessable();
        $response = $this->actingAs($second->user, 'sanctum')->postJson($secondPath, [])->assertStatus(429);
        $this->assertStringNotContainsString($first->user->email, $response->getContent());
        $this->assertDatabaseCount('reservation_files', 0);
    }

    public function test_quota_and_concurrency_rejections_do_not_write_or_return_storage_details(): void
    {
        config(['medical_uploads.request_max_files' => 1]);
        [$reservation, $path] = $this->fixture();
        $this->actingAs($reservation->user, 'sanctum')->post($path, ['file' => $this->file()], ['Accept' => 'application/json'])->assertCreated();
        $this->post($path, ['file' => $this->file()], ['Accept' => 'application/json'])->assertUnprocessable();
        $lock = Cache::store('array')->lock('medical-upload:account:'.hash('sha256', (string) $reservation->user_id), 120);
        $this->assertTrue($lock->get());
        try {
            $this->post($path, ['file' => $this->file()], ['Accept' => 'application/json'])
                ->assertStatus(429)->assertJsonPath('code', 'rate_limited')->assertHeader('Retry-After', '5')
                ->assertJsonMissingPath('data.path');
        } finally {
            $lock->release();
        }
        $this->assertDatabaseCount('reservation_files', 1);
        $this->assertDatabaseCount('audit_events', 1);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame(1, count(Storage::disk('private')->allFiles()));
    }

    public function test_invalid_operator_policy_returns_safe_unavailable_response(): void
    {
        [$reservation, $path] = $this->fixture();
        config(['medical_uploads.concurrent_uploads' => 0]);
        $this->actingAs($reservation->user, 'sanctum')->postJson($path, [])->assertStatus(503)
            ->assertJsonPath('code', 'upload_unavailable')->assertJsonMissingPath('exception')->assertJsonMissingPath('trace');
        $this->assertDatabaseCount('reservation_files', 0);
    }

    private function fixture(): array
    {
        $reservation = Reservation::factory()->create();
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create(['reservation_id' => $reservation->id]);

        return [$reservation, '/api/reservations/'.$reservation->public_id.'/medical-requests/'.$request->public_id.'/files'];
    }

    private function file(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", 32, ' '));
    }
}
