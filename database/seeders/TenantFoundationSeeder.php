<?php

namespace Database\Seeders;

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

        $definitionKey = 'hospital.default_timezone';
        $db->table('setting_definitions')->updateOrInsert(
            ['key' => $definitionKey],
            [
                'public_id' => $this->existingPublicId($db, 'setting_definitions', 'key', $definitionKey),
                'group' => 'hospital',
                'value_type' => 'string',
                'default_value' => json_encode('Asia/Tehran', JSON_THROW_ON_ERROR),
                'validation_rules' => json_encode(['timezone'], JSON_THROW_ON_ERROR),
                'sensitivity' => 'public',
                'description' => 'The isolated hospital local timezone.',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
        $definitionId = $db->table('setting_definitions')->where('key', $definitionKey)->value('id');
        $db->table('setting_values')->updateOrInsert(
            ['setting_definition_id' => $definitionId, 'scope_type' => 'hospital', 'scope_key' => 'self'],
            [
                'public_id' => $this->existingScopedSettingPublicId($db, $definitionId),
                'value' => json_encode('Asia/Tehran', JSON_THROW_ON_ERROR),
                'updated_by' => $userId,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $entitlementPayload = 'tenant.foundation|enabled|foundation-v1';
        $db->table('feature_entitlements')->updateOrInsert(
            ['feature_key' => 'tenant.foundation'],
            [
                'public_id' => $this->existingPublicId($db, 'feature_entitlements', 'feature_key', 'tenant.foundation'),
                'enabled' => true,
                'entitlement_version' => 'foundation-v1',
                'signature_algorithm' => 'hmac-sha256-demo',
                'signature' => hash_hmac('sha256', $entitlementPayload, (string) config('app.key')),
                'issued_at' => $now,
                'expires_at' => $now->copy()->addYear(),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    private function existingPublicId($db, string $table, string $column, mixed $value): string
    {
        return $db->table($table)->where($column, $value)->value('public_id') ?? (string) Str::ulid();
    }

    private function existingScopedSettingPublicId($db, int $definitionId): string
    {
        return $db->table('setting_values')
            ->where('setting_definition_id', $definitionId)
            ->where('scope_type', 'hospital')
            ->where('scope_key', 'self')
            ->value('public_id') ?? (string) Str::ulid();
    }
}
