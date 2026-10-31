<?php

namespace Tests\Feature\Services;

use App\Enums\ReservationFileScanStatus;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationStatus;
use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use App\Services\MedicalAttachmentPolicy;
use App\Services\ReservationFileService;
use App\Services\ReservationMedicalRequestService;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MedicalAttachmentPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
    }

    public function test_doctor_issues_immutable_default_and_narrowed_policies_with_minimal_audit(): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        $default = $this->issue($reservation);
        $pdf = $this->issue($reservation, ['allowed_mime_types' => ['application/pdf'], 'max_bytes' => 1048576]);
        $this->assertCount(3, $default->attachment_policy['allowed_mime_types']);
        $this->assertSame(['application/pdf' => 1048576], $pdf->attachment_policy['max_bytes_by_mime']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $pdf->attachment_policy_revision);
        $event = AuditEvent::query()->latest('id')->firstOrFail();
        $this->assertSame($pdf->attachment_policy_revision, $event->after['attachment_policy_revision']);
        $this->assertArrayNotHasKey('attachment_policy', $event->after);

        foreach (['attachment_policy' => $default->attachment_policy, 'attachment_policy_revision' => str_repeat('0', 64)] as $key => $value) {
            try {
                $pdf->fresh()->forceFill([$key => $value])->save();
                $this->fail('An issued policy changed.');
            } catch (DomainException) {
                $this->assertSame($pdf->attachment_policy_revision, $pdf->fresh()->attachment_policy_revision);
                $this->assertSame($pdf->attachment_policy, $pdf->fresh()->attachment_policy);
            }
        }
        $this->assertFalse($pdf->isFillable('attachment_policy'));
        $this->assertFalse($pdf->isFillable('attachment_policy_revision'));
    }

    #[DataProvider('invalidRules')]
    public function test_direct_create_cannot_raise_or_replace_authority(array $rules): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        try {
            $this->issue($reservation, $rules);
            $this->fail('Invalid field authority was issued.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_medical_requests', 0);
            $this->assertDatabaseCount('audit_events', 0);
            $this->assertDatabaseCount('setting_values', 0);
        }
    }

    public static function invalidRules(): array
    {
        return [
            [['max_bytes' => 10485761]], [['max_bytes' => '1048576']], [['max_bytes' => 0]],
            [['max_bytes' => 1.5]], [['max_bytes' => true]],
            [['allowed_mime_types' => ['video/mp4']]], [['allowed_mime_types' => []]],
            [['allowed_mime_types' => ['application/pdf', 'application/pdf']]],
            [['section' => 'public_media']], [['type_limits' => ['application/pdf' => 1]]],
        ];
    }

    public function test_api_accepts_doctor_narrowing_and_denies_uploader_rule_replacement(): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        $create = '/api/doctor/reservations/'.$reservation->public_id.'/medical-requests';
        $response = $this->actingAs($reservation->doctor->user, 'sanctum')->postJson($create, [
            'request_type' => 'document', 'title' => 'Synthetic document',
            'attachment_rules' => ['allowed_mime_types' => ['application/pdf'], 'max_bytes' => 1048576],
        ]);
        $this->assertSame(201, $response->status(), $response->content());
        $response->assertJsonPath('data.attachment_rules.state', 'available')
            ->assertJsonPath('data.attachment_rules.max_bytes_by_mime.application/pdf', 1048576)
            ->assertJsonMissingPath('data.attachment_rules.section_revision');
        $medicalRequest = ReservationMedicalRequest::query()->where('public_id', $response->json('data.public_id'))->sole();
        $this->actingAs($reservation->user, 'sanctum')->post($this->path($medicalRequest), [
            'file' => $this->pdf(256), 'attachment_rules' => ['max_bytes' => 10485760], 'section' => 'public_media',
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['attachment_rules', 'section']);
        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_exact_bytes_pass_both_api_and_service_while_one_extra_byte_fails_before_storage(): void
    {
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy([
            'allowed_mime_types' => ['application/pdf'], 'max_bytes' => 1024,
        ])->create();
        $file = $this->upload($request, $this->pdf(1024));
        $this->assertSame(1024, $file->size_bytes);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->scan_status);
        $event = AuditEvent::query()->sole();
        $this->assertSame($request->attachment_policy_revision, $event->after['attachment_policy_revision']);
        $this->assertSame(app(MedicalAttachmentPolicy::class)->forUpload($request->reservation->user, $request)['revision'],
            $event->after['effective_attachment_policy_revision']);
        try {
            $this->upload($request, $this->pdf(1025));
            $this->fail('A direct caller bypassed the field byte limit.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reservation_files', 1);
        }
        $this->actingAs($request->reservation->user, 'sanctum')->post($this->path($request), [
            'file' => $this->pdf(1025),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->actingAs($request->reservation->user, 'sanctum')->post($this->path($request), [
            'file' => $this->pdf(1024),
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->assertDatabaseCount('reservation_files', 2);
        $this->assertCount(2, Storage::disk('private')->allFiles());
    }

    public function test_latest_stored_policy_tightens_but_never_relaxes_an_issued_request(): void
    {
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy(['max_bytes' => 2048])->create();
        $issued = $request->attachment_policy_revision;
        $this->storedLimit(1024);
        $resolver = app(MedicalAttachmentPolicy::class);
        $lower = $resolver->forUpload($request->reservation->user, $request);
        $this->assertSame(1024, $lower['policy']->maxBytesForMime('application/pdf'));
        $this->assertSame($issued, $lower['issued_revision']);
        $this->storedLimit(4096);
        $higher = $resolver->forUpload($request->reservation->user, $request);
        $this->assertSame(2048, $higher['policy']->maxBytesForMime('application/pdf'));
        $this->assertNotSame($lower['revision'], $higher['revision']);
        $this->assertSame($issued, $request->fresh()->attachment_policy_revision);
    }

    public function test_doctor_api_rejects_unknown_fields_types_and_forged_server_snapshots(): void
    {
        $reservation = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        foreach ([
            ['attachment_rules' => ['section' => 'public_media']],
            ['attachment_rules' => ['allowed_mime_types' => ['video/mp4']]],
            ['attachment_rules' => ['max_bytes' => '1024']],
            ['attachment_rules' => ['max_bytes' => 10485761]],
            ['attachment_policy' => ['section' => 'public_media']],
            ['attachment_policy_revision' => str_repeat('0', 64)],
        ] as $fields) {
            $this->actingAs($reservation->doctor->user, 'sanctum')->postJson(
                '/api/doctor/reservations/'.$reservation->public_id.'/medical-requests',
                ['request_type' => 'document', 'title' => 'Synthetic document', ...$fields],
            )->assertUnprocessable();
        }
        $this->assertDatabaseCount('reservation_medical_requests', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_direct_service_rejects_a_section_allowed_type_outside_the_request(): void
    {
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy([
            'allowed_mime_types' => ['application/pdf'],
        ])->create();
        try {
            $this->upload($request, UploadedFile::fake()->create('synthetic.png', 1, 'image/png'));
            $this->fail('Section MIME authority bypassed the request type constraint.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertSame([], Storage::disk('private')->allFiles());
        }
    }

    public function test_removed_types_and_invalid_current_capacity_fail_closed_without_storage(): void
    {
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy(['allowed_mime_types' => ['application/pdf']])->create();
        config(['uploads.sections.medical.allowed_mime_types' => ['image/png']]);
        try {
            $this->upload($request, $this->pdf(512));
            $this->fail('A removed type was accepted.');
        } catch (DomainException) {
            $this->assertSame(['state' => 'unavailable', 'field' => 'file'], app(MedicalAttachmentPolicy::class)->describe($request->reservation->user, $request));
        }
        config(['uploads.sections.medical.allowed_mime_types' => ['application/pdf'], 'uploads.scanner_max_bytes' => 512]);
        try {
            $this->upload($request, $this->pdf(512));
            $this->fail('Invalid current scanner capacity was accepted.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertSame([], Storage::disk('private')->allFiles());
        }
    }

    public function test_missing_and_tampered_snapshots_fail_closed_and_legacy_reads_are_explicit(): void
    {
        $legacy = ReservationMedicalRequest::factory()->create();
        $issued = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        DB::table('reservation_medical_requests')->where('id', $issued->id)->update([
            'attachment_policy_revision' => str_repeat('0', 64),
        ]);
        foreach ([$legacy, $issued] as $request) {
            try {
                $this->upload($request, $this->pdf(512));
                $this->fail('A missing or changed policy was accepted.');
            } catch (DomainException) {
                $this->assertDatabaseCount('reservation_files', 0);
            }
            $this->actingAs($request->reservation->user, 'sanctum')->post($this->path($request), [
                'file' => $this->pdf(512),
            ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('file');
        }
        $this->assertSame(['state' => 'unavailable', 'field' => 'file'], app(MedicalAttachmentPolicy::class)->describe($legacy->reservation->user, $legacy));
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_cross_owner_and_cross_reservation_are_denied_before_rule_disclosure(): void
    {
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $other = Reservation::factory()->create(['user_id' => $request->reservation->user_id]);
        try {
            app(MedicalAttachmentPolicy::class)->forUpload($request->reservation->user, $request, $other);
            $this->fail('A request from a different reservation was resolved.');
        } catch (DomainException) {
            $this->assertDatabaseCount('reservation_files', 0);
        }
        try {
            app(ReservationFileService::class)->uploadForMedicalRequest(Request::create('/files', 'POST'),
                User::factory()->patient()->create(), $request, $this->pdf(512));
            $this->fail('Another patient uploaded.');
        } catch (AuthorizationException) {
            $this->assertSame([], Storage::disk('private')->allFiles());
        }
        $this->actingAs($request->reservation->user, 'sanctum')->post(
            '/api/reservations/'.$other->public_id.'/medical-requests/'.$request->public_id.'/files',
            ['file' => $this->pdf(512)], ['Accept' => 'application/json'],
        )->assertNotFound();
    }

    public function test_transfer_time_policy_change_compensates_the_staged_object_without_audit_or_job(): void
    {
        $request = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $disk = Storage::disk('private');
        $proxy = \Mockery::mock($disk)->makePartial();
        $proxy->shouldReceive('putFileAs')->once()->andReturnUsing(function (...$arguments) use ($disk): string {
            $path = $disk->putFileAs(...$arguments);
            $this->storedLimit(1048576);

            return $path;
        });
        $proxy->shouldReceive('delete')->once()->andReturnUsing(fn ($path) => $disk->delete($path));
        Storage::set('private', $proxy);
        try {
            $this->upload($request, $this->pdf(512));
            $this->fail('A policy revision changed during staging but was accepted.');
        } catch (DomainException $exception) {
            $this->assertStringContainsString('changed during upload', $exception->getMessage());
            $this->assertSame([], $disk->allFiles());
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertDatabaseCount('audit_events', 0);
            $this->assertDatabaseCount('jobs', 0);
        }
    }

    public function test_additive_migration_preserves_legacy_record_and_round_trips_on_disposable_database(): void
    {
        $legacy = ReservationMedicalRequest::factory()->create();
        $migration = require database_path('migrations/2026_10_08_000000_add_attachment_policy_to_medical_requests.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('reservation_medical_requests', 'attachment_policy'));
        $reservation = $legacy->reservation;
        $this->actingAs($reservation->doctor->user, 'sanctum')->postJson(
            '/api/doctor/reservations/'.$reservation->public_id.'/medical-requests',
            ['request_type' => 'document', 'title' => 'Synthetic document'],
        )->assertUnprocessable()->assertJsonPath('errors.medical_request.0', 'request_rejected');
        try {
            app(MedicalAttachmentPolicy::class)->assertSchemaReady();
            $this->fail('An unmigrated schema was accepted.');
        } catch (DomainException) {
            $this->assertDatabaseHas('reservation_medical_requests', ['id' => $legacy->id, 'title' => $legacy->title]);
        }
        $migration->up();
        $this->assertTrue(Schema::hasColumns('reservation_medical_requests', ['attachment_policy', 'attachment_policy_revision']));
        $this->assertNull($legacy->fresh()->attachment_policy);
        $this->assertNull($legacy->fresh()->attachment_policy_revision);
    }

    public function test_schema_rollback_refuses_to_discard_either_policy_column_even_on_archived_requests(): void
    {
        $issued = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create();
        $snapshot = $issued->attachment_policy;
        $revision = $issued->attachment_policy_revision;
        $issued->delete();
        $migration = require database_path('migrations/2026_10_08_000000_add_attachment_policy_to_medical_requests.php');
        foreach ([
            ['attachment_policy' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'attachment_policy_revision' => null],
            ['attachment_policy' => null, 'attachment_policy_revision' => $revision],
        ] as $values) {
            DB::table('reservation_medical_requests')->where('id', $issued->id)->update($values);
            try {
                $migration->down();
                $this->fail('Rollback discarded issued policy history.');
            } catch (DomainException) {
                $this->assertTrue(Schema::hasColumns('reservation_medical_requests', ['attachment_policy', 'attachment_policy_revision']));
                $this->assertDatabaseHas('reservation_medical_requests', ['id' => $issued->id, ...$values]);
                $this->assertNotNull($issued->fresh()->deleted_at);
            }
        }
    }

    public function test_previous_request_columns_support_legacy_insert_read_and_update_with_new_schema(): void
    {
        // Exercise the earlier SQL column set without writing either additive field.
        $legacyAttributes = ReservationMedicalRequest::factory()->make()->getAttributes();
        unset($legacyAttributes['attachment_policy'], $legacyAttributes['attachment_policy_revision']);
        $legacyAttributes['public_id'] = (string) \Illuminate\Support\Str::ulid();
        $legacyAttributes['created_at'] = now();
        $legacyAttributes['updated_at'] = now();
        $id = DB::table('reservation_medical_requests')->insertGetId($legacyAttributes);
        DB::table('reservation_medical_requests')->where('id', $id)->update(['title' => 'Synthetic legacy update']);
        $row = DB::table('reservation_medical_requests')->where('id', $id)->first();
        $this->assertSame('Synthetic legacy update', $row->title);
        $this->assertNull($row->attachment_policy);
        $this->assertNull($row->attachment_policy_revision);
        $this->assertSame(['state' => 'unavailable', 'field' => 'file'], app(MedicalAttachmentPolicy::class)->describe(
            ReservationMedicalRequest::findOrFail($id)->reservation->user, ReservationMedicalRequest::findOrFail($id),
        ));
    }

    private function issue(Reservation $reservation, array $rules = []): ReservationMedicalRequest
    {
        return app(ReservationMedicalRequestService::class)->create(Request::create('/medical-requests', 'POST'),
            $reservation->doctor->user, $reservation, 'document', 'Synthetic document', attachmentRules: $rules);
    }

    private function storedLimit(int $bytes): void
    {
        $definition = SettingDefinition::query()->firstOrCreate(['key' => 'uploads.medical'], [
            'group' => 'uploads', 'value_type' => 'array', 'default_value' => [], 'validation_rules' => [],
            'sensitivity' => 'public', 'allowed_scopes' => ['platform'],
        ]);
        SettingValue::query()->updateOrCreate([
            'setting_definition_id' => $definition->id, 'scope_type' => 'platform',
            'scope_key' => config('settings.scope_keys.marketplace_platform'),
        ], ['value' => ['max_bytes' => $bytes]]);
    }

    private function upload(ReservationMedicalRequest $request, UploadedFile $file): \App\Models\ReservationFile
    {
        return app(ReservationFileService::class)->uploadForMedicalRequest(Request::create('/files', 'POST'),
            $request->reservation->user, $request, $file);
    }

    private function pdf(int $bytes): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", $bytes, ' '));
    }

    private function path(ReservationMedicalRequest $request): string
    {
        return '/api/reservations/'.$request->reservation->public_id.'/medical-requests/'.$request->public_id.'/files';
    }
}
