<?php

namespace Database\Seeders;

use App\Services\SettingsRegistry;
use App\Support\TenantEntitlementSignature;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use LogicException;

class TenantFoundationSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Known-credential tenant fixtures may only be seeded in local or testing environments.');
        }

        $db = DB::connection('tenant');
        $now = now();

        $db->table('tenant_installation')->updateOrInsert(
            ['installation_key' => 'demo-tenant-foundation'],
            [
                'public_id' => $this->existingPublicId($db, 'tenant_installation', 'installation_key', 'demo-tenant-foundation'),
                'schema_version' => 'foundation-v1',
                'installed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $db->table('hospital_profile')->updateOrInsert(
            ['singleton_key' => 1],
            [
                'public_id' => $this->existingPublicId($db, 'hospital_profile', 'singleton_key', 1),
                'name' => 'Isolated Demo Hospital',
                'domain' => 'tenant-hospital.test',
                'timezone' => 'Asia/Tehran',
                'currency' => 'IRR',
                'locale' => 'fa',
                'branding' => json_encode(['primary_color' => '#2563eb'], JSON_THROW_ON_ERROR),
                'public_contact' => json_encode(['phone' => '02188000999'], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $db->table('users')->updateOrInsert(
            ['email' => 'admin@tenant-hospital.test'],
            [
                'public_id' => $this->existingPublicId($db, 'users', 'email', 'admin@tenant-hospital.test'),
                'name' => 'Tenant Local Admin',
                'phone' => '09120000999',
                'email_verified_at' => $now,
                'password' => Hash::make((string) config('demo.password')),
                'account_state' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $db->table('roles')->updateOrInsert(
            ['name' => 'admin', 'guard_name' => 'sanctum'],
            ['created_at' => $now, 'updated_at' => $now]
        );
        $roleId = $db->table('roles')->where('name', 'admin')->where('guard_name', 'sanctum')->value('id');
        $userId = $db->table('users')->where('email', 'admin@tenant-hospital.test')->value('id');
        $db->table('model_has_roles')->updateOrInsert([
            'role_id' => $roleId,
            'model_type' => 'App\\Models\\User',
            'model_id' => $userId,
        ]);

        foreach (app(SettingsRegistry::class)->definitions('tenant') as $definitionKey => $setting) {
            $db->table('setting_definitions')->updateOrInsert(
                ['key' => $definitionKey],
                [
                    'public_id' => $this->existingPublicId($db, 'setting_definitions', 'key', $definitionKey),
                    'group' => $setting['group'],
                    'value_type' => $setting['value_type'],
                    'default_value' => json_encode($setting['default'], JSON_THROW_ON_ERROR),
                    'validation_rules' => json_encode($setting['validation_rules'], JSON_THROW_ON_ERROR),
                    'sensitivity' => $setting['sensitivity'],
                    'allowed_scopes' => json_encode($setting['allowed_scopes'], JSON_THROW_ON_ERROR),
                    'description' => $setting['description'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $definitionId = $db->table('setting_definitions')->where('key', 'booking.default_timezone')->value('id');
        $db->table('setting_values')->updateOrInsert(
            ['setting_definition_id' => $definitionId, 'scope_type' => 'hospital', 'scope_key' => 'hospital'],
            [
                'public_id' => $this->existingScopedSettingPublicId($db, $definitionId, 'hospital'),
                'value' => json_encode('Asia/Tehran', JSON_THROW_ON_ERROR),
                'updated_by' => $userId,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $entitlementVersion = 'foundation-v1';
        $entitlementExpiresAt = $now->copy()->addYear();
        $signingKeyId = (string) config('tenant.entitlements.signing_key_id');
        $signature = app(TenantEntitlementSignature::class)->sign(
            installationKey: 'demo-tenant-foundation',
            featureKey: 'tenant.foundation',
            enabled: true,
            entitlementVersion: $entitlementVersion,
            issuedAt: $now,
            expiresAt: $entitlementExpiresAt,
            keyId: $signingKeyId,
        );
        $db->table('feature_entitlements')->updateOrInsert(
            ['feature_key' => 'tenant.foundation'],
            [
                'public_id' => $this->existingPublicId($db, 'feature_entitlements', 'feature_key', 'tenant.foundation'),
                'enabled' => true,
                'entitlement_version' => $entitlementVersion,
                'signature_algorithm' => TenantEntitlementSignature::ALGORITHM,
                'signing_key_id' => $signingKeyId,
                'signature' => $signature,
                'issued_at' => $now,
                'expires_at' => $entitlementExpiresAt,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    private function existingPublicId($db, string $table, string $column, mixed $value): string
    {
        return $db->table($table)->where($column, $value)->value('public_id') ?? (string) Str::ulid();
    }

    private function existingScopedSettingPublicId($db, int $definitionId, string $scopeKey): string
    {
        return $db->table('setting_values')
            ->where('setting_definition_id', $definitionId)
            ->where('scope_type', 'hospital')
            ->where('scope_key', $scopeKey)
            ->value('public_id') ?? (string) Str::ulid();
    }
}
