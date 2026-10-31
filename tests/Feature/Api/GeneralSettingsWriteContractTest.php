<?php

namespace Tests\Feature\Api;

use App\Models\AuditEvent;
use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\GeneralMarketplaceRuntime;
use App\Services\MarketplaceSettingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use RuntimeException;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class GeneralSettingsWriteContractTest extends TestCase
{
    use IsolatedProfileApplication, RefreshDatabase;

    private const KEY = 'booking.pending_hold_minutes';

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated general settings acceptance only.');
        }
        parent::setUp();
    }

    private function actor(string $role = 'root-admin', bool $password = true): User
    {
        $actor = User::factory()->create();
        $actor->syncRoles([$role]);
        $this->actingAs($actor)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000']);
        if ($password) {
            $this->withSession(['auth.password_confirmed_at' => time()]);
        }

        return $actor;
    }

    private function payload(array $changes = []): array
    {
        $scope = $changes['scope_type'] ?? 'platform';
        $revision = $this->getJson('/api/admin/settings/general?scope_type='.$scope)->assertOk()->json('meta.revision');

        return array_replace(['scope_type' => $scope, 'scope_key' => 'marketplace', 'value' => 30,
            'reason' => 'Synthetic policy review', 'confirmed' => true, 'expected_revision' => $revision], $changes);
    }

    private function url(string $key = self::KEY): string
    {
        return '/api/admin/settings/'.$key;
    }

    public function test_confirmed_save_provisions_only_requested_definition_and_audits_atomically(): void
    {
        $root = $this->actor();
        $this->putJson($this->url(), $this->payload())->assertOk()->assertJsonPath('data.setting.value', 30)->assertJsonPath('data.setting.stored', true);
        $this->assertDatabaseCount('setting_definitions', 1);
        $row = SettingValue::sole();
        $this->assertSame($root->id, $row->updated_by);
        $this->assertNull($row->secret_reference);
        $event = AuditEvent::sole();
        $this->assertSame('settings.marketplace.updated', $event->action);
        $this->assertNull($event->before);
        $this->assertSame(['setting_key' => self::KEY, 'scope_type' => 'platform', 'scope_key' => 'marketplace', 'value' => 30, 'stored' => true], $event->after);
        $this->assertSame('Synthetic policy review', $event->reason);
        $this->assertSame(30, app(GeneralMarketplaceRuntime::class)->holdMinutes());
    }

    public function test_site_reset_inherits_platform_and_platform_reset_restores_operator_fallback(): void
    {
        config(['payments.hold_minutes' => 75]);
        $this->actor();
        $this->putJson($this->url(), $this->payload())->assertOk();
        $this->putJson($this->url(), $this->payload(['scope_type' => 'site', 'value' => 15]))->assertOk();
        $this->assertSame(15, app(GeneralMarketplaceRuntime::class)->holdMinutes());
        $reset = $this->payload(['scope_type' => 'site', 'operation' => 'reset']);
        unset($reset['value']);
        $this->putJson($this->url(), $reset)->assertOk()->assertJsonPath('data.setting.value', null)->assertJsonPath('data.setting.stored', false);
        $this->assertSame(30, app(GeneralMarketplaceRuntime::class)->holdMinutes());
        $reset = $this->payload(['operation' => 'reset']);
        unset($reset['value']);
        $this->putJson($this->url(), $reset)->assertOk();
        $this->assertSame(75, app(GeneralMarketplaceRuntime::class)->holdMinutes());
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 4);
        $this->assertSame(false, AuditEvent::orderByDesc('id')->first()->after['stored']);
    }

    public function test_stale_duplicate_cross_actor_cross_scope_and_restored_value_revisions_are_refused(): void
    {
        $root = $this->actor();
        $original = $this->payload();
        $this->putJson($this->url(), $original)->assertOk();
        $this->putJson($this->url(), $original)->assertConflict();
        $platform = $this->payload(['value' => 45]);
        $this->putJson($this->url(), array_replace($platform, ['scope_type' => 'site']))->assertConflict();
        $this->actor();
        $this->putJson($this->url(), $platform)->assertConflict();
        $this->actingAs($root);
        $this->putJson($this->url(), $platform)->assertOk();
        $this->putJson($this->url(), $this->payload())->assertOk();
        $this->putJson($this->url(), $platform)->assertConflict();
        $this->assertSame(30, SettingValue::sole()->value);
        $this->assertDatabaseCount('audit_events', 3);
    }

    public function test_strict_payload_reason_confirmation_types_and_scope_are_required_without_provisioning(): void
    {
        $this->actor();
        $valid = $this->payload();
        foreach ([['value' => '30'], ['value' => 4], ['value' => 181], ['value' => true], ['reason' => '   '], ['reason' => str_repeat('x', 1001)],
            ['confirmed' => false], ['expected_revision' => null], ['scope_type' => 'user'], ['scope_key' => 'other-site'],
            ['actor_id' => 7], ['operation' => 'delete'], ['operation' => 'reset'], ['operation' => 'reset', 'value' => null]] as $bad) {
            $this->putJson($this->url(), array_replace($valid, $bad))->assertUnprocessable();
        }
        $this->putJson($this->url().'?scope_type=site', $valid)->assertUnprocessable();
        foreach (['confirmed', 'expected_revision', 'reason', 'value'] as $missing) {
            $payload = $valid;
            unset($payload[$missing]);
            $this->putJson($this->url(), $payload)->assertUnprocessable();
        }
        foreach (['12#', 'eur', 'EURO', 123, 'E R'] as $bad) {
            $this->putJson($this->url('payments.default_currency'), array_replace($valid, ['value' => $bad]))->assertUnprocessable();
        }
        $this->putJson($this->url('booking.default_timezone'), array_replace($valid, ['value' => 'Mars/Private']))->assertUnprocessable();
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_missing_and_expired_password_confirmation_block_writes(): void
    {
        $this->actor(password: false);
        $payload = $this->payload();
        $this->putJson($this->url(), $payload)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time() - 86400])->putJson($this->url(), $payload)->assertStatus(423);
        $this->assertDatabaseCount('setting_values', 0);
    }

    public function test_non_root_and_revoked_cached_authority_cannot_save(): void
    {
        $root = $this->actor();
        $payload = $this->payload();
        $root->load('roles');
        User::findOrFail($root->id)->syncRoles(['admin']);
        $this->putJson($this->url(), $payload)->assertForbidden();
        foreach (['admin', 'doctor', 'patient'] as $role) {
            $this->actor($role);
            $this->putJson($this->url(), $payload)->assertForbidden();
        }
        $root = $this->actor();
        User::whereKey($root->id)->update(['account_state' => 'suspended']);
        $this->putJson($this->url(), $payload)->assertForbidden();
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_noop_save_and_absent_reset_do_not_audit_or_provision(): void
    {
        $this->actor();
        $reset = $this->payload(['operation' => 'reset']);
        unset($reset['value']);
        $this->putJson($this->url(), $reset)->assertUnprocessable();
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->putJson($this->url(), $this->payload())->assertOk();
        $this->putJson($this->url(), $this->payload())->assertUnprocessable();
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_audit_failure_rolls_back_creation_and_reset(): void
    {
        $this->actor();
        $payload = $this->payload();
        $this->putJson($this->url(), $payload)->assertOk();
        $reset = $this->payload(['operation' => 'reset']);
        unset($reset['value']);
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->twice()->andThrow(new RuntimeException('synthetic audit unavailable'));
        });
        $this->putJson($this->url('payments.default_currency'), array_replace($this->payload(), ['value' => 'EUR']))->assertStatus(500);
        $this->putJson($this->url(), $reset)->assertStatus(500);
        $this->assertDatabaseCount('setting_definitions', 1);
        $this->assertDatabaseCount('setting_values', 1);
        $this->assertSame(30, SettingValue::sole()->value);
        $this->assertDatabaseCount('audit_events', 1);
    }

    public function test_revocation_during_audit_rolls_back_setting_and_audit(): void
    {
        $root = $this->actor();
        $payload = $this->payload();
        $logger = new AuditLogger;
        $this->mock(AuditLogger::class, function (MockInterface $mock) use ($root, $logger): void {
            $mock->shouldReceive('log')->once()->andReturnUsing(function (...$args) use ($root, $logger) {
                $event = $logger->log(...$args);
                User::findOrFail($root->id)->syncRoles(['admin']);

                return $event;
            });
        });
        $this->putJson($this->url(), $payload)->assertForbidden();
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_direct_legacy_service_cannot_bypass_revision_or_confirmation(): void
    {
        $root = $this->actor();
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(MarketplaceSettingService::class)->set(Request::create('/synthetic', 'PUT'), $root, self::KEY, 'platform', 'marketplace', 30, 'Synthetic bypass');
    }

    public function test_corrupt_metadata_and_secret_values_fail_closed_without_overwriting(): void
    {
        $this->actor();
        $this->putJson($this->url(), $this->payload())->assertOk();
        $payload = $this->payload(['value' => 45]);
        DB::table('setting_values')->update(['secret_reference' => 'PRIVATE synthetic']);
        $response = $this->putJson($this->url(), $payload)->assertStatus(503);
        $this->assertStringNotContainsString('PRIVATE', $response->getContent());
        $this->assertSame(30, SettingValue::sole()->value);
        $this->assertDatabaseCount('audit_events', 1);
        DB::table('setting_values')->update(['secret_reference' => null]);
        SettingDefinition::query()->update(['sensitivity' => 'secret']);
        $this->putJson($this->url(), $payload)->assertStatus(503);
        $this->assertSame(30, SettingValue::sole()->value);
    }
}
