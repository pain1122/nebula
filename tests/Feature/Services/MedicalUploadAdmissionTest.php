<?php

namespace Tests\Feature\Services;

use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Services\AuditLogger;
use App\Services\MedicalUploadAdmission;
use App\Services\ReservationFileService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class MedicalUploadAdmissionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        config(['medical_uploads.cache_store' => 'array']);
    }

    public function test_exact_account_bytes_accept_and_next_byte_is_rejected_before_storage(): void
    {
        $reservation = Reservation::factory()->create();
        config(['medical_uploads.account_max_bytes' => 64]);
        $this->upload($reservation);
        $this->upload($reservation);
        $this->assertDatabaseCount('reservation_files', 2);
        $this->assertSame(2, count(Storage::disk('private')->allFiles()));
        $this->expectException(DomainException::class);
        try {
            $this->upload($reservation, bytes: 33);
        } finally {
            $this->assertDatabaseCount('reservation_files', 2);
            $this->assertDatabaseCount('audit_events', 2);
            $this->assertDatabaseCount('jobs', 0);
            $this->assertSame(2, count(Storage::disk('private')->allFiles()));
        }
    }

    #[DataProvider('quotaLimits')]
    public function test_account_and_request_count_and_bytes_cannot_be_bypassed(string $limit, int $value): void
    {
        $reservation = Reservation::factory()->create();
        $medicalRequest = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create(['reservation_id' => $reservation->id]);
        $this->upload($reservation, $medicalRequest);
        config(['medical_uploads.'.$limit => $value]);
        try {
            $this->upload($reservation, $medicalRequest);
            $this->fail('The second upload must exceed the configured allowance.');
        } catch (DomainException $exception) {
            $this->assertSame('Medical upload allowance is exhausted.', $exception->getMessage());
        }
        $this->assertDatabaseCount('reservation_files', 1);
        $this->assertDatabaseCount('audit_events', 1);
        $this->assertSame(1, count(Storage::disk('private')->allFiles()));
    }

    public static function quotaLimits(): array
    {
        return [['account_max_files', 1], ['account_max_bytes', 63], ['request_max_files', 1], ['request_max_bytes', 63]];
    }

    public function test_account_allowance_spans_reservations_and_uploader_roles_but_not_other_patients(): void
    {
        config(['medical_uploads.account_max_files' => 1]);
        $first = Reservation::factory()->create();
        $second = Reservation::factory()->create(['user_id' => $first->user_id]);
        $other = Reservation::factory()->create();
        $this->upload($first);
        try {
            app(ReservationFileService::class)->upload(Request::create('/files'), $second->doctor->user, $second, $this->file());
            $this->fail('Assigned-doctor uploads must share the patient account quota.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_files', 1);
        }
        $this->upload($other);
        $this->assertDatabaseCount('reservation_files', 2);
    }

    public function test_archiving_and_retention_expiry_do_not_free_stored_capacity(): void
    {
        config(['medical_uploads.account_max_files' => 1]);
        $reservation = Reservation::factory()->create();
        $file = $this->upload($reservation);
        $file->forceFill(['retention_until' => now()->subDay()])->save();
        $file->delete();
        try {
            $this->upload($reservation);
            $this->fail('Retained blobs must still consume capacity.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_files', 1);
            Storage::disk('private')->assertExists($file->path);
        }
    }

    public function test_distinct_requests_have_independent_allowances_within_one_account(): void
    {
        config(['medical_uploads.request_max_files' => 1]);
        $reservation = Reservation::factory()->create();
        foreach (range(1, 2) as $unused) {
            $request = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create(['reservation_id' => $reservation->id]);
            $this->upload($reservation, $request);
        }
        $this->assertDatabaseCount('reservation_files', 2);
    }

    public function test_lock_release_failure_does_not_turn_a_committed_upload_into_a_failure(): void
    {
        $reservation = Reservation::factory()->create();
        $cache = \Mockery::mock(\Illuminate\Cache\Repository::class);
        $lock = \Mockery::mock(\Illuminate\Cache\ArrayLock::class);
        $lock->shouldReceive('get')->twice()->andReturn(true);
        $lock->shouldReceive('isOwnedByCurrentProcess')->times(4)->andReturn(true);
        $lock->shouldReceive('release')->twice()->andThrow(new RuntimeException('synthetic lease cleanup failure'));
        $cache->shouldReceive('lock')->twice()->andReturn($lock);
        Cache::shouldReceive('store')->with('array')->once()->andReturn($cache);
        $file = $this->upload($reservation);
        $this->assertDatabaseCount('reservation_files', 1);
        $this->assertDatabaseCount('audit_events', 1);
        Storage::disk('private')->assertExists($file->path);
    }

    public function test_busy_account_and_global_slots_reject_before_writes_and_release_owned_locks(): void
    {
        $reservation = Reservation::factory()->create();
        $account = Cache::store('array')->lock('medical-upload:account:'.hash('sha256', (string) $reservation->user_id), 120);
        $this->assertTrue($account->get());
        try {
            $this->upload($reservation);
            $this->fail('A busy account must be rejected.');
        } catch (ThrottleRequestsException $exception) {
            $this->assertSame('5', $exception->getHeaders()['Retry-After']);
            $this->assertTrue($account->isOwnedByCurrentProcess());
        } finally {
            $account->release();
        }
        config(['medical_uploads.concurrent_uploads' => 1]);
        $slot = Cache::store('array')->lock('medical-upload:slot:0', 120);
        $this->assertTrue($slot->get());
        try {
            $this->upload($reservation);
            $this->fail('A full global capacity must be rejected.');
        } catch (ThrottleRequestsException) {
            $this->assertTrue($slot->isOwnedByCurrentProcess());
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertSame([], Storage::disk('private')->allFiles());
        } finally {
            $slot->release();
        }
        $this->upload($reservation);
        $this->assertDatabaseCount('reservation_files', 1);
    }

    public function test_reentrant_account_is_blocked_and_other_account_can_use_another_slot(): void
    {
        $first = Reservation::factory()->create();
        $second = Reservation::factory()->create();
        config(['medical_uploads.concurrent_uploads' => 2]);
        $admission = app(MedicalUploadAdmission::class);
        $admission->within($first, null, 32, function () use ($first, $second): void {
            try {
                $this->upload($first);
                $this->fail('Reentrant account upload must be blocked.');
            } catch (ThrottleRequestsException) {
                $this->assertDatabaseCount('reservation_files', 0);
            }
            $this->upload($second);
        });
        $this->upload($first);
        $this->assertDatabaseCount('reservation_files', 2);
    }

    #[DataProvider('postWriteFailures')]
    public function test_changed_policy_expired_or_lost_lease_roll_back_staged_file_audit_and_job(string $failure): void
    {
        $reservation = Reservation::factory()->create();
        config(['medical.scanner.enabled' => true]);
        $logger = app(AuditLogger::class);
        $this->mock(AuditLogger::class)->shouldReceive('log')->once()->andReturnUsing(function (...$arguments) use ($logger, $failure): \App\Models\AuditEvent {
            $event = $logger->log(...$arguments);
            if ($failure === 'policy') {
                config(['medical_uploads.account_max_bytes' => 31]);
            } elseif ($failure === 'expiry') {
                $this->travel(121)->seconds();
            } else {
                Cache::store('array')->lock('medical-upload:slot:0')->forceRelease();
            }

            return $event;
        });
        try {
            $this->upload($reservation);
            $this->fail('A lost admission must roll back the upload.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertDatabaseCount('audit_events', 0);
            $this->assertDatabaseCount('jobs', 0);
            $this->assertSame([], Storage::disk('private')->allFiles());
        } finally {
            $this->travelBack();
        }
    }

    public static function postWriteFailures(): array
    {
        return [['policy'], ['expiry'], ['lost']];
    }

    public function test_unavailable_lock_backend_fails_closed_without_storage_or_diagnostics(): void
    {
        $reservation = Reservation::factory()->create();
        Cache::shouldReceive('store')->with('array')->once()->andThrow(new RuntimeException('secret database host/path'));
        try {
            $this->upload($reservation);
            $this->fail('Unavailable admission backend must reject uploads.');
        } catch (DomainException $exception) {
            $this->assertSame('Medical upload admission is unavailable.', $exception->getMessage());
            $this->assertSame([], Storage::disk('private')->allFiles());
            $this->assertDatabaseCount('reservation_files', 0);
        }
    }

    #[DataProvider('invalidLimits')]
    public function test_invalid_or_disabled_limits_fail_closed(string $key, mixed $value): void
    {
        config(['medical_uploads.'.$key => $value]);
        $this->expectException(DomainException::class);
        MedicalUploadAdmission::limits();
    }

    public static function invalidLimits(): array
    {
        return [['account_max_files', 0], ['account_max_bytes', '1e6'], ['request_max_bytes', false],
            ['request_max_files', -1], ['concurrent_uploads', 17], ['lease_seconds', 0], ['enabled', false], ['cache_store', 'file']];
    }

    private function file(int $bytes = 32): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", $bytes, ' '));
    }

    private function upload(Reservation $reservation, ?ReservationMedicalRequest $medicalRequest = null, int $bytes = 32): \App\Models\ReservationFile
    {
        $service = app(ReservationFileService::class);

        return $medicalRequest === null
            ? $service->upload(Request::create('/files'), $reservation->user, $reservation, $this->file($bytes), retentionUntil: now()->addYear())
            : $service->uploadForMedicalRequest(Request::create('/files'), $reservation->user, $medicalRequest, $this->file($bytes));
    }
}
