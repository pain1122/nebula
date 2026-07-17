<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\AuditEvent;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\BookingService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;
use Illuminate\Validation\ValidationException;

class CatalogDestructiveDataSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkup_archive_requires_recent_password_confirmation(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();

        $this
            ->actingAs($admin)
            ->withSession([])
            ->delete(route('admin.checkups.destroy', $history['checkup']))
            ->assertRedirect(route('password.confirm'))
            ->assertSessionHas(
                'url.intended',
                route('admin.checkups.archive-confirm', $history['checkup']),
            );

        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
        $this->assertHistoryRowsRemain($history);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_recently_confirmed_admin_archives_only_the_checkup_and_preserves_history(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->delete(route('admin.checkups.destroy', $history['checkup']))
            ->assertRedirect(route('admin.checkups.index'));

        $this->assertSoftDeleted('checkups', ['id' => $history['checkup']->id]);
        $this->assertNotSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertHistoryRowsRemain($history);
        $this->assertDatabaseHas('doctor_workplace_checkup', [
            'checkup_id' => $history['checkup']->id,
            'doctor_workplace_id' => $history['doctor']->workplaces()->value('id'),
        ]);

        $reservation = $history['reservation']->fresh()->load('checkup.category', 'payment');
        $this->assertSame($history['checkup']->id, $reservation->checkup?->id);
        $this->assertSame($history['category']->id, $reservation->checkup?->category?->id);
        $this->assertSame($history['payment']->id, $reservation->payment?->id);
        $this->assertNull(Checkup::query()->find($history['checkup']->id));
        $this->assertNotNull(Checkup::withTrashed()->find($history['checkup']->id));

        $event = AuditEvent::query()->sole();
        $this->assertSame($admin->id, $event->actor_user_id);
        $this->assertSame('admin.checkup.archived', $event->action);
        $this->assertSame(Checkup::class, $event->subject_type);
        $this->assertSame($history['checkup']->id, $event->subject_id);
        $this->assertSame('critical', $event->risk_level);
        $this->assertNull($event->before['deleted_at']);
        $this->assertNotNull($event->after['deleted_at']);

        $this
            ->actingAs($history['patient'], 'sanctum')
            ->getJson('/api/checkups')
            ->assertOk()
            ->assertJsonMissing([
                'id' => $history['checkup']->id,
                'title' => $history['checkup']->title,
            ]);

        $this
            ->actingAs($history['patient'], 'sanctum')
            ->getJson('/api/checkups/'.$history['checkup']->id.'/doctors')
            ->assertNotFound();

        $this
            ->actingAs($history['patient'], 'sanctum')
            ->getJson('/api/my/reservations')
            ->assertOk()
            ->assertJsonPath('data.data.0.checkup.id', $history['checkup']->id)
            ->assertJsonPath('data.data.0.payment.id', $history['payment']->id);
    }

    public function test_category_archive_can_detach_checkups_without_removing_their_records(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $archivedCheckup = Checkup::query()->create([
            'checkup_category_id' => $history['category']->id,
            'title' => 'Previously archived checkup',
            'slug' => 'previously-archived-checkup-'.uniqid(),
            'description' => null,
            'price' => 50000,
        ]);
        $archivedCheckup->delete();

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->delete(route('admin.checkup-categories.destroy', $history['category']), [
                'checkup_action' => 'detach',
            ])
            ->assertRedirect(route('admin.checkup-categories.index'));

        $this->assertSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => null,
        ]);
        $this->assertSoftDeleted('checkups', [
            'id' => $archivedCheckup->id,
            'checkup_category_id' => null,
        ]);
        $this->assertDependentHistoryRowsRemain($history);
        $this->assertSame(2, AuditEvent::query()->where('action', 'admin.checkup.category_detached')->count());
        $this->assertSame(1, AuditEvent::query()->where('action', 'admin.checkup_category.archived')->count());

        $this
            ->actingAs($history['patient'], 'sanctum')
            ->getJson('/api/checkups')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $history['checkup']->id);

        $this
            ->actingAs($admin)
            ->get(route('admin.checkup-categories.index'))
            ->assertOk()
            ->assertDontSee($history['category']->name);
    }

    public function test_category_archive_can_reassign_checkups_to_another_active_category(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $replacement = CheckupCategory::query()->create([
            'name' => 'Replacement category',
            'slug' => 'replacement-category-'.uniqid(),
            'description' => null,
        ]);

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->delete(route('admin.checkup-categories.destroy', $history['category']), [
                'checkup_action' => 'reassign',
                'replacement_category_id' => $replacement->id,
            ])
            ->assertRedirect(route('admin.checkup-categories.index'));

        $this->assertSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => $replacement->id,
        ]);
        $this->assertHistoryRowsRemain($history);

        $reservation = $history['reservation']->fresh()->load('checkup.category', 'payment');
        $this->assertSame($replacement->id, $reservation->checkup?->category?->id);
        $this->assertSame($history['payment']->id, $reservation->payment?->id);
        $this->assertSame(1, AuditEvent::query()->where('action', 'admin.checkup.category_reassigned')->count());
        $this->assertSame(1, AuditEvent::query()->where('action', 'admin.checkup_category.archived')->count());

        $this
            ->actingAs($history['patient'], 'sanctum')
            ->getJson('/api/checkups?category_id='.$replacement->id)
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $history['checkup']->id);

        $this
            ->actingAs($admin)
            ->get(route('admin.checkup-categories.index'))
            ->assertOk()
            ->assertDontSee($history['category']->name)
            ->assertSee($replacement->name);
    }

    public function test_category_reassignment_requires_a_different_active_category(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->from(route('admin.checkup-categories.index'))
            ->delete(route('admin.checkup-categories.destroy', $history['category']), [
                'checkup_action' => 'reassign',
                'replacement_category_id' => $history['category']->id,
            ])
            ->assertRedirect(route('admin.checkup-categories.index'))
            ->assertSessionHasErrors('replacement_category_id');

        $this->assertNotSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => $history['category']->id,
        ]);
        $this->assertHistoryRowsRemain($history);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_category_reassignment_rejects_an_archived_replacement(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $replacement = CheckupCategory::query()->create([
            'name' => 'Archived replacement category',
            'slug' => 'archived-replacement-category-'.uniqid(),
            'description' => null,
        ]);
        $replacement->delete();

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->from(route('admin.checkup-categories.index'))
            ->delete(route('admin.checkup-categories.destroy', $history['category']), [
                'checkup_action' => 'reassign',
                'replacement_category_id' => $replacement->id,
            ])
            ->assertRedirect(route('admin.checkup-categories.index'))
            ->assertSessionHasErrors('replacement_category_id');

        $this->assertNotSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => $history['category']->id,
        ]);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_category_index_popup_offers_detach_and_reassignment_choices(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $replacement = CheckupCategory::query()->create([
            'name' => 'Popup replacement category',
            'slug' => 'popup-replacement-category-'.uniqid(),
            'description' => null,
        ]);

        $this
            ->actingAs($admin)
            ->get(route('admin.checkup-categories.index'))
            ->assertOk()
            ->assertSee('archive-category-'.$history['category']->id, escape: false)
            ->assertSee('name="checkup_action" value="detach"', escape: false)
            ->assertSee('name="checkup_action" value="reassign"', escape: false)
            ->assertSee('value="'.$replacement->id.'"', escape: false)
            ->assertSee($replacement->name);
    }

    public function test_category_choice_survives_recent_password_confirmation(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $replacement = CheckupCategory::query()->create([
            'name' => 'Confirmed replacement category',
            'slug' => 'confirmed-replacement-category-'.uniqid(),
            'description' => null,
        ]);
        $confirmationUrl = route('admin.checkup-categories.archive-confirm', $history['category']).'?'.http_build_query([
            'checkup_action' => 'reassign',
            'replacement_category_id' => $replacement->id,
        ]);

        $this
            ->actingAs($admin)
            ->withSession([])
            ->get($confirmationUrl)
            ->assertRedirect(route('password.confirm'))
            ->assertSessionHas('url.intended', $confirmationUrl);

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->get($confirmationUrl)
            ->assertOk()
            ->assertViewIs('admin.catalog.confirm-archive')
            ->assertSee('name="checkup_action" value="reassign"', escape: false)
            ->assertSee('name="replacement_category_id" value="'.$replacement->id.'"', escape: false);

        $this->assertNotSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
    }

    public function test_unconfirmed_category_archive_preserves_the_selected_reassignment(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $replacement = CheckupCategory::query()->create([
            'name' => 'Deferred replacement category',
            'slug' => 'deferred-replacement-category-'.uniqid(),
            'description' => null,
        ]);
        $intendedUrl = route('admin.checkup-categories.archive-confirm', $history['category']).'?'.http_build_query([
            'checkup_action' => 'reassign',
            'replacement_category_id' => $replacement->id,
        ]);

        $this
            ->actingAs($admin)
            ->withSession([])
            ->delete(route('admin.checkup-categories.destroy', $history['category']), [
                'checkup_action' => 'reassign',
                'replacement_category_id' => $replacement->id,
            ])
            ->assertRedirect(route('password.confirm'))
            ->assertSessionHas('url.intended', $intendedUrl);

        $this->assertNotSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => $history['category']->id,
        ]);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_category_archive_rolls_back_all_reassignments_when_an_audit_write_fails(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();

        $calls = 0;
        $this->mock(AuditLogger::class, function (MockInterface $mock) use (&$calls): void {
            $mock->shouldReceive('log')
                ->twice()
                ->andReturnUsing(function () use (&$calls): AuditEvent {
                    $calls++;

                    if ($calls === 2) {
                        throw new RuntimeException('audit failed');
                    }

                    return new AuditEvent;
                });
        });

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->delete(route('admin.checkup-categories.destroy', $history['category']), [
                'checkup_action' => 'detach',
            ])
            ->assertStatus(500);

        $this->assertNotSoftDeleted('checkup_categories', ['id' => $history['category']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => $history['category']->id,
        ]);
        $this->assertHistoryRowsRemain($history);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_database_restricts_physical_checkup_delete_when_history_exists(): void
    {
        $history = $this->catalogHistory();

        try {
            $history['checkup']->forceDelete();
            $this->fail('Expected the database to reject physical checkup deletion.');
        } catch (QueryException) {
            $this->assertTrue(true);
        }

        $this->assertHistoryRowsRemain($history);
    }

    public function test_database_physical_category_delete_nulls_category_without_removing_checkups(): void
    {
        $history = $this->catalogHistory();

        $history['category']->forceDelete();

        $this->assertDatabaseMissing('checkup_categories', ['id' => $history['category']->id]);
        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => null,
        ]);
        $this->assertDependentHistoryRowsRemain($history);
    }

    public function test_archived_category_cannot_be_assigned_to_a_checkup(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $archivedCategory = CheckupCategory::query()->create([
            'name' => 'Archived assignment category',
            'slug' => 'archived-assignment-category-'.uniqid(),
            'description' => null,
        ]);
        $archivedCategory->delete();

        $this
            ->actingAs($admin)
            ->from(route('admin.checkups.edit', $history['checkup']))
            ->put(route('admin.checkups.update', $history['checkup']), [
                'checkup_category_id' => $archivedCategory->id,
                'title' => $history['checkup']->title,
                'slug' => $history['checkup']->slug,
                'description' => $history['checkup']->description,
                'price' => $history['checkup']->price,
            ])
            ->assertRedirect(route('admin.checkups.edit', $history['checkup']))
            ->assertSessionHasErrors('checkup_category_id');

        $this->assertDatabaseHas('checkups', [
            'id' => $history['checkup']->id,
            'checkup_category_id' => $history['category']->id,
        ]);
    }

    public function test_booking_service_rejects_a_stale_archived_checkup_model(): void
    {
        $history = $this->catalogHistory();
        $history['checkup']->delete();

        try {
            app(BookingService::class)->createReservation(
                user: $history['patient'],
                checkup: $history['checkup'],
                doctor: $history['doctor'],
                start: now()->addWeeks(2),
                durationMinutes: 30,
            );
            $this->fail('Expected booking to reject an archived checkup.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('checkup_id', $exception->errors());
        }

        $this->assertDatabaseCount('reservations', 1);
        $this->assertDatabaseCount('reservation_payment_summaries', 1);
    }

    public function test_archive_confirmation_page_requires_recent_password_confirmation(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();
        $confirmationUrl = route('admin.checkups.archive-confirm', $history['checkup']);

        $this
            ->actingAs($admin)
            ->withSession([])
            ->get($confirmationUrl)
            ->assertRedirect(route('password.confirm'))
            ->assertSessionHas('url.intended', $confirmationUrl);

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->get($confirmationUrl)
            ->assertOk()
            ->assertViewIs('admin.catalog.confirm-archive');

        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
    }

    public function test_patient_cannot_confirm_or_archive_a_checkup(): void
    {
        $patient = $this->userWithRole(UserRole::Patient);
        $history = $this->catalogHistory();

        $this
            ->actingAs($patient)
            ->withSession($this->recentPasswordConfirmation())
            ->get(route('admin.checkups.archive-confirm', $history['checkup']))
            ->assertForbidden();

        $this
            ->actingAs($patient)
            ->withSession($this->recentPasswordConfirmation())
            ->delete(route('admin.checkups.destroy', $history['checkup']))
            ->assertForbidden();

        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_checkup_archive_rolls_back_when_audit_write_fails(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);
        $history = $this->catalogHistory();

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')
                ->once()
                ->andThrow(new RuntimeException('audit failed'));
        });

        $this
            ->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->delete(route('admin.checkups.destroy', $history['checkup']))
            ->assertStatus(500);

        $this->assertNotSoftDeleted('checkups', ['id' => $history['checkup']->id]);
        $this->assertHistoryRowsRemain($history);
        $this->assertDatabaseCount('audit_events', 0);
    }

    private function userWithRole(UserRole $role): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role->value]);

        return $user;
    }

    /**
     * @return array{
     *     category: CheckupCategory,
     *     checkup: Checkup,
     *     doctor: DoctorProfile,
     *     patient: User,
     *     reservation: Reservation,
     *     payment: Payment
     * }
     */
    private function catalogHistory(): array
    {
        $specialty = Specialty::query()->create([
            'name' => 'Catalog safety specialty',
            'slug' => 'catalog-safety-specialty-'.uniqid(),
            'level' => 0,
        ]);

        $category = CheckupCategory::query()->create([
            'name' => 'Catalog safety category',
            'slug' => 'catalog-safety-category-'.uniqid(),
            'description' => null,
        ]);

        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => 'Catalog safety checkup',
            'slug' => 'catalog-safety-checkup-'.uniqid(),
            'description' => null,
            'price' => 125000,
        ]);

        $doctorUser = $this->userWithRole(UserRole::Doctor);

        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'phone' => '021'.random_int(10000000, 99999999),
            'experience_years' => 5,
            'fee' => 50000,
            'bio' => null,
            'availability' => [],
            'verified' => true,
        ]);

        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Catalog Safety Hospital',
            'slug' => 'catalog-safety-hospital-'.uniqid(),
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $workplace->checkups()->attach($checkup->id);

        $patient = $this->userWithRole(UserRole::Patient);

        $reservation = Reservation::query()->create([
            'user_id' => $patient->id,
            'doctor_profile_id' => $doctor->id,
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'starts_at' => now()->addWeek(),
            'ends_at' => now()->addWeek()->addMinutes(30),
            'duration_minutes' => 30,
            'timezone' => $hospital->timezone,
            'hold_expires_at' => now()->addHour(),
            'hospital_name_snapshot' => $hospital->name,
            'doctor_name_snapshot' => $doctorUser->name,
            'checkup_title_snapshot' => $checkup->title,
            'category_name_snapshot' => $category->name,
            'price_snapshot' => $checkup->price,
            'currency_snapshot' => $checkup->currency,
            'status' => ReservationStatus::Pending,
        ]);

        $payment = Payment::query()->create([
            'reservation_id' => $reservation->id,
            'provider' => 'stripe',
            'provider_ref' => null,
            'amount' => $checkup->price,
            'currency' => 'IRR',
            'status' => 'unpaid',
        ]);

        return compact('category', 'checkup', 'doctor', 'patient', 'reservation', 'payment');
    }

    /**
     * @param array{
     *     category: CheckupCategory,
     *     checkup: Checkup,
     *     doctor: DoctorProfile,
     *     patient: User,
     *     reservation: Reservation,
     *     payment: Payment
     * } $history
     */
    private function assertHistoryRowsRemain(array $history): void
    {
        $this->assertDatabaseHas('checkup_categories', ['id' => $history['category']->id]);
        $this->assertDependentHistoryRowsRemain($history);
    }

    /**
     * @param array{
     *     category: CheckupCategory,
     *     checkup: Checkup,
     *     doctor: DoctorProfile,
     *     patient: User,
     *     reservation: Reservation,
     *     payment: Payment
     * } $history
     */
    private function assertDependentHistoryRowsRemain(array $history): void
    {
        $this->assertDatabaseHas('checkups', ['id' => $history['checkup']->id]);
        $this->assertDatabaseHas('reservations', ['id' => $history['reservation']->id]);
        $this->assertDatabaseHas('reservation_payment_summaries', ['id' => $history['payment']->id]);
    }

    /**
     * @return array<string, int>
     */
    private function recentPasswordConfirmation(): array
    {
        return ['auth.password_confirmed_at' => time()];
    }
}
