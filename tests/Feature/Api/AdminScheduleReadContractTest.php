<?php

namespace Tests\Feature\Api;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Reservation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminScheduleReadContractTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated schedule read acceptance only.');
        }
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-15T08:00:00Z'));
    }

    private function actor(string $role = 'admin'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);
        $this->actingAs($user)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000']);

        return $user;
    }

    private function graph(string $timezone = 'Asia/Tehran'): array
    {
        $user = User::factory()->doctor()->create(['name' => 'Synthetic schedule doctor']);
        $doctor = DoctorProfile::factory()->create(['user_id' => $user->id, 'verified' => true, 'fee' => 9007199254740991, 'phone' => 'PRIVATE PHONE', 'bio' => 'PRIVATE BIO']);
        $hospital = MarketplaceHospital::factory()->create(['name' => 'Synthetic hospital', 'timezone' => $timezone, 'address' => 'PRIVATE ADDRESS']);
        $workplace = DoctorWorkplace::factory()->create(['doctor_profile_id' => $doctor->id, 'marketplace_hospital_id' => $hospital->id, 'display_name' => 'Synthetic workplace', 'booking_notes' => 'PRIVATE NOTES']);
        $checkup = Checkup::factory()->create(['price' => 9007199254740991]);
        $rule = DoctorWorkingWindow::factory()->create(['doctor_workplace_id' => $workplace->id, 'checkup_id' => $checkup->id, 'weekday' => 0, 'price_override' => 7654321, 'effective_from' => '2026-10-01', 'effective_until' => '2026-12-31']);
        $rule->breaks()->create(['starts_at' => '10:00:00', 'ends_at' => '10:15:00']);
        $slot = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => Carbon::parse('2026-10-18 08:00', $timezone)->utc(), 'ends_at' => Carbon::parse('2026-10-18 08:30', $timezone)->utc(), 'price' => 7654321]);

        return [$workplace, $rule, $slot, $checkup];
    }

    private function paths(DoctorWorkplace $workplace): array
    {
        return ['/api/admin/schedules/workplaces', '/api/admin/schedules/workplaces/'.$workplace->id, '/api/admin/schedules/workplaces/'.$workplace->id.'/rules', '/api/admin/schedules/workplaces/'.$workplace->id.'/slots'];
    }

    private function slots(DoctorWorkplace $workplace, string $extra = ''): string
    {
        return '/api/admin/schedules/workplaces/'.$workplace->id.'/slots?from=2026-10-18&to=2026-10-18'.$extra;
    }

    public function test_guest_and_non_admin_roles_cannot_read_any_schedule_endpoint(): void
    {
        [$workplace] = $this->graph();
        foreach ($this->paths($workplace) as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        foreach (['patient', 'doctor'] as $role) {
            $this->actor($role);
            foreach ($this->paths($workplace) as $path) {
                $this->getJson($path)->assertForbidden();
            }
        }
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_admin_and_root_read_explicit_metadata_exact_prices_rules_and_breaks(): void
    {
        [$workplace, $rule, $slot, $checkup] = $this->graph();
        foreach (['admin', 'root-admin'] as $role) {
            $actor = $this->actor($role);
            foreach ($this->paths($workplace) as $path) {
                $response = $this->getJson($path)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('meta.read_only', true);
                foreach (['PRIVATE', $actor->email, 'password', 'booking_notes', 'contact_phone', 'patient', 'storage_path'] as $secret) {
                    $this->assertStringNotContainsString($secret, $response->getContent());
                }
            }
            $this->getJson('/api/admin/schedules/workplaces/'.$workplace->id)->assertOk()->assertJsonPath('data.counts.rules', 1)->assertJsonPath('data.counts.slots', 1)->assertJsonPath('data.services.0.base_price', '9007199254740991')->assertJsonPath('data.services.0.id', $checkup->id);
            $this->getJson('/api/admin/schedules/workplaces/'.$workplace->id.'/rules')->assertOk()->assertJsonPath('data.0.id', $rule->id)->assertJsonPath('data.0.price_override', '7654321')->assertJsonPath('data.0.breaks.0.starts_at', '10:00:00');
            $this->getJson($this->slots($workplace))->assertOk()->assertJsonPath('data.0.public_id', $slot->public_id)->assertJsonPath('data.0.price', '7654321')->assertJsonPath('data.0.is_future', true)->assertJsonPath('data.0.blocking_reservation', false)->assertJsonPath('data.0.has_reservation_history', false)->assertJsonPath('data.0.binding_consistent', true)->assertJsonPath('meta.period.timezone', 'Asia/Tehran');
        }
    }

    public function test_archive_and_inactive_history_remain_readable_without_being_active(): void
    {
        [$workplace, $rule, $slot, $checkup] = $this->graph();
        $workplace->forceFill(['archived_at' => now(), 'is_active' => false])->save();
        $workplace->doctorProfile->delete();
        $checkup->delete();
        $rule->update(['is_active' => false]);
        $slot->update(['is_active' => false]);
        $this->actor();
        $this->getJson('/api/admin/schedules/workplaces')->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson('/api/admin/schedules/workplaces?state=archived')->assertOk()->assertJsonPath('data.0.state', 'archived')->assertJsonPath('data.0.doctor.archived', true);
        $this->getJson('/api/admin/schedules/workplaces/'.$workplace->id)->assertOk()->assertJsonPath('data.services.0.archived', true);
        $this->getJson($this->slots($workplace, '&state=inactive'))->assertOk()->assertJsonPath('data.0.rule.is_active', false)->assertJsonPath('data.0.checkup.archived', true);
        $this->getJson($this->slots($workplace, '&state=active'))->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_filter_composition_literal_search_and_stable_paging(): void
    {
        [$workplace, , , $checkup] = $this->graph();
        $workplace->update(['display_name' => 'literal_100% پزشکی !clinic']);
        $other = DoctorWorkplace::factory()->create(['doctor_profile_id' => $workplace->doctor_profile_id, 'display_name' => 'literalX100X unrelated']);
        $this->actor();
        $base = '/api/admin/schedules/workplaces';
        foreach (['literal_', '100%', 'پزشکی', '!clinic'] as $term) {
            $this->getJson($base.'?q='.urlencode($term))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.id', $workplace->id);
        }
        $this->getJson($base.'?doctor_id='.$workplace->doctor_profile_id.'&hospital_id='.$workplace->marketplace_hospital_id.'&checkup_id='.$checkup->id.'&state=active')->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $other->update(['display_name' => $workplace->display_name]);
        $this->getJson($base.'?per_page=1')->assertOk()->assertJsonPath('data.0.id', $workplace->id)->assertJsonPath('meta.pagination.last_page', 2);
        $this->getJson($base.'?per_page=1&page=2')->assertOk()->assertJsonPath('data.0.id', $other->id);
        $this->getJson($base.'?q=%27%20OR%201%3D1%20--')->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_cross_workplace_doctor_conflicts_do_not_expose_reservation_or_patient_identity(): void
    {
        [$workplace, , $slot, $checkup] = $this->graph();
        $other = DoctorWorkplace::factory()->create(['doctor_profile_id' => $workplace->doctor_profile_id]);
        $rule = DoctorWorkingWindow::factory()->create(['doctor_workplace_id' => $other->id, 'checkup_id' => $checkup->id]);
        $overlap = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => $slot->starts_at->copy()->addMinutes(15), 'ends_at' => $slot->ends_at->copy()->addMinutes(15)]);
        $reservation = Reservation::factory()->create(['doctor_visit_slot_id' => $overlap->id, 'status' => 'confirmed']);
        $this->actor();
        $response = $this->getJson($this->slots($workplace, '&conflict=blocking&history=without'))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.blocking_reservation', true)->assertJsonPath('data.0.has_reservation_history', false);
        $this->assertStringNotContainsString($reservation->user->email, $response->getContent());
        $this->assertStringNotContainsString($reservation->public_id, $response->getContent());
        $this->getJson($this->slots($workplace, '&conflict=unblocked'))->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_expired_cancelled_and_completed_history_does_not_become_a_blocking_hold(): void
    {
        [$workplace, , $slot] = $this->graph();
        $reservation = Reservation::factory()->create(['doctor_visit_slot_id' => $slot->id, 'status' => 'pending', 'hold_expires_at' => now()->subSecond()]);
        $this->actor();
        foreach (['pending', 'cancelled', 'completed', 'expired'] as $status) {
            $reservation->update(['status' => $status]);
            $this->getJson($this->slots($workplace, '&conflict=unblocked&history=with'))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.has_reservation_history', true)->assertJsonPath('data.0.blocking_reservation', false);
        }
        $reservation->update(['status' => 'pending', 'hold_expires_at' => now()->addMinute()]);
        $this->getJson($this->slots($workplace, '&conflict=blocking'))->assertOk()->assertJsonPath('data.0.blocking_reservation', true);
    }

    public function test_local_date_boundaries_include_both_dst_offsets_and_exclude_next_midnight(): void
    {
        [$workplace, $rule] = $this->graph('Europe/Berlin');
        $first = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-24 22:00:00', 'ends_at' => '2026-10-24 22:30:00']);
        $last = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-25 22:30:00', 'ends_at' => '2026-10-25 23:00:00']);
        DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => '2026-10-25 23:00:00', 'ends_at' => '2026-10-25 23:30:00']);
        $this->actor();
        $response = $this->getJson('/api/admin/schedules/workplaces/'.$workplace->id.'/slots?from=2026-10-25&to=2026-10-25')->assertOk()->assertJsonPath('meta.pagination.total', 2)->assertJsonPath('data.0.public_id', $first->public_id)->assertJsonPath('data.1.public_id', $last->public_id);
        $this->assertStringEndsWith('+02:00', $response->json('data.0.starts_at'));
        $this->assertStringEndsWith('+01:00', $response->json('data.1.starts_at'));
    }

    public function test_strict_filters_dates_bounds_and_missing_ids_refuse(): void
    {
        [$workplace] = $this->graph();
        $this->actor();
        $base = '/api/admin/schedules/workplaces';
        foreach (['q[]=x', 'q='.str_repeat('a', 101), 'page=0', 'page=1001', 'per_page=101', 'doctor_id=-1', 'hospital_id[]=1', 'sort_by=booking_notes', 'state=unknown', 'include=users'] as $query) {
            $this->getJson($base.'?'.$query)->assertUnprocessable();
        }
        foreach (['from=2026-10-18', 'to=2026-10-18', 'from=2026-02-30&to=2026-03-01', 'from=2026-10-18&to=2026-10-17', 'from=2026-10-01&to=2026-11-01', 'state=archived', 'conflict=maybe', 'history=all', 'timing=tomorrow', 'rule_id=0'] as $query) {
            $this->getJson($base.'/'.$workplace->id.'/slots?'.$query)->assertUnprocessable();
        }
        $this->getJson($base.'/'.$workplace->id.'/rules?weekday=7')->assertUnprocessable();
        $this->getJson($base.'/'.$workplace->id.'?include=private')->assertUnprocessable();
        $this->getJson($base.'/999999')->assertNotFound();
        $this->getJson($base.'/invalid')->assertNotFound();
    }

    public function test_rule_slot_filters_paging_and_default_period_are_server_owned(): void
    {
        [$workplace, $rule, $slot, $checkup] = $this->graph();
        $inactive = DoctorVisitSlot::factory()->create(['doctor_working_window_id' => $rule->id, 'starts_at' => $slot->starts_at->copy()->addHour(), 'ends_at' => $slot->ends_at->copy()->addHour(), 'is_active' => false]);
        $this->actor();
        $base = '/api/admin/schedules/workplaces/'.$workplace->id;
        $this->getJson($base.'/slots')->assertOk()->assertJsonPath('meta.period.from', '2026-10-15')->assertJsonPath('meta.period.to', '2026-10-21');
        $this->getJson($this->slots($workplace, '&state=inactive&timing=future&checkup_id='.$checkup->id.'&rule_id='.$rule->id))->assertOk()->assertJsonPath('meta.pagination.total', 1)->assertJsonPath('data.0.public_id', $inactive->public_id);
        $this->getJson($this->slots($workplace, '&per_page=1&page=2'))->assertOk()->assertJsonPath('data.0.public_id', $inactive->public_id)->assertJsonPath('meta.pagination.last_page', 2);
        $this->getJson($this->slots($workplace, '&timing=past'))->assertOk()->assertJsonPath('meta.pagination.total', 0);
        $this->getJson($base.'/rules?weekday=0&state=active&checkup_id='.$checkup->id)->assertOk()->assertJsonPath('data.0.id', $rule->id);
        $this->getJson($base.'/rules?weekday=1')->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_invalid_timezone_and_oversized_embedded_collections_fail_closed(): void
    {
        [$workplace, $rule] = $this->graph();
        $this->actor();
        $workplace->hospital->update(['timezone' => 'invalid/timezone']);
        $base = '/api/admin/schedules/workplaces/'.$workplace->id;
        $this->getJson($base.'/slots')->assertStatus(503);
        $this->getJson($base.'/rules')->assertStatus(503);
        $workplace->hospital->update(['timezone' => 'Asia/Tehran']);
        for ($index = 0; $index < 50; $index++) {
            $rule->breaks()->create(['starts_at' => '10:00:00', 'ends_at' => '10:15:00']);
        }
        $this->getJson($base.'/rules')->assertStatus(503);
        $services = Checkup::factory()->count(100)->create();
        $workplace->checkups()->syncWithoutDetaching($services->modelKeys());
        $this->getJson($base)->assertStatus(503);
    }

    public function test_owner_promotion_during_read_cannot_disclose_privileged_schedule_metadata(): void
    {
        [$workplace] = $this->graph();
        $owner = $workplace->doctorProfile->user;
        foreach ($this->paths($workplace) as $path) {
            $owner->syncRoles(['doctor']);
            $this->actor();
            $state = (object) ['changed' => false];
            DB::listen(function ($query) use ($owner, $state) {
                if (! $state->changed && str_contains($query->sql, 'doctor_workplaces') && ! str_starts_with(strtolower(ltrim($query->sql)), 'select count(*) as aggregate')) {
                    $state->changed = true;
                    $owner->syncRoles(['doctor', 'root-admin']);
                }
            });
            $this->getJson($path)->assertForbidden();
            $this->assertTrue($state->changed);
        }
    }

    public function test_privileged_doctor_identity_is_neither_searchable_nor_readable_by_another_admin(): void
    {
        [$workplace] = $this->graph();
        $workplace->doctorProfile->user->syncRoles(['doctor', 'root-admin']);
        foreach (['admin', 'root-admin'] as $role) {
            $this->actor($role);
            $this->getJson('/api/admin/schedules/workplaces?q=Synthetic')->assertOk()->assertJsonPath('meta.pagination.total', 0);
            foreach (array_slice($this->paths($workplace), 1) as $path) {
                $this->getJson($path)->assertNotFound();
            }
        }
    }

    public function test_reads_preserve_every_schedule_booking_audit_and_queue_row(): void
    {
        [$workplace, , $slot] = $this->graph();
        Reservation::factory()->create(['doctor_visit_slot_id' => $slot->id]);
        $this->actor();
        $before = [];
        foreach (['doctor_workplaces', 'doctor_workplace_checkup', 'doctor_working_windows', 'doctor_working_window_breaks', 'doctor_visit_slots', 'reservations', 'reservation_payment_summaries', 'audit_events', 'outbox_events', 'jobs'] as $table) {
            $before[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        foreach ($this->paths($workplace) as $path) {
            $this->getJson($path)->assertOk();
        }
        foreach ($before as $table => $bytes) {
            $this->assertSame($bytes, DB::table($table)->orderBy('id')->get()->toJson());
        }
    }

    public function test_cached_role_revocation_and_revocation_during_reads_refuse(): void
    {
        [$workplace] = $this->graph();
        $actor = $this->actor()->load('roles');
        User::findOrFail($actor->id)->syncRoles(['patient']);
        foreach ($this->paths($workplace) as $path) {
            $this->getJson($path)->assertForbidden();
        }
        foreach ($this->paths($workplace) as $path) {
            $actor = $this->actor();
            $state = (object) ['changed' => false];
            DB::listen(function ($query) use ($actor, $state) {
                if (! $state->changed && str_contains($query->sql, 'doctor_workplaces')) {
                    $state->changed = true;
                    User::findOrFail($actor->id)->syncRoles(['patient']);
                }
            });
            $this->getJson($path)->assertForbidden();
            $this->assertTrue($state->changed);
        }
    }
}
