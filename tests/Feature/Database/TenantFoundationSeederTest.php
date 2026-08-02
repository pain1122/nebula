<?php

namespace Tests\Feature\Database;

use App\Support\TenantEntitlementSignature;
use Carbon\CarbonImmutable;
use Database\Seeders\TenantFoundationSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TenantFoundationSeederTest extends TestCase
{
    public function test_tenant_seed_is_minimal_isolated_and_idempotent(): void
    {
        $seed = str_repeat("\x06", SODIUM_CRYPTO_SIGN_SEEDBYTES);
        $keyPair = sodium_crypto_sign_seed_keypair($seed);
        config([
            'tenant.entitlements.public_keys' => [
                'test-v1' => base64_encode(sodium_crypto_sign_publickey($keyPair)),
            ],
            'tenant.entitlements.signing_key_id' => 'test-v1',
            'tenant.entitlements.signing_seed' => base64_encode($seed),
        ]);
        config([
            'database.connections.tenant' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('tenant');

        $exitCode = Artisan::call('migrate:fresh', [
            '--database' => 'tenant',
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
            '--force' => true,
        ]);
        $this->assertSame(0, $exitCode, Artisan::output());

        $this->seed(TenantFoundationSeeder::class);
        $this->seed(TenantFoundationSeeder::class);

        $db = DB::connection('tenant');
        $this->assertSame(1, $db->table('tenant_installation')->count());
        $this->assertSame(1, $db->table('hospital_profile')->count());
        $this->assertSame(1, $db->table('users')->count());
        $this->assertSame(1, $db->table('roles')->count());
        $this->assertSame(1, $db->table('model_has_roles')->count());
        $this->assertSame(1, $db->table('feature_entitlements')->count());
        $this->assertSame('admin', $db->table('roles')->value('name'));
        $entitlement = $db->table('feature_entitlements')->sole();
        $this->assertSame(TenantEntitlementSignature::ALGORITHM, $entitlement->signature_algorithm);
        $this->assertSame('test-v1', $entitlement->signing_key_id);
        $this->assertTrue(app(TenantEntitlementSignature::class)->verify(
            installationKey: 'demo-tenant-foundation',
            featureKey: $entitlement->feature_key,
            enabled: (bool) $entitlement->enabled,
            entitlementVersion: $entitlement->entitlement_version,
            issuedAt: CarbonImmutable::parse($entitlement->issued_at),
            expiresAt: CarbonImmutable::parse($entitlement->expires_at),
            keyId: $entitlement->signing_key_id,
            signature: $entitlement->signature,
        ));
        $this->assertFalse(Schema::connection('tenant')->hasTable('marketplace_hospitals'));
        $this->assertFalse(Schema::connection('tenant')->hasTable('reservations'));
        $this->assertFalse(Schema::connection('tenant')->hasTable('payments'));
    }
}
