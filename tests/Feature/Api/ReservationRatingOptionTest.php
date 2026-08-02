<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\ReservationRatingOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationRatingOptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_manages_reservation_rating_options_in_database(): void
    {
        $admin = $this->userWithRole(UserRole::Admin);

        $created = $this
            ->statefulAdmin($admin)
            ->postJson('/api/admin/reservation-rating-options', [
                'type' => ReservationRatingOption::TYPE_PRO,
                'label' => 'Clear explanation',
                'slug' => 'clear-explanation',
                'description' => 'Doctor explained the result clearly.',
                'active' => true,
                'sort_order' => 10,
                'reason' => 'Add feedback option',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertDatabaseHas('reservation_rating_options', [
            'id' => $created['id'],
            'type' => ReservationRatingOption::TYPE_PRO,
            'slug' => 'clear-explanation',
            'active' => true,
        ]);

        $this
            ->statefulAdmin($admin)
            ->putJson('/api/admin/reservation-rating-options/'.$created['id'], [
                'type' => ReservationRatingOption::TYPE_CON,
                'label' => 'Long wait',
                'slug' => 'long-wait',
                'description' => null,
                'active' => false,
                'sort_order' => 20,
                'reason' => 'Revise feedback option',
            ])
            ->assertOk()
            ->assertJsonPath('data.type', ReservationRatingOption::TYPE_CON)
            ->assertJsonPath('data.active', false);

        $this
            ->statefulAdmin($admin)
            ->deleteJson('/api/admin/reservation-rating-options/'.$created['id'], [
                'reason' => 'Retire feedback option',
            ])
            ->assertNoContent();

        $this->assertSoftDeleted('reservation_rating_options', [
            'id' => $created['id'],
        ]);
    }

    public function test_clients_receive_only_active_rating_options(): void
    {
        $patient = $this->userWithRole(UserRole::Patient);

        $active = ReservationRatingOption::query()->create([
            'type' => ReservationRatingOption::TYPE_PRO,
            'label' => 'Helpful follow-up',
            'slug' => 'helpful-follow-up',
            'description' => null,
            'active' => true,
            'sort_order' => 1,
        ]);

        ReservationRatingOption::query()->create([
            'type' => ReservationRatingOption::TYPE_CON,
            'label' => 'Billing confusion',
            'slug' => 'billing-confusion',
            'description' => null,
            'active' => false,
            'sort_order' => 2,
        ]);

        $response = $this
            ->actingAs($patient, 'sanctum')
            ->getJson('/api/reservation-rating-options')
            ->assertOk();

        $this->assertSame([$active->id], array_column($response->json('data'), 'id'));
    }

    private function userWithRole(UserRole $role): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role->value]);

        return $user;
    }

    private function statefulAdmin(User $admin): static
    {
        return $this->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()]);
    }
}
