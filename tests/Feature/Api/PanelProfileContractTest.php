<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\QuestionnaireSubmission;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\PanelProfileService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class PanelProfileContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated profile acceptance only.');
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
            throw new RuntimeException('Profile tests require isolated SQLite and skip project environment/cache.');
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

    private function user(string $role = 'patient'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);

        return $user;
    }

    private function path(User $subject): string
    {
        return '/api/admin/users/'.$subject->public_id.'/support-profile';
    }

    private function stateful(User $actor): static
    {
        return $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000');
    }

    private function payload(User $subject): array
    {
        return ['first_name' => 'Support', 'last_name' => 'Display', 'reason' => 'Synthetic display correction',
            'expected_revision' => app(PanelProfileService::class)->revision($subject)];
    }

    public function test_self_and_support_share_only_allowlisted_profile_fields(): void
    {
        $subject = $this->user();
        $subject->forceFill(['bio' => 'PRIVATE BIO', 'NID' => '9876543210', 'email' => 'private@example.test'])->save();
        $self = $this->stateful($subject)->getJson('/api/panel-profile')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->json('data');
        $admin = $this->user('admin');
        $support = $this->stateful($admin)->getJson($this->path($subject))->assertOk()->json('data');
        $this->assertSame($self['user'], $support['user']);
        $this->assertSame($self['summary'], $support['summary']);
        $this->assertSame(['first_name', 'last_name'], $support['editable_fields']);
        $this->assertSame('support', $support['mode']);
        foreach (['email', 'phone', 'password', 'NID', 'birth_date', 'bio', 'city', 'country', 'zip_code',
            'profile', 'tokens', 'sessions', 'remember_token', 'patient_status'] as $field) {
            $this->assertArrayNotHasKey($field, $support['user']);
        }
        $this->assertStringNotContainsString('PRIVATE BIO', json_encode($support));
        $this->assertStringNotContainsString('private@example.test', json_encode($support));
    }

    public function test_support_authority_excludes_patients_doctors_and_root_subjects(): void
    {
        $subject = $this->user();
        foreach (['patient', 'doctor'] as $role) {
            $this->stateful($this->user($role))->getJson($this->path($subject))->assertForbidden();
        }
        $admin = $this->user('admin');
        $root = $this->user('root-admin');
        $this->stateful($admin)->getJson($this->path($root))->assertForbidden();
        $this->stateful($admin)->getJson($this->path($this->user('admin')))->assertForbidden();
        $this->stateful($root)->getJson($this->path($admin))->assertOk();
        $this->getJson($this->path($root))->assertForbidden();
        $this->getJson('/api/admin/users/INVALID/support-profile')->assertNotFound();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_reports_and_submissions_are_metadata_only_scoped_and_bounded(): void
    {
        $subject = $this->user();
        $reservation = Reservation::factory()->create(['user_id' => $subject->id]);
        $medical = ReservationMedicalRequest::factory()->create(['reservation_id' => $reservation->id]);
        for ($i = 0; $i < 12; $i++) {
            ReservationReport::factory()->published()->create([
                'reservation_id' => $reservation->id, 'medical_request_id' => $medical->id,
                'body' => 'SECRET CLINICAL BODY',
            ]);
        }
        ReservationReport::factory()->create(['reservation_id' => $reservation->id, 'medical_request_id' => $medical->id]);
        ReservationReport::factory()->published()->create([
            'reservation_id' => $reservation->id, 'medical_request_id' => $medical->id, 'retention_until' => now()->subDay(),
        ]);
        QuestionnaireSubmission::factory()->create(['user_id' => $subject->id,
            'answers_json' => ['SECRET ANSWER'], 'result_body_html' => 'SECRET RESULT', 'total_score' => 99]);
        Reservation::factory()->create();
        $profile = $this->stateful($this->user('admin'))->getJson($this->path($subject))->assertOk()->json('data');
        $this->assertSame(1, $profile['summary']['reservations']);
        $this->assertSame(1, $profile['summary']['medical_requests']);
        $this->assertSame(12, $profile['summary']['published_reports']);
        $this->assertCount(10, $profile['reports']);
        $this->assertCount(1, $profile['submissions']);
        $this->assertSame(['public_id', 'status', 'published_at', 'is_amendment'], array_keys($profile['reports'][0]));
        $this->assertSame(['public_id', 'status', 'created_at'], array_keys($profile['submissions'][0]));
        $this->assertStringNotContainsString('SECRET', json_encode($profile));
        $this->assertArrayNotHasKey('title', $profile['requests'][0]);
        $this->assertArrayNotHasKey('total_score', $profile['submissions'][0]);
    }

    public function test_doctor_profile_includes_assigned_reservations_without_patient_details(): void
    {
        $reservation = Reservation::factory()->create();
        $doctor = $reservation->doctor->user;
        $doctor->syncRoles(['doctor']);
        $profile = $this->stateful($this->user('admin'))->getJson($this->path($doctor))->assertOk()->json('data');
        $this->assertSame(1, $profile['summary']['reservations']);
        $this->assertSame((string) $reservation->public_id, $profile['reservations'][0]['public_id']);
        foreach (['user_id', 'patient', 'doctor_name_snapshot', 'price_snapshot', 'checkup_title_snapshot'] as $field) {
            $this->assertArrayNotHasKey($field, $profile['reservations'][0]);
        }
    }

    public function test_activity_never_exposes_audit_payloads_or_other_actors(): void
    {
        $subject = $this->user();
        $audit = ['subject_type' => User::class, 'subject_id' => $subject->id, 'risk_level' => 'high', 'outcome' => 'success'];
        AuditEvent::create([...$audit, 'actor_user_id' => $subject->id, 'action' => 'reservation.completed',
            'reason' => 'SECRET REASON', 'before' => ['body' => 'SECRET BODY'], 'ip' => '192.0.2.5']);
        AuditEvent::create([...$audit, 'actor_user_id' => $subject->id, 'action' => 'auth.login', 'reason' => 'SECRET SECURITY']);
        AuditEvent::create([...$audit, 'actor_user_id' => $this->user()->id, 'action' => 'reservation.completed']);
        $profile = $this->stateful($this->user('admin'))->getJson($this->path($subject))->assertOk()->json('data');
        $this->assertCount(1, $profile['activity']);
        $this->assertSame(['public_id', 'action', 'created_at'], array_keys($profile['activity'][0]));
        $this->assertStringNotContainsString('SECRET', json_encode($profile));
        $this->assertStringNotContainsString('192.0.2.5', json_encode($profile));
    }

    public function test_successful_edit_changes_only_display_names_and_audits_transactionally(): void
    {
        $admin = $this->user('admin');
        $subject = $this->user();
        $before = $subject->getRawOriginal();
        $this->stateful($admin)->withSession(['auth.password_confirmed_at' => time()])
            ->putJson($this->path($subject), $this->payload($subject))->assertOk()
            ->assertJsonPath('data.user.name', 'Support Display');
        $after = $subject->fresh()->getRawOriginal();
        foreach (['password', 'email', 'phone', 'NID', 'birth_date', 'bio', 'account_state', 'patient_status'] as $field) {
            $this->assertSame($before[$field] ?? null, $after[$field] ?? null);
        }
        $event = AuditEvent::firstOrFail();
        $this->assertSame($admin->id, $event->actor_user_id);
        $this->assertSame($subject->id, $event->subject_id);
        $this->assertSame('admin.profile.display_name.updated', $event->action);
        $this->assertSame(['first_name' => 'Support', 'last_name' => 'Display'], $event->after);
        $this->assertSame('Synthetic display correction', $event->reason);
    }

    public function test_unknown_sensitive_fields_are_rejected_including_empty_values(): void
    {
        $subject = $this->user();
        $this->stateful($this->user('admin'))->withSession(['auth.password_confirmed_at' => time()]);
        foreach (['email', 'phone', 'password', 'NID', 'birth_date', 'bio', 'role', 'account_state',
            'patient_status', 'profile', 'allergies', 'sessions', 'unexpected'] as $field) {
            $this->putJson($this->path($subject), [...$this->payload($subject), $field => null])->assertUnprocessable();
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_stale_revision_missing_reason_and_noop_fail_without_audit(): void
    {
        $subject = $this->user();
        $this->stateful($this->user('admin'))->withSession(['auth.password_confirmed_at' => time()]);
        $this->putJson($this->path($subject), [...$this->payload($subject), 'expected_revision' => str_repeat('0', 64)])->assertConflict();
        $this->putJson($this->path($subject), [...$this->payload($subject), 'reason' => '   '])->assertUnprocessable();
        $this->putJson($this->path($subject), [...$this->payload($subject),
            'first_name' => $subject->first_name, 'last_name' => $subject->last_name])->assertUnprocessable();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_password_confirmation_is_required_for_self_and_support(): void
    {
        $subject = $this->user();
        $this->stateful($this->user('admin'))->withSession([])
            ->putJson($this->path($subject), $this->payload($subject))->assertStatus(423);
        $this->stateful($subject)->withSession(['auth.password_confirmed_at' => time() - 901])
            ->putJson('/api/panel-profile', $this->payload($subject))->assertStatus(423);
        $this->actingAs($subject, 'sanctum')->withHeader('Origin', '')->withHeader('Referer', '')
            ->putJson('/api/panel-profile', $this->payload($subject))->assertStatus(423);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_audit_failure_rolls_back_the_name(): void
    {
        $subject = $this->user();
        $subject = $subject->fresh();
        $before = $subject->getRawOriginal();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('Synthetic audit failure'));
        });
        $this->stateful($this->user('admin'))->withSession(['auth.password_confirmed_at' => time()])
            ->putJson($this->path($subject), $this->payload($subject))->assertStatus(500);
        $this->assertSame($before, $subject->fresh()->getRawOriginal());
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_revision_does_not_reuse_an_old_token_after_a_same_second_name_reversion(): void
    {
        $subject = $this->user();
        $original = $this->payload($subject);
        $this->stateful($this->user('admin'))->withSession(['auth.password_confirmed_at' => time()]);
        $this->putJson($this->path($subject), $original)->assertOk();
        $updated = $subject->fresh();
        $this->putJson($this->path($subject), [...$this->payload($updated),
            'first_name' => $subject->first_name, 'last_name' => $subject->last_name])->assertOk();
        $this->putJson($this->path($subject), $original)->assertConflict();
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_self_save_and_transaction_recheck_keep_role_authority(): void
    {
        $subject = $this->user();
        $this->stateful($subject)->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/panel-profile', $this->payload($subject))->assertOk();
        $this->assertSame('profile.display_name.updated', AuditEvent::firstOrFail()->action);
        $admin = $this->user('admin');
        $payload = $this->payload($subject->fresh());
        $cachedActor = $admin->fresh()->load('roles');
        $admin->syncRoles(['patient']);
        try {
            app(PanelProfileService::class)->update(request(), $cachedActor, $subject, true, $payload);
            $this->fail('A revoked admin must be refused under transaction locks.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_legacy_list_show_and_created_resource_never_return_private_values(): void
    {
        $subject = $this->user();
        $this->stateful($this->user('root-admin'));
        foreach (['/api/admin/users?q='.$subject->public_id, '/api/admin/users/'.$subject->id] as $path) {
            $response = $this->getJson($path)->assertOk();
            $wire = $response->json('data');
            $user = $wire['user'] ?? $wire['users'][0];
            foreach (['email', 'phone', 'NID', 'birth_date', 'bio', 'city', 'country', 'zip_code'] as $field) {
                $this->assertNull($user[$field]);
            }
            $this->assertStringNotContainsString($subject->email, $response->getContent());
        }
    }

    public function test_legacy_search_and_sort_cannot_infer_private_identity(): void
    {
        $subject = $this->user();
        $this->stateful($this->user('admin'));
        foreach ([$subject->email, $subject->phone, $subject->NID] as $term) {
            $this->getJson('/api/admin/users?q='.urlencode($term))->assertOk()->assertJsonPath('meta.pagination.total', 0);
        }
        foreach (['email', 'phone', 'NID', 'birth_date'] as $column) {
            $this->getJson('/api/admin/users?sort_by='.$column)->assertUnprocessable();
        }
        $this->getJson('/api/admin/users?q[]=invalid')->assertUnprocessable();
    }

    public function test_legacy_update_rejects_every_private_field_even_when_null(): void
    {
        $subject = $this->user();
        $this->stateful($this->user('root-admin'))->withSession(['auth.password_confirmed_at' => time()]);
        foreach (['email', 'phone', 'NID', 'birth_date', 'bio', 'city', 'country', 'zip_code', 'password', 'password_confirmation', 'profile', 'allergies'] as $field) {
            $this->putJson('/api/admin/users/'.$subject->id, [...$this->payload($subject), 'role' => 'patient', $field => null])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_legacy_role_management_preserves_root_ownership_revision_and_audit(): void
    {
        $subject = $this->user();
        $body = [...$this->payload($subject), 'role' => 'admin'];
        $this->stateful($this->user('admin'))->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/users/'.$subject->id, $body)->assertForbidden();
        $this->stateful($this->user('root-admin'))->withSession(['auth.password_confirmed_at' => time()])
            ->putJson('/api/admin/users/'.$subject->id, [...$body, 'expected_revision' => str_repeat('0', 64)])->assertConflict();
        $this->putJson('/api/admin/users/'.$subject->id, $body)->assertOk()->assertJsonPath('data.user.role', 'admin');
        $event = AuditEvent::firstOrFail();
        $this->assertSame('admin.user.updated', $event->action);
        $this->assertArrayNotHasKey('email', $event->after);
        $this->assertSame('Synthetic display correction', $event->reason);
        $this->putJson('/api/admin/users/'.$subject->id, $body)->assertConflict();
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_related_admin_resources_and_search_do_not_reveal_private_contacts(): void
    {
        $reservation = Reservation::factory()->create();
        $doctor = $reservation->doctor;
        $doctor->forceFill(['phone' => '09870000001'])->save();
        $submission = QuestionnaireSubmission::factory()->create(['user_id' => $reservation->user_id,
            'submitter_phone' => '09870000002', 'guest_phone' => '09870000003']);
        $this->stateful($this->user('admin'));
        $this->getJson('/api/admin/doctors')->assertOk()->assertDontSee($doctor->user->email)->assertDontSee('09870000001');
        $this->getJson('/api/admin/doctors?q='.urlencode($doctor->user->email))->assertOk()->assertJsonPath('data.total', 0);
        $this->getJson('/api/admin/doctors?q=09870000001')->assertOk()->assertJsonPath('data.total', 0);
        $this->getJson('/api/admin/reservations/'.$reservation->id)->assertOk()->assertJsonPath('data.patient.email', null);
        $this->getJson('/api/admin/reservations?q='.urlencode($reservation->user->email))->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/admin/questionnaire-submissions/'.$submission->id)->assertOk()->assertJsonPath('data.submitter_phone', null)->assertDontSee('09870000002')->assertDontSee('09870000003');
        $this->getJson('/api/admin/questionnaire-submissions?q=09870000002')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/admin/questionnaire-submissions?sort_by=guest_phone')->assertUnprocessable();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_medical_upload_activity_uses_the_existing_safe_attachment_category(): void
    {
        $subject = $this->user();
        AuditEvent::create(['actor_user_id' => $subject->id, 'subject_type' => User::class,
            'subject_id' => $subject->id, 'risk_level' => 'high', 'action' => 'reservation_medical_file.uploaded',
            'after' => ['label' => 'SECRET CLINICAL LABEL'], 'reason' => 'SECRET REASON']);
        $profile = $this->stateful($this->user('admin'))->getJson($this->path($subject))->assertOk()->json('data');
        $this->assertCount(1, $profile['activity']);
        $this->assertSame('reservation_file.uploaded', $profile['activity'][0]['action']);
        $this->assertSame(['public_id', 'action', 'created_at'], array_keys($profile['activity'][0]));
        $this->assertStringNotContainsString('SECRET', json_encode($profile));
    }
}
