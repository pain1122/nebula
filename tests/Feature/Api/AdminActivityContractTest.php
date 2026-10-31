<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminActivityContractTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated activity acceptance only.');
        }
        parent::setUp();
    }

    private function user(string $role = 'patient'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);

        return $user;
    }

    private function actor(User $user): static
    {
        return $this->actingAs($user)->withHeader('Origin', 'http://localhost:3000')->withHeader('Referer', 'http://localhost:3000');
    }

    private function event(User $actor, array $attributes = []): AuditEvent
    {
        return AuditEvent::factory()->create(array_merge([
            'actor_user_id' => $actor->id, 'action' => 'reservation.completed',
            'subject_type' => Reservation::class, 'subject_id' => 99,
            'subject_public_id' => strtolower((string) \Illuminate\Support\Str::ulid()),
            'actor_name_snapshot' => 'PRIVATE SNAPSHOT', 'reason' => 'PRIVATE REASON',
            'before' => ['password' => 'PRIVATE PASSWORD'], 'after' => ['body' => 'PRIVATE CLINICAL BODY'],
            'ip' => '192.0.2.12', 'user_agent' => 'PRIVATE AGENT', 'route' => 'PRIVATE ROUTE',
        ], $attributes));
    }

    public function test_only_allowlisted_metadata_is_returned_without_raw_audit_or_private_user_fields(): void
    {
        $doctor = $this->user('doctor');
        $event = $this->event($doctor);
        $this->event($doctor, ['action' => 'unknown.private.event']);
        $before = AuditEvent::count();
        $response = $this->actor($this->user('admin'))->getJson('/api/admin/activity')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('meta.pagination.total', 1);
        $row = $response->json('data.0');
        $this->assertSame($event->public_id, $row['public_id']);
        $this->assertSame('reservation', $row['category']);
        $this->assertSame($doctor->public_id, $row['actor']['public_id']);
        $this->assertTrue($row['reason_recorded']);
        $this->assertEqualsCanonicalizing(['public_id', 'action', 'category', 'actor', 'subject_public_id', 'risk', 'outcome', 'reason_recorded', 'created_at'], array_keys($row));
        foreach (['PRIVATE', '192.0.2.12', $doctor->email, $doctor->phone] as $secret) {
            $this->assertStringNotContainsString($secret, $response->getContent());
        }
        $this->assertSame($before, AuditEvent::count());
    }

    public function test_privileged_subjects_are_scoped_and_privileged_actor_identity_is_masked(): void
    {
        $admin = $this->user('admin');
        $otherAdmin = $this->user('admin');
        $root = $this->user('root-admin');
        $patient = $this->user();
        $this->event($root, ['action' => 'admin.user.updated', 'subject_type' => User::class, 'subject_id' => $root->id]);
        $this->event($root, ['action' => 'admin.user.updated', 'subject_type' => User::class, 'subject_id' => $otherAdmin->id]);
        $visible = $this->event($root, ['action' => 'admin.user.updated', 'subject_type' => User::class, 'subject_id' => $patient->id]);
        $response = $this->actor($admin)->getJson('/api/admin/activity')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->assertSame($visible->public_id, $response->json('data.0.public_id'));
        $this->assertSame(['public_id' => null, 'name' => null, 'role' => null, 'identity_available' => false], $response->json('data.0.actor'));
        $this->getJson('/api/admin/activity?actor_id='.$root->id)->assertForbidden();
        $this->getJson('/api/admin/activity?actor_role=root-admin')->assertForbidden();
        $this->actor($root)->getJson('/api/admin/activity')->assertOk()->assertJsonPath('meta.pagination.total', 3);
        $otherRoot = $this->user('root-admin');
        $this->actor($otherRoot)->getJson('/api/admin/activity')->assertOk()->assertJsonPath('meta.pagination.total', 2);
    }

    public function test_composed_filters_and_tied_pages_are_stable(): void
    {
        $doctor = $this->user('doctor');
        $time = now()->startOfSecond();
        $first = $this->event($doctor, ['risk_level' => 'high', 'created_at' => $time]);
        $second = $this->event($doctor, ['risk_level' => 'high', 'created_at' => $time]);
        $this->event($this->user(), ['risk_level' => 'low']);
        $this->actor($this->user('admin'));
        $query = 'category=reservation&action=reservation.completed&risk=high&actor_role=doctor&actor_id='.$doctor->id.'&per_page=1';
        $this->getJson('/api/admin/activity?'.$query)->assertOk()->assertJsonPath('meta.pagination.total', 2)->assertJsonPath('data.0.public_id', $second->public_id);
        $this->getJson('/api/admin/activity?'.$query.'&page=2')->assertOk()->assertJsonPath('data.0.public_id', $first->public_id);
        $this->getJson('/api/admin/activity?q='.$first->public_id)->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/activity?subject_public_id='.$first->subject_public_id)->assertOk()->assertJsonPath('meta.pagination.total', 1);
    }

    public function test_calendar_bounds_use_tehran_midnights_and_require_ordered_bounded_dates(): void
    {
        $actor = $this->user('doctor');
        $this->event($actor, ['created_at' => '2026-10-12 20:29:59']);
        $inside = $this->event($actor, ['created_at' => '2026-10-12 20:30:00']);
        $this->event($actor, ['created_at' => '2026-10-13 20:29:59']);
        $this->event($actor, ['created_at' => '2026-10-13 20:30:00']);
        $this->actor($this->user('admin'))->getJson('/api/admin/activity?from=2026-10-13&to=2026-10-13')->assertOk()
            ->assertJsonPath('meta.pagination.total', 2)->assertJsonPath('meta.period.timezone', 'Asia/Tehran');
        $this->getJson('/api/admin/activity?q='.$inside->public_id.'&from=2026-10-13&to=2026-10-13')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        foreach (['from=2026-10-13', 'to=2026-10-13', 'from[]=2026-10-13&to=2026-10-14',
            'from=2026-02-30&to=2026-03-01', 'from=2026-10-14&to=2026-10-13', 'from=2026-01-01&to=2026-04-01'] as $query) {
            $this->getJson('/api/admin/activity?'.$query)->assertUnprocessable();
        }
        $this->getJson('/api/admin/activity?from=2026-01-01&to=2026-03-31')->assertOk();
    }

    public function test_invalid_shapes_unsupported_search_and_non_admin_access_refuse(): void
    {
        $this->getJson('/api/admin/activity')->assertUnauthorized();
        $this->actor($this->user('admin'));
        foreach (['action[]=reservation.completed', 'category=unknown', 'risk=unknown', 'q=private@example.test',
            'actor_id=-1', 'page=1001', 'per_page=101', 'sort_dir=unknown', 'sort_by=reason', 'before=password'] as $query) {
            $this->getJson('/api/admin/activity?'.$query)->assertUnprocessable();
        }
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($this->user($role))->getJson('/api/admin/activity')->assertForbidden();
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_deleted_actor_uses_no_saved_identity_and_private_reason_is_only_a_flag(): void
    {
        $doctor = $this->user('doctor');
        $this->event($doctor, ['reason' => null]);
        $doctor->delete();
        $this->actor($this->user('admin'))->getJson('/api/admin/activity')->assertOk()
            ->assertJsonPath('data.0.actor.identity_available', false)->assertJsonPath('data.0.actor.name', null)
            ->assertJsonPath('data.0.reason_recorded', false);
    }

    public function test_cached_authority_and_role_revocation_during_the_read_do_not_release_metadata(): void
    {
        $admin = $this->user('admin');
        $this->event($this->user('doctor'));
        $admin->load('roles');
        $this->actor($admin);
        $changed = false;
        \Illuminate\Support\Facades\DB::listen(function ($query) use ($admin, &$changed): void {
            if (! $changed && str_contains($query->sql, 'audit_events')) {
                $changed = true;
                User::findOrFail($admin->id)->syncRoles(['patient']);
            }
        });
        $this->getJson('/api/admin/activity')->assertForbidden();
        $this->assertTrue($changed);
    }

    public function test_mismatched_subject_types_refuse_discovery_and_admin_medical_actions_remain_visible(): void
    {
        $actor = $this->user('admin');
        $this->event($actor, ['action' => 'admin.user.updated', 'subject_type' => Reservation::class]);
        $this->event($actor, ['subject_type' => 'unknown.private.model']);
        $visible = $this->event($actor, ['action' => 'admin.medical_report.published', 'subject_type' => \App\Models\ReservationReport::class]);
        $this->actor($actor)->getJson('/api/admin/activity')->assertOk()->assertJsonPath('meta.pagination.total', 1)
            ->assertJsonPath('data.0.public_id', $visible->public_id)->assertJsonPath('data.0.category', 'medical');
    }
}
