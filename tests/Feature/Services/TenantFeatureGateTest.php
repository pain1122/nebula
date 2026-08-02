<?php

namespace Tests\Feature\Services;

use App\Services\TenantFeatureGate;
use App\Support\TenantEntitlementSignature;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantFeatureGateTest extends TestCase
{
    private const INSTALLATION_KEY = 'tenant-feature-gate-test';

    private string $seed;

    protected function setUp(): void
    {
        parent::setUp();

        CarbonImmutable::setTestNow('2026-08-02 12:00:00 UTC');
        $this->seed = str_repeat("\x07", SODIUM_CRYPTO_SIGN_SEEDBYTES);
        $keyPair = sodium_crypto_sign_seed_keypair($this->seed);
        config([
            'tenant.entitlements.clock_skew_seconds' => 300,
            'tenant.entitlements.public_keys' => [
                'test-v1' => base64_encode(sodium_crypto_sign_publickey($keyPair)),
            ],
            'tenant.entitlements.signing_key_id' => 'test-v1',
            'tenant.entitlements.signing_seed' => base64_encode($this->seed),
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

        DB::connection('tenant')->table('tenant_installation')->insert([
            'public_id' => (string) Str::ulid(),
            'installation_key' => self::INSTALLATION_KEY,
            'schema_version' => 'test-v1',
            'installed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

    public function test_valid_enabled_entitlement_is_allowed(): void
    {
        $this->storeEntitlement('tenant.reports', true);

        $this->assertTrue(app(TenantFeatureGate::class)->allows('tenant.reports'));
    }

    public function test_disabled_expired_and_unknown_features_are_denied(): void
    {
        $this->storeEntitlement('tenant.disabled', false);
        $this->storeEntitlement(
            'tenant.expired',
            true,
            CarbonImmutable::now()->subMonth(),
            CarbonImmutable::now()->subSecond(),
        );

        $gate = app(TenantFeatureGate::class);

        $this->assertFalse($gate->allows('tenant.disabled'));
        $this->assertFalse($gate->allows('tenant.expired'));
        $this->assertFalse($gate->allows('tenant.unknown'));
        $this->assertFalse($gate->allows(''));
    }

    public function test_signature_tampering_unknown_key_and_invalid_configuration_fail_closed(): void
    {
        $this->storeEntitlement('tenant.tampered', true);
        DB::connection('tenant')->table('feature_entitlements')
            ->where('feature_key', 'tenant.tampered')
            ->update(['entitlement_version' => 'tampered-v2']);

        $this->storeEntitlement('tenant.unknown-key', true);
        DB::connection('tenant')->table('feature_entitlements')
            ->where('feature_key', 'tenant.unknown-key')
            ->update(['signing_key_id' => 'missing']);

        $gate = app(TenantFeatureGate::class);

        $this->assertFalse($gate->allows('tenant.tampered'));
        $this->assertFalse($gate->allows('tenant.unknown-key'));

        config(['tenant.entitlements.public_keys' => []]);

        $this->assertFalse($gate->allows('tenant.unknown-key'));
    }

    public function test_future_issued_entitlement_and_ambiguous_installation_fail_closed(): void
    {
        $this->storeEntitlement(
            'tenant.future',
            true,
            CarbonImmutable::now()->addMinutes(6),
            CarbonImmutable::now()->addMonth(),
        );

        $this->assertFalse(app(TenantFeatureGate::class)->allows('tenant.future'));

        DB::connection('tenant')->table('tenant_installation')->insert([
            'public_id' => (string) Str::ulid(),
            'installation_key' => 'unexpected-second-installation',
            'schema_version' => 'test-v1',
            'installed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertFalse(app(TenantFeatureGate::class)->allows('tenant.future'));
    }

    private function storeEntitlement(
        string $featureKey,
        bool $enabled,
        ?CarbonImmutable $issuedAt = null,
        ?CarbonImmutable $expiresAt = null,
    ): void {
        $issuedAt ??= CarbonImmutable::now()->subMinute();
        $expiresAt ??= CarbonImmutable::now()->addMonth();
        $signature = app(TenantEntitlementSignature::class)->sign(
            self::INSTALLATION_KEY,
            $featureKey,
            $enabled,
            'test-v1',
            $issuedAt,
            $expiresAt,
        );

        DB::connection('tenant')->table('feature_entitlements')->insert([
            'public_id' => (string) Str::ulid(),
            'feature_key' => $featureKey,
            'enabled' => $enabled,
            'entitlement_version' => 'test-v1',
            'signature_algorithm' => TenantEntitlementSignature::ALGORITHM,
            'signing_key_id' => 'test-v1',
            'signature' => $signature,
            'issued_at' => $issuedAt,
            'expires_at' => $expiresAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
