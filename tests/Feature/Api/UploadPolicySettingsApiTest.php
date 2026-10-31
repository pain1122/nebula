<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\MarketplaceSettingService;
use App\Services\ReservationFileService;
use App\Services\UploadPolicySettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class UploadPolicySettingsApiTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    private const URL = '/api/admin/settings/uploads.medical';

    public function test_root_read_shows_effective_defaults_without_provisioning_or_audit(): void
    {
        $this->actingAs(User::factory()->rootAdmin()->create(), 'sanctum')
            ->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.setting.value', [])
            ->assertJsonPath('data.setting.default_max_bytes', 10485760)
            ->assertJsonPath('data.setting.configured_default_max_bytes', 10485760)
            ->assertJsonPath('data.setting.policy.max_bytes_by_mime.application/pdf', 10485760)
            ->assertJsonPath('data.setting.capacity_max_bytes', 10485760)
            ->assertJsonPath('data.setting.scanner_max_bytes', 10485760);
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_guest_and_non_root_roles_cannot_read_or_write_upload_settings(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        foreach (['admin', 'doctor', 'patient'] as $role) {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->actingAs($actor)
                ->withHeader('Origin', 'http://localhost:3000')
                ->withHeader('Referer', 'http://localhost:3000')
                ->withSession(['auth.password_confirmed_at' => time()])
                ->getJson(self::URL)->assertForbidden();
            $this->putJson(self::URL, $this->payload(['max_bytes' => 1024]))->assertForbidden();
        }
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_write_requires_recent_password_confirmation_and_reason(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $this->actingAs($root)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => 0])
            ->putJson(self::URL, $this->payload(['max_bytes' => 1024]))->assertStatus(423);
        $payload = $this->payload(['max_bytes' => 1024]);
        $payload['reason'] = '   ';
        $this->statefulRoot($root)->putJson(self::URL, $payload)->assertUnprocessable();
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_valid_write_provisions_only_its_definition_and_audits_before_after(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $first = ['max_bytes' => 2048, 'type_limits' => ['application/pdf' => 1024]];
        $this->statefulRoot($root)->putJson(self::URL, $this->payload($first))->assertOk();
        $this->assertDatabaseCount('setting_definitions', 1);
        $this->assertDatabaseCount('setting_values', 1);
        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.setting.default_max_bytes', 2048)
            ->assertJsonPath('data.setting.policy.max_bytes_by_mime.application/pdf', 1024)
            ->assertJsonPath('data.setting.policy.max_bytes_by_mime.image/png', 2048);
        $event = AuditEvent::query()->sole();
        $this->assertNull($event->before);
        $this->assertSame($first, $event->after['value']);
        $this->assertSame('Synthetic upload policy review', $event->reason);
        $this->assertSame('high', $event->risk_level);

        $this->statefulRoot($root)->putJson(self::URL, $this->payload(['max_bytes' => 4096]))->assertOk();
        $event = AuditEvent::query()->latest('id')->firstOrFail();
        $this->assertSame($first, $event->before['value']);
        $this->assertSame(['max_bytes' => 4096], $event->after['value']);
        $this->assertDatabaseCount('setting_definitions', 1);
        $this->assertDatabaseCount('setting_values', 1);
    }

    #[DataProvider('invalidValues')]
    public function test_invalid_policy_does_not_provision_or_write(array $value): void
    {
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson(self::URL, $this->payload($value))->assertUnprocessable();
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public static function invalidValues(): array
    {
        return [
            [['max_bytes' => 10485761]],
            [['max_bytes' => 0]],
            [['max_bytes' => -1]],
            [['max_bytes' => true]],
            [['max_bytes' => '1024']],
            [['max_bytes' => 1.5]],
            [['type_limits' => ['video/mp4' => 1024]]],
            [['type_limits' => ['application/pdf' => 10485761]]],
            [['type_limits' => ['application/pdf' => null]]],
            [['type_limits' => 'unlimited']],
            [['allowed_mime_types' => ['video/mp4']]],
            [['capacity_max_bytes' => 1073741824]],
            [['scan_required' => false]],
        ];
    }

    public function test_medical_limit_cannot_exceed_scanner_capacity_and_scope_cannot_widen(): void
    {
        config(['uploads.scanner_max_bytes' => 1024]);
        $root = User::factory()->rootAdmin()->create();
        $this->statefulRoot($root)->putJson(self::URL, $this->payload(['max_bytes' => 2048]))->assertUnprocessable();
        $payload = $this->payload(['max_bytes' => 1024]);
        $payload['scope_type'] = 'site';
        $this->putJson(self::URL, $payload)->assertUnprocessable();
        $payload['scope_type'] = 'platform';
        $payload['scope_key'] = 'another-site';
        $this->putJson(self::URL, $payload)->assertUnprocessable();
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_audit_failure_rolls_back_new_definition_and_value(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('synthetic audit failure'));
        });
        try {
            app(MarketplaceSettingService::class)->set(Request::create(self::URL, 'PUT'), $root,
                'uploads.medical', 'platform', 'marketplace', ['max_bytes' => 1024], 'Synthetic review',
                app(UploadPolicySettings::class)->revision('uploads.medical'));
            $this->fail('An unaudited setting must not persist.');
        } catch (RuntimeException $exception) {
            $this->assertSame('synthetic audit failure', $exception->getMessage());
        }
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_saved_limit_is_enforced_by_upload_service_with_exact_bytes(): void
    {
        Storage::fake('private');
        $root = User::factory()->rootAdmin()->create();
        $this->statefulRoot($root)->putJson(self::URL, $this->payload(['type_limits' => ['application/pdf' => 32]]))->assertOk();
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);
        $service = app(ReservationFileService::class);
        try {
            $service->upload(Request::create('/upload', 'POST'), $owner, $reservation,
                UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", 33, ' ')));
            $this->fail('One byte over the saved type limit must be rejected.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reservation_files', 0);
            $this->assertDatabaseCount('audit_events', 1);
            $this->assertSame([], Storage::disk('private')->allFiles());
        }
        $file = $service->upload(Request::create('/upload', 'POST'), $owner, $reservation,
            UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", 32, ' ')));
        $this->assertSame(32, $file->size_bytes);
        $this->assertSame(ReservationFileScanStatus::Quarantined, $file->scan_status);
    }

    public function test_patient_upload_endpoint_uses_saved_type_limit_and_keeps_file_quarantined(): void
    {
        Storage::fake('private');
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson(self::URL, $this->payload(['type_limits' => ['application/pdf' => 32]]))->assertOk();
        $reservation = Reservation::factory()->create();
        $medicalRequest = ReservationMedicalRequest::factory()->withAttachmentPolicy()->create(['reservation_id' => $reservation->id]);
        $url = '/api/reservations/'.$reservation->public_id.'/medical-requests/'.$medicalRequest->public_id.'/files';
        $this->actingAs($reservation->user, 'sanctum')->post($url, [
            'file' => UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", 33, ' ')),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('reservation_files', 0);
        $this->assertDatabaseCount('audit_events', 1);
        $this->assertSame([], Storage::disk('private')->allFiles());
        $this->post($url, [
            'file' => UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", 32, ' ')),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.available', false);
        $this->assertSame(32, $medicalRequest->files()->sole()->size_bytes);
    }

    public function test_lower_saved_limit_preserves_historical_verified_download(): void
    {
        Storage::fake('private');
        $owner = User::factory()->patient()->create();
        $reservation = Reservation::factory()->create(['user_id' => $owner->id]);
        $service = app(ReservationFileService::class);
        $contents = \Tests\Fixtures\SyntheticMedicalFiles::pdf();
        $file = $service->upload(Request::create('/upload', 'POST'), $owner, $reservation,
            UploadedFile::fake()->createWithContent('synthetic.pdf', $contents), retentionUntil: now()->addYear());
        // The scan transition is exercised only in this isolated synthetic test.
        $file = $service->recordScan(Request::create('/scan'), $file, ReservationFileScanStatus::Clean, $file->checksum_sha256);
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson(self::URL, $this->payload(['max_bytes' => 1]))->assertOk();
        $response = $service->download(Request::create('/download'), $owner, $file);
        ob_start();
        try {
            $response->sendContent();
            $this->assertSame($contents, ob_get_contents());
        } finally {
            ob_end_clean();
        }
        $this->assertSame(1, AuditEvent::query()->where('action', 'reservation_file.accessed')->count());
    }

    public function test_reset_restores_operator_defaults_and_corrupt_stored_value_fails_closed(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $this->statefulRoot($root)->putJson(self::URL, $this->payload(['max_bytes' => 1024]))->assertOk();
        $this->putJson(self::URL, $this->payload([]))->assertOk();
        config(['uploads.sections.medical.max_bytes' => 2048]);
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.setting.policy.max_bytes_by_mime.application/pdf', 2048);
        SettingValue::query()->sole()->forceFill(['value' => ['scan_required' => false]])->save();
        $this->expectException(ValidationException::class);
        app(UploadPolicySettings::class)->forSection('medical');
    }

    public function test_public_section_is_independent_and_unknown_keys_cannot_be_provisioned(): void
    {
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson('/api/admin/settings/uploads.public_media', $this->payload(['max_bytes' => 1024], 'uploads.public_media'))->assertOk();
        $this->getJson('/api/admin/settings/uploads.public_media')->assertOk()
            ->assertJsonPath('data.setting.policy.max_bytes_by_mime.image/webp', 1024)
            ->assertJsonPath('data.setting.scanner_max_bytes', null);
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.setting.policy.max_bytes_by_mime.application/pdf', 10485760);
        $this->putJson('/api/admin/settings/uploads.unregistered', $this->payload([]))->assertNotFound();
        $this->getJson('/api/admin/settings/uploads.unregistered')->assertNotFound();
        $this->assertSame(['uploads.public_media'], SettingDefinition::query()->pluck('key')->all());
    }

    public function test_policy_change_rejects_stale_write_without_mutation(): void
    {
        $root = User::factory()->rootAdmin()->create();
        $stale = $this->payload(['max_bytes' => 1024, 'type_limits' => ['image/jpeg' => 32]]);
        config(['uploads.sections.medical.allowed_mime_types' => ['application/pdf', 'image/png']]);
        $this->statefulRoot($root)->putJson(self::URL, $stale)->assertUnprocessable()->assertJsonValidationErrors('expected_revision');
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
        $this->putJson(self::URL, $this->payload(['max_bytes' => 2048]))->assertOk();
        $this->putJson(self::URL, $stale)->assertUnprocessable()->assertJsonValidationErrors('expected_revision');
        $this->assertSame(['max_bytes' => 2048], SettingValue::query()->sole()->value);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_reduced_capacity_offers_reviewed_repair_without_relaxing_upload_policy(): void
    {
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson(self::URL, $this->payload(['max_bytes' => 4096]))->assertOk();
        config(['uploads.scanner_max_bytes' => 2048]);
        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.setting.policy_state', 'review_required')
            ->assertJsonPath('data.setting.default_max_bytes', 2048);
        try {
            app(UploadPolicySettings::class)->forSection('medical');
            $this->fail('An invalid saved policy must not use the repair suggestion for uploads.');
        } catch (ValidationException) {
            $this->assertDatabaseCount('audit_events', 1);
        }
        $this->putJson(self::URL, $this->payload(['max_bytes' => 1024]))->assertOk();
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.setting.policy_state', 'active');
        $this->assertSame(1024, app(UploadPolicySettings::class)->forSection('medical')->maxBytesForMime('application/pdf'));
    }

    public function test_a_fresh_policy_revision_is_required_before_the_first_write(): void
    {
        $payload = $this->payload(['max_bytes' => 1024]);
        unset($payload['expected_revision']);
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson(self::URL, $payload)->assertUnprocessable()->assertJsonValidationErrors('expected_revision');
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_null_stored_policy_cannot_fall_back_to_looser_defaults(): void
    {
        $this->statefulRoot(User::factory()->rootAdmin()->create())
            ->putJson(self::URL, $this->payload(['max_bytes' => 1024]))->assertOk();
        SettingValue::query()->sole()->forceFill(['value' => null])->save();
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.setting.policy_state', 'review_required');
        $this->assertDatabaseCount('audit_events', 1);
        $this->expectException(ValidationException::class);
        app(UploadPolicySettings::class)->forSection('medical');
    }

    private function payload(array $value, string $key = 'uploads.medical'): array
    {
        return ['scope_type' => 'platform', 'scope_key' => 'marketplace', 'value' => $value,
            'expected_revision' => app(UploadPolicySettings::class)->revision($key),
            'reason' => 'Synthetic upload policy review'];
    }

    private function statefulRoot(User $root): static
    {
        return $this->actingAs($root)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()]);
    }
}
