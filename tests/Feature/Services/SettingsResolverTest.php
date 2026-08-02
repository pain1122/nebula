<?php

namespace Tests\Feature\Services;

use App\Services\SettingsRegistry;
use App\Services\SettingsResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Tests\TestCase;

class SettingsResolverTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.tenant' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('tenant');
        Artisan::call('migrate:fresh', [
            '--database' => 'tenant',
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
            '--force' => true,
        ]);
    }

    public function test_marketplace_precedence_is_user_then_site_then_platform_then_default(): void
    {
        $definitionId = $this->definition('marketplace', 'booking.default_timezone');
        $this->value('marketplace', $definitionId, 'platform', 'marketplace', 'UTC');
        $this->value('marketplace', $definitionId, 'site', 'main', 'Europe/Paris');
        $this->value('marketplace', $definitionId, 'user', 'user-1', 'Asia/Tehran');
        $resolver = app(SettingsResolver::class);

        $this->assertSame('Asia/Tehran', $resolver->marketplace('booking.default_timezone', 'main', 'user-1'));
        $this->assertSame('Europe/Paris', $resolver->marketplace('booking.default_timezone', 'main'));
        $this->assertSame('UTC', $resolver->marketplace('booking.default_timezone'));

        DB::table('setting_values')->delete();

        $this->assertSame('Asia/Tehran', $resolver->marketplace('booking.default_timezone'));
    }

    public function test_tenant_precedence_is_user_then_implicit_hospital(): void
    {
        $definitionId = $this->definition('tenant', 'booking.default_timezone');
        $this->value('tenant', $definitionId, 'hospital', 'hospital', 'UTC');
        $this->value('tenant', $definitionId, 'user', 'local-user-1', 'Asia/Tehran');
        $resolver = app(SettingsResolver::class);

        $this->assertSame('Asia/Tehran', $resolver->tenant('booking.default_timezone', 'local-user-1'));
        $this->assertSame('UTC', $resolver->tenant('booking.default_timezone'));
    }

    public function test_tenant_true_feature_setting_is_denied_when_entitlement_denies_it(): void
    {
        $definitionId = $this->definition('tenant', 'reports.enabled');
        $this->value('tenant', $definitionId, 'hospital', 'hospital', true);

        $this->assertFalse(app(SettingsResolver::class)->tenant('reports.enabled'));
    }

    public function test_registry_rejects_unknown_keys_invalid_types_values_and_scopes(): void
    {
        $registry = app(SettingsRegistry::class);

        try {
            $registry->definition('tenant', 'unknown.setting');
            $this->fail('Unknown setting keys must fail.');
        } catch (InvalidArgumentException) {
            $this->assertTrue(true);
        }

        foreach (['60', 1] as $invalidValue) {
            try {
                $registry->validateValue('marketplace', 'booking.pending_hold_minutes', $invalidValue);
                $this->fail('Invalid typed setting value must fail.');
            } catch (ValidationException) {
                $this->assertTrue(true);
            }
        }

        try {
            $registry->validateValue('marketplace', 'booking.pending_hold_minutes', 4);
            $this->fail('Out-of-range setting value must fail.');
        } catch (ValidationException) {
            $this->assertTrue(true);
        }

        $this->expectException(ValidationException::class);
        $registry->assertScopeAllowed('marketplace', 'payments.default_currency', 'user');
    }

    private function definition(string $context, string $key): int
    {
        $connection = $context === 'tenant' ? 'tenant' : config('database.default');
        $definition = app(SettingsRegistry::class)->definition($context, $key);

        return DB::connection($connection)->table('setting_definitions')->insertGetId([
            'public_id' => (string) Str::ulid(),
            'key' => $key,
            'group' => $definition['group'],
            'value_type' => $definition['value_type'],
            'default_value' => json_encode($definition['default']),
            'validation_rules' => json_encode($definition['validation_rules']),
            'sensitivity' => $definition['sensitivity'],
            'allowed_scopes' => json_encode($definition['allowed_scopes']),
            'description' => $definition['description'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function value(
        string $context,
        int $definitionId,
        string $scopeType,
        string $scopeKey,
        mixed $value,
    ): void {
        $connection = $context === 'tenant' ? 'tenant' : config('database.default');

        DB::connection($connection)->table('setting_values')->insert([
            'public_id' => (string) Str::ulid(),
            'setting_definition_id' => $definitionId,
            'scope_type' => $scopeType,
            'scope_key' => $scopeKey,
            'value' => json_encode($value),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
