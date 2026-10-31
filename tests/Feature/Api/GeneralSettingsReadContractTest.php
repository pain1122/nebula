<?php

namespace Tests\Feature\Api;

use App\Models\SettingDefinition;
use App\Models\SettingValue;
use App\Models\User;
use App\Services\SettingsRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\IsolatedProfileApplication;
use Tests\TestCase;

class GeneralSettingsReadContractTest extends TestCase
{
    use IsolatedProfileApplication, RefreshDatabase;

    private const URL = '/api/admin/settings/general';

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_PROFILE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated general settings acceptance only.');
        }
        parent::setUp();
    }

    private function actor(string $role = 'root-admin'): User
    {
        $actor = User::factory()->create();
        $actor->syncRoles([$role]);
        $this->actingAs($actor)->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000']);

        return $actor;
    }

    private function definition(string $key): SettingDefinition
    {
        $rule = app(SettingsRegistry::class)->definition('marketplace', $key);

        return SettingDefinition::firstOrCreate(['key' => $key], ['group' => $rule['group'], 'value_type' => $rule['value_type'],
            'default_value' => $rule['default'], 'validation_rules' => $rule['validation_rules'], 'sensitivity' => $rule['sensitivity'],
            'allowed_scopes' => $rule['allowed_scopes'], 'description' => $rule['description']]);
    }

    private function value(string $key, mixed $value, string $scope = 'platform', string $scopeKey = 'marketplace'): SettingValue
    {
        return SettingValue::create(['setting_definition_id' => $this->definition($key)->id, 'scope_type' => $scope,
            'scope_key' => $scopeKey, 'value' => $value]);
    }

    public function test_root_reads_three_defaults_without_provisioning_values_or_audit(): void
    {
        $this->actor();
        $response = $this->getJson(self::URL)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(3, 'data.settings')->assertJsonPath('meta.read_only', true)->assertJsonPath('meta.write_controls_ready', true)
            ->assertJsonPath('meta.runtime_binding_ready', true)->assertJsonPath('meta.managed_scopes', ['platform', 'site'])
            ->assertJsonPath('data.settings.0.key', 'booking.pending_hold_minutes')->assertJsonPath('data.settings.0.default', 60)
            ->assertJsonPath('data.settings.0.value', null)->assertJsonPath('data.settings.0.stored', false)
            ->assertJsonPath('data.settings.0.effective_value', 60)->assertJsonPath('data.settings.0.effective_source', 'default')
            ->assertJsonPath('data.settings.1.default', 'Asia/Tehran')->assertJsonPath('data.settings.2.default', 'IRR');
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $response->json('meta.revision'));
        foreach ($response->json('data.settings') as $row) {
            $this->assertTrue($row['runtime_bound']);
        }
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('setting_values', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_guest_and_all_non_root_roles_are_denied(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        foreach (['admin', 'doctor', 'patient'] as $role) {
            $this->actor($role);
            $this->getJson(self::URL)->assertForbidden();
        }
        $this->assertDatabaseCount('setting_values', 0);
    }

    public function test_platform_and_site_precedence_use_only_server_owned_scope_keys(): void
    {
        config(['settings.scope_keys.marketplace_site' => 'synthetic-site']);
        $this->value('booking.pending_hold_minutes', 30);
        $this->value('booking.default_timezone', 'UTC');
        $this->value('booking.pending_hold_minutes', 15, 'site', 'synthetic-site');
        $this->value('payments.default_currency', 'EUR', 'site', 'synthetic-site');
        $this->value('booking.default_timezone', 'Europe/Paris', 'site', 'other-site');
        $this->actor();
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.settings.0.value', 30)->assertJsonPath('data.settings.0.effective_source', 'platform')
            ->assertJsonPath('data.settings.1.effective_value', 'UTC')->assertJsonPath('data.settings.2.effective_value', 'IRR');
        $this->getJson(self::URL.'?scope_type=site')->assertOk()->assertJsonPath('data.settings.0.value', 15)
            ->assertJsonPath('data.settings.0.scope_key', 'synthetic-site')->assertJsonPath('data.settings.0.effective_source', 'site')
            ->assertJsonPath('data.settings.1.value', null)->assertJsonPath('data.settings.1.effective_source', 'platform')
            ->assertJsonPath('data.settings.1.effective_value', 'UTC')->assertJsonPath('data.settings.2.effective_value', 'EUR');
    }

    public function test_unknown_filters_scope_overrides_and_user_scope_are_rejected(): void
    {
        $this->actor();
        foreach (['scope_type=user', 'scope_type=hospital', 'scope_key=marketplace', 'scope_type[]=site', 'key=uploads.medical', 'user_id=7', 'revision=x'] as $query) {
            $this->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
        $this->assertDatabaseCount('setting_definitions', 0);
    }

    public function test_revision_is_stable_actor_and_scope_bound_and_changes_with_values(): void
    {
        $row = $this->value('booking.pending_hold_minutes', 30);
        $root = $this->actor();
        $revision = $this->getJson(self::URL)->assertOk()->json('meta.revision');
        $this->getJson(self::URL)->assertOk()->assertJsonPath('meta.revision', $revision);
        $this->assertNotSame($revision, $this->getJson(self::URL.'?scope_type=site')->assertOk()->json('meta.revision'));
        $this->actor();
        $this->assertNotSame($revision, $this->getJson(self::URL)->assertOk()->json('meta.revision'));
        $this->actingAs($root);
        $row->forceFill(['value' => 45])->save();
        $this->assertNotSame($revision, $this->getJson(self::URL)->assertOk()->json('meta.revision'));
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_runtime_metadata_explains_new_only_bindings_and_keeps_operator_fallback_visible(): void
    {
        config(['payments.hold_minutes' => 75]);
        $this->value('booking.pending_hold_minutes', 20);
        $this->value('booking.default_timezone', 'Europe/Berlin');
        $this->value('payments.default_currency', 'EUR');
        $this->actor();
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.settings.0.effective_value', 20)
            ->assertJsonPath('data.settings.0.runtime_default', 75)->assertJsonPath('data.settings.0.runtime_bound', true)
            ->assertJsonPath('data.settings.0.runtime_source', 'new_reservation_hold')
            ->assertJsonPath('data.settings.1.runtime_source', 'missing_hospital_timezone_only')->assertJsonPath('data.settings.1.runtime_default', null)
            ->assertJsonPath('data.settings.2.runtime_source', 'missing_new_schedule_currency_only')->assertJsonPath('meta.runtime_binding_ready', true);
        $this->assertSame(75, config('payments.hold_minutes'));
    }

    public function test_other_settings_user_overrides_and_private_metadata_are_not_resources(): void
    {
        $root = $this->actor();
        $this->value('booking.default_timezone', 'Europe/Paris', 'user', $root->public_id);
        $definition = SettingDefinition::create(['key' => 'private.synthetic', 'group' => 'private', 'value_type' => 'string',
            'default_value' => 'PRIVATE DEFAULT', 'sensitivity' => 'secret', 'allowed_scopes' => ['platform'], 'description' => 'PRIVATE DESCRIPTION']);
        $row = new SettingValue;
        $row->forceFill(['setting_definition_id' => $definition->id, 'scope_type' => 'platform', 'scope_key' => 'marketplace',
            'value' => 'PRIVATE VALUE', 'secret_reference' => 'PRIVATE SECRET REFERENCE'])->save();
        $response = $this->getJson(self::URL)->assertOk()->assertJsonCount(3, 'data.settings')->assertJsonPath('data.settings.1.effective_value', 'Asia/Tehran');
        foreach (['PRIVATE', 'secret_reference', 'updated_by', 'description', $root->email, $root->public_id] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }
        $this->assertDatabaseCount('setting_values', 2);
    }

    public function test_corrupt_or_secret_known_setting_values_fail_without_leaking_the_value(): void
    {
        $row = $this->value('payments.default_currency', 'IRR');
        $this->actor();
        foreach (['PRIVATE invalid json', '"PRIVATE"', '"12#"', 'null', 'true', '123'] as $raw) {
            DB::table('setting_values')->where('id', $row->id)->update(['value' => $raw]);
            $response = $this->getJson(self::URL)->assertStatus(503);
            $this->assertStringNotContainsString('PRIVATE', $response->getContent());
        }
        DB::table('setting_values')->where('id', $row->id)->update(['value' => '"IRR"', 'secret_reference' => 'PRIVATE SECRET']);
        $this->assertStringNotContainsString('PRIVATE', $this->getJson(self::URL)->assertStatus(503)->getContent());
    }

    public function test_private_or_incompatible_definition_metadata_is_refused_before_values_are_read(): void
    {
        $row = $this->value('booking.pending_hold_minutes', 30);
        DB::table('setting_definitions')->where('id', $row->setting_definition_id)->update(['sensitivity' => 'secret']);
        $this->actor();
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = $query->sql;
        });
        $this->getJson(self::URL)->assertStatus(503);
        $this->assertCount(0, array_filter($queries, fn ($sql) => str_contains($sql, 'setting_values')));
    }

    public function test_invalid_registry_defaults_or_scope_configuration_fail_closed_without_writes(): void
    {
        $this->actor();
        // Dotted registry keys must be replaced within the marketplace array.
        $rules = config('settings.marketplace');
        $rules['booking.pending_hold_minutes']['default'] = 200;
        config(['settings.marketplace' => $rules]);
        $this->getJson(self::URL)->assertStatus(503);
        $rules['booking.pending_hold_minutes']['default'] = 60;
        config(['settings.marketplace' => $rules, 'settings.scope_keys.marketplace_site' => '']);
        $this->getJson(self::URL)->assertStatus(503);
        $this->assertDatabaseCount('setting_definitions', 0);
    }

    public function test_revoked_or_suspended_root_is_not_trusted_from_a_cached_user_instance(): void
    {
        $root = $this->actor();
        $root->load('roles');
        User::findOrFail($root->id)->syncRoles(['admin']);
        $this->getJson(self::URL)->assertForbidden();
        User::findOrFail($root->id)->syncRoles(['root-admin']);
        User::whereKey($root->id)->update(['account_state' => 'suspended']);
        $this->getJson(self::URL)->assertForbidden();
    }

    public function test_authority_revocation_during_read_prevents_returning_a_snapshot(): void
    {
        $this->definition('booking.pending_hold_minutes');
        $root = $this->actor();
        $changed = false;
        DB::listen(function ($query) use (&$changed, $root): void {
            if (! $changed && str_contains($query->sql, 'setting_values')) {
                $changed = true;
                User::findOrFail($root->id)->syncRoles(['admin']);
            }
        });
        $this->getJson(self::URL)->assertForbidden();
        $this->assertTrue($changed);
    }

    public function test_changed_settings_during_read_require_a_refresh(): void
    {
        $row = $this->value('booking.pending_hold_minutes', 30);
        $this->actor();
        $changed = false;
        DB::listen(function ($query) use (&$changed, $row): void {
            if (! $changed && str_contains($query->sql, 'setting_values')) {
                $changed = true;
                DB::table('setting_values')->where('id', $row->id)->update(['value' => '45']);
            }
        });
        $this->getJson(self::URL)->assertConflict();
        $this->assertTrue($changed);
    }

    public function test_existing_upload_reader_still_works_and_unknown_settings_remain_hidden(): void
    {
        $this->actor();
        $this->getJson('/api/admin/settings/uploads.medical')->assertOk()->assertJsonPath('data.setting.value', []);
        $this->getJson('/api/admin/settings/private.synthetic')->assertNotFound();
        $this->assertDatabaseCount('setting_definitions', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }
}
