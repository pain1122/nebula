<?php

namespace Tests\Feature\Admin;

use App\Models\AuditEvent;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class CatalogAuthorityTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\GuardedCatalogClient;
    use \Tests\Support\IsolatedProfileApplication;

    public function test_checkup_create_requires_recent_password_confirmation(): void
    {
        $admin = User::factory()->admin()->create();
        $category = CheckupCategory::factory()->create();

        $this->actingAs($admin)
            ->withSession([])
            ->post(route('admin.checkups.store'), $this->payload($category))
            ->assertRedirect(route('password.confirm'));

        $this->assertDatabaseMissing('checkups', ['slug' => 'authority-checkup']);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_authorized_admin_creates_fully_declared_checkup_with_reasoned_audit(): void
    {
        $admin = User::factory()->admin()->create();
        $category = CheckupCategory::factory()->create();

        $this->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->post(route('admin.checkups.store'), $this->payload($category))
            ->assertRedirect(route('admin.checkups.index'));

        $checkup = Checkup::query()->where('slug', 'authority-checkup')->firstOrFail();
        $event = AuditEvent::query()->sole();

        $this->assertSame(2_500_000, $checkup->price);
        $this->assertSame('IRR', $checkup->currency);
        $this->assertSame(45, $checkup->default_duration_minutes);
        $this->assertSame('admin.checkup.created', $event->action);
        $this->assertSame('Add a new marketplace service.', $event->reason);
        $this->assertSame(2_500_000, $event->after['price']);
        $this->assertSame('IRR', $event->after['currency']);
        $this->assertSame(45, $event->after['default_duration_minutes']);
    }

    public function test_checkup_create_and_update_require_complete_money_duration_and_reason_facts(): void
    {
        $admin = User::factory()->admin()->create();
        $category = CheckupCategory::factory()->create();
        $checkup = Checkup::factory()->for($category, 'category')->create();

        $invalid = $this->payload($category, [
            'currency' => 'irr',
            'default_duration_minutes' => 0,
            'reason' => '',
        ]);

        $this->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->from(route('admin.checkups.create'))
            ->post(route('admin.checkups.store'), $invalid)
            ->assertRedirect(route('admin.checkups.create'))
            ->assertSessionHasErrors(['currency', 'default_duration_minutes', 'reason']);

        $this->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->from(route('admin.checkups.edit', $checkup))
            ->put(route('admin.checkups.update', $checkup), $invalid)
            ->assertRedirect(route('admin.checkups.edit', $checkup))
            ->assertSessionHasErrors(['currency', 'default_duration_minutes', 'reason']);

        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_authorized_admin_updates_pricing_currency_and_default_duration_with_audit(): void
    {
        $admin = User::factory()->admin()->create();
        $category = CheckupCategory::factory()->create();
        $checkup = Checkup::factory()->for($category, 'category')->create([
            'price' => 1_000_000,
            'currency' => 'IRR',
            'default_duration_minutes' => 30,
        ]);

        $this->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->put(route('admin.checkups.update', $checkup), $this->payload($category, [
                'slug' => $checkup->slug,
                'price' => 900,
                'currency' => 'EUR',
                'default_duration_minutes' => 60,
                'reason' => 'Correct price, currency, and visit length.',
            ]))
            ->assertRedirect(route('admin.checkups.index'));

        $checkup->refresh();
        $event = AuditEvent::query()->sole();

        $this->assertSame(900, $checkup->price);
        $this->assertSame('EUR', $checkup->currency);
        $this->assertSame(60, $checkup->default_duration_minutes);
        $this->assertSame('admin.checkup.updated', $event->action);
        $this->assertSame('Correct price, currency, and visit length.', $event->reason);
        $this->assertSame('IRR', $event->before['currency']);
        $this->assertSame('EUR', $event->after['currency']);
        $this->assertSame(30, $event->before['default_duration_minutes']);
        $this->assertSame(60, $event->after['default_duration_minutes']);
    }

    public function test_non_admin_cannot_create_or_update_catalog_entries(): void
    {
        $doctor = User::factory()->doctor()->create();
        $category = CheckupCategory::factory()->create();
        $checkup = Checkup::factory()->for($category, 'category')->create();

        $this->actingAs($doctor)
            ->withSession($this->recentPasswordConfirmation())
            ->post(route('admin.checkups.store'), $this->payload($category))
            ->assertForbidden();

        $this->actingAs($doctor)
            ->withSession($this->recentPasswordConfirmation())
            ->put(route('admin.checkups.update', $checkup), $this->payload($category, [
                'slug' => $checkup->slug,
            ]))
            ->assertForbidden();

        $this->assertDatabaseMissing('checkups', ['slug' => 'authority-checkup']);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_checkup_create_and_update_roll_back_when_audit_fails(): void
    {
        $admin = User::factory()->admin()->create();
        $category = CheckupCategory::factory()->create();
        $checkup = Checkup::factory()->for($category, 'category')->create([
            'price' => 1_000_000,
        ]);

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')
                ->twice()
                ->andThrow(new RuntimeException('audit failed'));
        });

        $this->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->post(route('admin.checkups.store'), $this->payload($category))
            ->assertStatus(500);

        $this->actingAs($admin)
            ->withSession($this->recentPasswordConfirmation())
            ->put(route('admin.checkups.update', $checkup), $this->payload($category, [
                'slug' => $checkup->slug,
                'price' => 7_000_000,
            ]))
            ->assertStatus(500);

        $this->assertDatabaseMissing('checkups', ['slug' => 'authority-checkup']);
        $this->assertSame(1_000_000, $checkup->fresh()->price);
        $this->assertDatabaseCount('audit_events', 0);
    }

    /** @return array<string, mixed> */
    private function payload(CheckupCategory $category, array $overrides = []): array
    {
        return array_merge([
            'checkup_category_id' => $category->id,
            'title' => 'Authority Checkup',
            'slug' => 'authority-checkup',
            'description' => 'A policy-controlled marketplace service.',
            'price' => 2_500_000,
            'currency' => 'IRR',
            'default_duration_minutes' => 45,
            'reason' => 'Add a new marketplace service.',
        ], $overrides);
    }

    /** @return array{auth.password_confirmed_at: int} */
    private function recentPasswordConfirmation(): array
    {
        return ['auth.password_confirmed_at' => time()];
    }
}
