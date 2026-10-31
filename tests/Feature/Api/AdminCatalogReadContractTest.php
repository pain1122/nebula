<?php

namespace Tests\Feature\Api;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminCatalogReadContractTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated catalog read acceptance only.');
        }
        parent::setUp();
    }

    private function actor(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);
        $this->actingAs($user)->withHeader('Origin', 'http://localhost:3000')->withHeader('Referer', 'http://localhost:3000');

        return $user;
    }

    private function paths(Checkup $checkup): array
    {
        return ['/api/admin/checkups', '/api/admin/checkups/'.$checkup->id,
            '/api/admin/checkup-categories', '/api/admin/checkup-categories/'.$checkup->checkup_category_id];
    }

    public function test_guest_patient_and_doctor_cannot_discover_catalog_administration(): void
    {
        $checkup = Checkup::factory()->create();
        foreach ($this->paths($checkup) as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($role);
            foreach ($this->paths($checkup) as $path) {
                $this->getJson($path)->assertForbidden();
            }
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_admin_and_root_read_explicit_private_dtos_without_archive_reasons_or_identity(): void
    {
        $checkup = Checkup::factory()->create(['price' => 9007199254740991, 'description' => 'Plain clinical-service description']);
        $checkup->forceFill(['archive_reason' => 'PRIVATE REASON'])->save();
        $category = $checkup->category;
        $category->forceFill(['archive_reason' => 'PRIVATE CATEGORY REASON'])->save();
        foreach (['admin', 'root-admin'] as $role) {
            $actor = $this->actor($role);
            foreach ($this->paths($checkup) as $path) {
                $response = $this->getJson($path)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
                foreach (['PRIVATE', $actor->email, 'archived_by', 'archive_reason', 'password', 'storage_path'] as $secret) {
                    $this->assertStringNotContainsString($secret, $response->getContent());
                }
            }
            $response = $this->getJson('/api/admin/checkups/'.$checkup->id)->assertOk()
                ->assertJsonPath('data.price', '9007199254740991')->assertJsonPath('data.state', 'active')
                ->assertJsonPath('data.category.id', $category->id)->assertJsonPath('data.description', $checkup->description);
            $this->assertEqualsCanonicalizing(['id', 'public_id', 'title', 'slug', 'price', 'currency', 'default_duration_minutes',
                'is_active', 'state', 'category', 'counts', 'archived_at', 'created_at', 'updated_at', 'description'], array_keys($response->json('data')));
            $this->assertArrayNotHasKey('description', $this->getJson('/api/admin/checkups')->json('data.0'));
            $this->assertSame(['reservations' => 0, 'workplace_assignments' => 0], $response->json('data.counts'));
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_archived_history_and_categories_remain_resolvable_with_counts_and_no_writes(): void
    {
        $checkup = Checkup::factory()->create();
        $category = $checkup->category;
        Checkup::factory()->create(['checkup_category_id' => $category->id, 'is_active' => false]);
        Checkup::factory()->create(['checkup_category_id' => $category->id]);
        $window = DoctorWorkingWindow::factory()->create(['checkup_id' => $checkup->id]);
        $slot = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $window->id]);
        $reservation = Reservation::factory()->create(['doctor_visit_slot_id' => $slot->id, 'checkup_title_snapshot' => 'BOOKED TITLE', 'price_snapshot' => 7654321]);
        $checkup->workplaces()->updateExistingPivot($slot->doctor_workplace_id, ['is_active' => false]);
        $checkup->delete();
        $category->delete();
        $before = [];
        foreach (['checkups', 'checkup_categories', 'reservations', 'doctor_visit_slots', 'doctor_workplace_checkup', 'audit_events'] as $table) {
            $before[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        $this->actor();
        $this->getJson('/api/admin/checkups/'.$checkup->id)->assertOk()
            ->assertJsonPath('data.state', 'archived')->assertJsonPath('data.category.state', 'archived')
            ->assertJsonPath('data.counts.reservations', 1)->assertJsonPath('data.counts.workplace_assignments', 1);
        $this->getJson('/api/admin/checkup-categories/'.$category->id)->assertOk()
            ->assertJsonPath('data.counts.checkups', 3)->assertJsonPath('data.counts.active_checkups', 1)
            ->assertJsonPath('data.counts.archived_checkups', 1);
        $this->getJson('/api/admin/checkups?state=archived&category_id='.$category->id)->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/checkup-categories')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/admin/checkup-categories?state=archived')->assertOk()->assertJsonPath('data.0.id', $category->id);
        foreach ($before as $table => $bytes) {
            $this->assertSame($bytes, DB::table($table)->orderBy('id')->get()->toJson());
        }
        $this->assertSame('BOOKED TITLE', $reservation->fresh()->checkup_title_snapshot);
        $this->assertSame(7654321, $reservation->fresh()->price_snapshot);
        $this->assertSame($checkup->id, $reservation->fresh()->checkup->id);
    }

    public function test_filters_compose_and_uncategorized_current_inactive_and_archived_are_distinct(): void
    {
        $category = CheckupCategory::factory()->create();
        $match = Checkup::factory()->create(['checkup_category_id' => $category->id, 'title' => 'Target video checkup', 'currency' => 'EUR', 'price' => 50]);
        Checkup::factory()->create(['checkup_category_id' => $category->id, 'title' => 'Target other', 'currency' => 'IRR', 'price' => 50]);
        $inactive = Checkup::factory()->create(['checkup_category_id' => null, 'is_active' => false]);
        $archived = Checkup::factory()->create();
        $archived->delete();
        $this->actor();
        $this->getJson('/api/admin/checkups?q=Target&state=active&category_id='.$category->id.'&currency=EUR&min_price=50&max_price=50')
            ->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.id', $match->id);
        $this->getJson('/api/admin/checkups?uncategorized=1&state=inactive')->assertOk()
            ->assertJsonPath('data.0.id', $inactive->id)->assertJsonPath('data.0.category', null)->assertJsonPath('meta.pagination.total', 1);
        $this->getJson('/api/admin/checkups')->assertOk()->assertJsonPath('meta.pagination.total', 3);
        $this->getJson('/api/admin/checkups?state=all')->assertOk()->assertJsonPath('meta.pagination.total', 4);
        $this->getJson('/api/admin/checkups?state=archived')->assertOk()->assertJsonPath('data.0.id', $archived->id);
        $this->getJson('/api/admin/checkups?q='.$match->public_id)->assertOk()->assertJsonPath('data.0.id', $match->id);
    }

    public function test_literal_search_farsi_and_tied_sort_pages_are_stable(): void
    {
        $first = Checkup::factory()->create(['title' => 'Same title', 'slug' => 'literal_100%']);
        $second = Checkup::factory()->create(['title' => 'Same title', 'slug' => 'ordinary-100x']);
        $fa = CheckupCategory::factory()->create(['name' => 'دسته پزشکی', 'slug' => 'category!special']);
        $this->actor();
        $this->getJson('/api/admin/checkups?sort_by=title&sort_dir=asc&per_page=1')->assertOk()
            ->assertJsonPath('data.0.id', $first->id)->assertJsonPath('meta.pagination.last_page', 2);
        $this->getJson('/api/admin/checkups?sort_by=title&sort_dir=asc&per_page=1&page=2')->assertOk()->assertJsonPath('data.0.id', $second->id);
        $this->getJson('/api/admin/checkups?sort_by=title&sort_dir=desc&per_page=1')->assertOk()->assertJsonPath('data.0.id', $second->id);
        foreach (['literal_', '100%'] as $term) {
            $this->getJson('/api/admin/checkups?q='.urlencode($term))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.id', $first->id);
        }
        foreach (['پزشکی', '!special'] as $term) {
            $this->getJson('/api/admin/checkup-categories?q='.urlencode($term))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.id', $fa->id);
        }
        $this->getJson('/api/admin/checkups?q=%27%20OR%201%3D1%20--')->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_invalid_filter_shapes_unknown_fields_ranges_ids_and_sorts_refuse(): void
    {
        $checkup = Checkup::factory()->create();
        $this->actor();
        foreach (['q[]=secret', 'q='.str_repeat('x', 101), 'state=unknown', 'category_id=-1', 'category_id[]=1',
            'uncategorized=maybe', 'category_id=1&uncategorized=1', 'currency=irr', 'min_price=-1',
            'min_price=60&max_price=50', 'max_price=9007199254740992', 'page=1001', 'page=0', 'per_page=101',
            'sort_by=archive_reason', 'sort_dir=sideways', 'archived_by=1'] as $query) {
            $this->getJson('/api/admin/checkups?'.$query)->assertUnprocessable();
        }
        foreach (['category_id=1', 'min_price=1', 'sort_by=price', 'q[]=secret', 'per_page=0'] as $query) {
            $this->getJson('/api/admin/checkup-categories?'.$query)->assertUnprocessable();
        }
        foreach ($this->paths($checkup) as $path) {
            if (preg_match('/\/\d+$/', $path)) {
                $this->getJson($path.'?include=private')->assertUnprocessable();
            }
        }
        $this->getJson('/api/admin/checkups/999999')->assertNotFound();
        $this->getJson('/api/admin/checkup-categories/999999')->assertNotFound();
        $this->getJson('/api/admin/checkups/not-an-id')->assertNotFound();
        $this->getJson('/api/admin/checkups/0')->assertUnprocessable();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_cached_revoked_admin_role_is_not_read_authority(): void
    {
        $checkup = Checkup::factory()->create();
        $admin = $this->actor()->load('roles');
        User::findOrFail($admin->id)->syncRoles(['patient']);
        foreach ($this->paths($checkup) as $path) {
            $this->getJson($path)->assertForbidden();
        }
    }

    public function test_role_changes_during_each_catalog_read_refuse_the_response(): void
    {
        $checkup = Checkup::factory()->create();
        foreach ($this->paths($checkup) as $path) {
            $admin = $this->actor();
            $state = (object) ['changed' => false];
            DB::listen(function ($query) use ($admin, $state): void {
                if (! $state->changed && str_contains($query->sql, 'checkups')) {
                    $state->changed = true;
                    User::findOrFail($admin->id)->syncRoles(['patient']);
                }
            });
            $this->getJson($path)->assertForbidden();
            $this->assertTrue($state->changed);
        }
    }
}
