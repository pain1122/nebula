<?php

namespace Tests\Feature\Services;

use App\Services\TenantAuditLogger;
use App\Services\TenantSettingService;
use App\Support\TenantEntitlementSignature;
use Carbon\CarbonImmutable;
use Database\Seeders\TenantFoundationSeeder;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class TenantSettingServiceTest extends TestCase
{
    use RefreshDatabase;

    private int $adminId;

    protected function setUp(): void
    {
        parent::setUp();

        $seed = str_repeat("\x0c", SODIUM_CRYPTO_SIGN_SEEDBYTES);
        $keyPair = sodium_crypto_sign_seed_keypair($seed);
        config([
            'tenant.entitlements.public_keys' => [
                'test-v1' => base64_encode(sodium_crypto_sign_publickey($keyPair)),
            ],
            'tenant.entitlements.signing_key_id' => 'test-v1',
            'tenant.entitlements.signing_seed' => base64_encode($seed),
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
        $this->seed(TenantFoundationSeeder::class);
        $this->adminId = (int) DB::connection('tenant')->table('users')
            ->where('email', 'admin@tenant-hospital.test')
            ->value('id');
    }

    public function test_active_local_admin_sets_hospital_and_user_scoped_values_with_tenant_audit(): void
    {
        $db = DB::connection('tenant');
        $userId = $db->table('users')->insertGetId([
            'public_id' => $userPublicId = (string) Str::ulid(),
            'name' => 'Local User',
            'email' => 'local-user@example.test',
            'password' => 'not-used',
            'account_state' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $service = app(TenantSettingService::class);
        $request = Request::create('/api/tenant/settings', 'PUT');

        $hospital = $service->set(
            $request,
            $this->adminId,
            'booking.pending_hold_minutes',
            'hospital',
            'hospital',
            45,
            'Hospital booking policy',
        );
        $user = $service->set(
            $request,
            $this->adminId,
            'booking.default_timezone',
            'user',
            $userPublicId,
            'UTC',
            'User timezone preference',
        );

        $this->assertSame(45, json_decode($hospital->value, true));
        $this->assertSame('UTC', json_decode($user->value, true));
        $this->assertSame($this->adminId, $hospital->updated_by);
        $this->assertSame(2, $db->table('audit_events')->count());
        $this->assertSame('settings.tenant.updated', $db->table('audit_events')->latest('id')->value('action'));
        $this->assertSame($userId, $db->table('users')->where('public_id', $userPublicId)->value('id'));
    }

    public function test_non_admin_and_suspended_admin_are_denied(): void
    {
        $db = DB::connection('tenant');
        $userId = $db->table('users')->insertGetId([
            'public_id' => (string) Str::ulid(),
            'name' => 'Local User',
            'email' => 'local-user@example.test',
            'password' => 'not-used',
            'account_state' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([$userId, $this->adminId] as $actorId) {
            if ($actorId === $this->adminId) {
                $db->table('users')->where('id', $actorId)->update(['account_state' => 'suspended']);
            }

            try {
                $this->setReports($actorId, false);
                $this->fail('Unauthorized tenant setting mutation must fail.');
            } catch (AuthorizationException) {
                $this->assertSame(0, $db->table('audit_events')->count());
            }
        }
    }

    public function test_reports_cannot_be_enabled_without_marketplace_entitlement(): void
    {
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('not entitled');

        $this->setReports($this->adminId, true);
    }

    public function test_reports_can_be_enabled_with_valid_marketplace_entitlement(): void
    {
        $this->entitleReports();
        $setting = $this->setReports($this->adminId, true);

        $this->assertTrue(json_decode($setting->value, true));
        $this->assertSame(1, DB::connection('tenant')->table('audit_events')->count());
    }

    public function test_tenant_audit_failure_rolls_back_setting_change(): void
    {
        $this->entitleReports();
        $this->setReports($this->adminId, false);
        DB::connection('tenant')->table('audit_events')->delete();

        $this->mock(TenantAuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit failed'));
        });

        try {
            $this->setReports($this->adminId, true);
            $this->fail('Tenant audit failure must escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit failed', $exception->getMessage());
        }

        $stored = DB::connection('tenant')->table('setting_values')
            ->join('setting_definitions', 'setting_definitions.id', '=', 'setting_values.setting_definition_id')
            ->where('setting_definitions.key', 'reports.enabled')
            ->value('setting_values.value');
        $this->assertFalse(json_decode($stored, true));
        $this->assertSame(0, DB::connection('tenant')->table('audit_events')->count());
    }

    private function setReports(int $actorId, bool $value): object
    {
        return app(TenantSettingService::class)->set(
            Request::create('/api/tenant/settings/reports.enabled', 'PUT'),
            $actorId,
            'reports.enabled',
            'hospital',
            'hospital',
            $value,
            'Reports policy changed',
        );
    }

    private function entitleReports(): void
    {
        $db = DB::connection('tenant');
        $issuedAt = CarbonImmutable::now()->subMinute();
        $expiresAt = CarbonImmutable::now()->addMonth();
        $signature = app(TenantEntitlementSignature::class)->sign(
            'demo-tenant-foundation',
            'tenant.reports',
            true,
            'reports-v1',
            $issuedAt,
            $expiresAt,
            'test-v1',
        );

        $db->table('feature_entitlements')->insert([
            'public_id' => (string) Str::ulid(),
            'feature_key' => 'tenant.reports',
            'enabled' => true,
            'entitlement_version' => 'reports-v1',
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
