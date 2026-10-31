<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class AdminCatalogMutationTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Isolated catalog acceptance only.');
        }
        parent::setUp();
    }

    private function actor(string $role = 'admin'): User
    {
        $actor = User::factory()->create();
        $actor->syncRoles([$role]);
        $this->actingAs($actor)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000'])->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function revision(string $kind, ?int $id = null): string
    {
        return $this->getJson('/api/admin/catalog/'.$kind.'/context'.($id ? '/'.$id : ''))->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data.revision');
    }

    private function payload(string $kind, ?int $id = null): array
    {
        $body = ['slug' => 'catalog-'.$kind, $kind === 'checkups' ? 'title' : 'name' => 'Synthetic '.$kind, 'reason' => 'Synthetic policy acceptance.', 'confirmed' => true];
        if ($kind === 'checkups') {
            $body += ['price' => '1234567', 'currency' => 'IRR', 'default_duration_minutes' => 30, 'checkup_category_id' => null];
        }
        if ($kind !== 'specialties') {
            $body['description'] = 'Synthetic description';
        }

        return $body + ['expected_revision' => $this->revision($kind, $id)];
    }

    public function test_all_three_kinds_create_and_update_with_exact_revision_reason_and_atomic_audit(): void
    {
        $this->actor();
        foreach (['checkups', 'checkup-categories', 'specialties'] as $kind) {
            $body = $this->payload($kind);
            $id = $this->postJson('/api/admin/'.$kind, $body)->assertCreated()->json('data.id');
            $this->postJson('/api/admin/'.$kind, $body)->assertConflict();
            $change = $this->payload($kind, $id);
            $change[$kind === 'checkups' ? 'title' : 'name'] = 'Updated synthetic '.$kind;
            $this->putJson('/api/admin/'.$kind.'/'.$id, $change)->assertOk();
        }
        $this->assertDatabaseCount('audit_events', 6);
        $this->assertSame(1234567, Checkup::first()->price);
        $this->assertTrue(AuditEvent::all()->every(fn ($event) => $event->reason === 'Synthetic policy acceptance.' && $event->batch_id && $event->after));
    }

    public function test_mutations_require_password_reason_confirmation_revision_and_strict_fields(): void
    {
        $this->actor();
        $body = $this->payload('checkups');
        $this->withSession(['auth.password_confirmed_at' => 0])->postJson('/api/admin/checkups', $body)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        foreach (['reason', 'confirmed', 'expected_revision'] as $key) {
            $missing = $body;
            unset($missing[$key]);
            $this->postJson('/api/admin/checkups', $missing)->assertUnprocessable();
        }
        $this->postJson('/api/admin/checkups', $body + ['deleted_at' => now()->toISOString()])->assertUnprocessable();
        $this->postJson('/api/admin/checkups', array_replace($body, ['reason' => '   ']))->assertUnprocessable();
        $this->assertDatabaseCount('checkups', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_actor_bound_revisions_cached_roles_and_non_admins_refuse(): void
    {
        $actor = $this->actor();
        $body = $this->payload('checkups');
        $this->actor('root-admin');
        $this->postJson('/api/admin/checkups', $body)->assertConflict();
        $actor->syncRoles(['patient']);
        $this->actingAs($actor);
        $this->postJson('/api/admin/checkups', $body)->assertForbidden();
        foreach (['doctor', 'patient'] as $role) {
            $this->actor($role);
            $this->getJson('/api/admin/catalog/checkups/context')->assertForbidden();
        }
    }

    public function test_category_archive_preserves_active_and_archived_children_and_audit_batch(): void
    {
        $this->actor();
        $category = CheckupCategory::factory()->create();
        $replacement = CheckupCategory::factory()->create();
        $active = Checkup::factory()->create(['checkup_category_id' => $category->id]);
        $archived = Checkup::factory()->create(['checkup_category_id' => $category->id]);
        $archived->delete();
        $this->deleteJson('/api/admin/checkup-categories/'.$category->id, ['expected_revision' => $this->revision('checkup-categories', $category->id), 'reason' => 'Synthetic reassignment.', 'confirmed' => true, 'checkup_action' => 'reassign', 'replacement_category_id' => $replacement->id])->assertOk();
        $this->assertSoftDeleted($category);
        $this->assertNotSoftDeleted($active);
        $this->assertSoftDeleted($archived);
        $this->assertSame($replacement->id, $active->fresh()->checkup_category_id);
        $this->assertSame($replacement->id, $archived->fresh()->checkup_category_id);
        $this->assertSame(1, AuditEvent::pluck('batch_id')->unique()->count());
        $this->assertTrue(AuditEvent::all()->every(fn ($event) => $event->risk_level === 'critical'));
        $this->assertSame(2, AuditEvent::where('action', 'admin.checkup_category.archived')->first()->after['affected_checkup_count']);
    }

    public function test_archive_choices_reject_stale_inactive_self_and_ambiguous_replacements(): void
    {
        $this->actor();
        $category = CheckupCategory::factory()->create();
        $inactive = CheckupCategory::factory()->create(['is_active' => false]);
        foreach ([['checkup_action' => 'reassign', 'replacement_category_id' => $category->id], ['checkup_action' => 'reassign', 'replacement_category_id' => $inactive->id], ['checkup_action' => 'detach', 'replacement_category_id' => $inactive->id]] as $choice) {
            $this->deleteJson('/api/admin/checkup-categories/'.$category->id, $choice + ['expected_revision' => $this->revision('checkup-categories', $category->id), 'reason' => 'Synthetic refusal.', 'confirmed' => true])->assertUnprocessable();
        }
        $body = $this->payload('checkup-categories', $category->id);
        Checkup::factory()->create(['checkup_category_id' => $category->id]);
        $this->putJson('/api/admin/checkup-categories/'.$category->id, $body)->assertConflict();
        $this->assertNotSoftDeleted($category);
    }

    public function test_specialty_reparent_updates_descendant_depth_and_rejects_cycles(): void
    {
        $this->actor();
        $root = Specialty::factory()->create();
        $parent = Specialty::factory()->create(['parent_id' => $root->id, 'level' => 1]);
        $leaf = Specialty::factory()->create(['parent_id' => $parent->id, 'level' => 2]);
        $this->putJson('/api/admin/specialties/'.$root->id, $this->payload('specialties', $root->id) + ['parent_id' => $leaf->id])->assertUnprocessable();
        $newRoot = Specialty::factory()->create();
        $this->putJson('/api/admin/specialties/'.$root->id, $this->payload('specialties', $root->id) + ['parent_id' => $newRoot->id])->assertOk();
        $this->assertSame(1, $root->fresh()->level);
        $this->assertSame(2, $parent->fresh()->level);
        $this->assertSame(3, $leaf->fresh()->level);
        $this->assertDatabaseCount('audit_events', 3);
    }

    public function test_referenced_specialties_and_archived_parents_refuse_but_unreferenced_leaf_archives(): void
    {
        $this->actor();
        $parent = Specialty::factory()->create();
        $child = Specialty::factory()->create(['parent_id' => $parent->id, 'level' => 1]);
        foreach ([$parent, $child] as $index => $row) {
            if ($index === 1) {
                DoctorProfile::factory()->create(['specialty_id' => $child->id]);
            }
            $this->getJson('/api/admin/catalog/specialties/context/'.$row->id)->assertOk()->assertJsonPath('data.can_archive', false);
            $this->deleteJson('/api/admin/specialties/'.$row->id, ['reason' => 'Synthetic refusal.', 'confirmed' => true, 'expected_revision' => $this->revision('specialties', $row->id)])->assertUnprocessable();
        }
        $leaf = Specialty::factory()->create();
        $this->deleteJson('/api/admin/specialties/'.$leaf->id, ['reason' => 'Synthetic leaf archive.', 'confirmed' => true, 'expected_revision' => $this->revision('specialties', $leaf->id)])->assertOk();
        $this->assertSoftDeleted($leaf);
    }

    public function test_audit_failure_rolls_back_catalog_write_and_all_category_child_changes(): void
    {
        $this->actor();
        $category = CheckupCategory::factory()->create();
        $child = Checkup::factory()->create(['checkup_category_id' => $category->id]);
        $body = ['reason' => 'Synthetic rollback.', 'confirmed' => true, 'checkup_action' => 'detach', 'expected_revision' => $this->revision('checkup-categories', $category->id)];
        $this->mock(AuditLogger::class, fn ($mock) => $mock->shouldReceive('log')->andThrow(new \RuntimeException('Synthetic audit failure.')));
        $this->deleteJson('/api/admin/checkup-categories/'.$category->id, $body)->assertStatus(500);
        $this->assertNotSoftDeleted($category);
        $this->assertSame($category->id, $child->fresh()->checkup_category_id);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_reparent_preserves_unrelated_branches_and_updates_archived_descendant_levels(): void
    {
        $this->actor();
        $root = Specialty::factory()->create();
        $archived = Specialty::factory()->create(['parent_id' => $root->id, 'level' => 1]);
        $archived->delete();
        $unrelated = Specialty::factory()->create(['level' => 7]);
        $parent = Specialty::factory()->create();
        $this->putJson('/api/admin/specialties/'.$root->id, $this->payload('specialties', $root->id) + ['parent_id' => $parent->id])->assertOk();
        $this->assertSame(2, $archived->fresh()->level);
        $this->assertSoftDeleted($archived);
        $this->assertSame(7, $unrelated->fresh()->level);
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_secondary_doctor_reference_blocks_specialty_archive(): void
    {
        $this->actor();
        $specialty = Specialty::factory()->create();
        $doctor = DoctorProfile::factory()->create();
        \Illuminate\Support\Facades\DB::table('doctor_specialty')->insert(['doctor_profile_id' => $doctor->id, 'specialty_id' => $specialty->id]);
        $this->deleteJson('/api/admin/specialties/'.$specialty->id, ['reason' => 'Synthetic reference refusal.', 'confirmed' => true, 'expected_revision' => $this->revision('specialties', $specialty->id)])->assertUnprocessable();
        $this->assertNotSoftDeleted($specialty);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_current_resource_policy_is_enforced_by_context_and_write_boundary(): void
    {
        $this->actor();
        $body = $this->payload('checkups');
        \Illuminate\Support\Facades\Gate::before(fn ($user, $ability) => $ability === 'create' ? false : null);
        $this->getJson('/api/admin/catalog/checkups/context')->assertOk()->assertJsonPath('data.can_create', false);
        $this->postJson('/api/admin/checkups', $body)->assertForbidden();
        $this->assertDatabaseCount('checkups', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_legacy_optional_specialty_slug_keeps_generation_and_update_compatibility(): void
    {
        $this->actor();
        $body = $this->payload('specialties');
        $body['slug'] = '';
        $this->post('/admin/specialties', $body)->assertRedirect();
        $row = Specialty::firstOrFail();
        $this->assertSame('synthetic-specialties', $row->slug);
        $body = $this->payload('specialties', $row->id);
        $body['slug'] = '';
        $this->put('/admin/specialties/'.$row->id, $body)->assertRedirect();
        $this->assertSame('synthetic-specialties', $row->fresh()->slug);
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_busy_catalog_lock_refuses_without_writes_and_read_specialties_has_no_identity(): void
    {
        $this->actor();
        $specialty = Specialty::factory()->create();
        $body = $this->payload('checkups');
        $lock = Cache::lock('checkupino:catalog-administration:v1', 120);
        $this->assertTrue($lock->get());
        try {
            $this->postJson('/api/admin/checkups', $body)->assertConflict();
        } finally {
            $lock->release();
        }
        $this->getJson('/api/admin/specialties?root_only=1')->assertOk()->assertJsonPath('data.0.id', $specialty->id)->assertJsonMissingPath('data.0.doctors');
        $this->getJson('/api/admin/specialties/'.$specialty->id)->assertOk()->assertJsonPath('data.counts.children', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }
}
