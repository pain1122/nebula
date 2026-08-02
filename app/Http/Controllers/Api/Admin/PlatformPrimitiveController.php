<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Admin\SetTenantFeatureOverrideRequest;
use App\Http\Requests\Admin\UpdateMarketplaceSettingRequest;
use App\Http\Requests\Admin\UpdateTenantRegistryRequest;
use App\Models\Feature;
use App\Models\TenantInstance;
use App\Services\MarketplaceSettingService;
use App\Services\TenantFeatureOverrideService;
use App\Services\TenantRegistryService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class PlatformPrimitiveController extends ApiController
{
    public function updateTenant(
        UpdateTenantRegistryRequest $request,
        TenantInstance $tenantInstance,
        TenantRegistryService $service,
    ): JsonResponse {
        $data = $request->validated();
        $tenant = $service->update(
            $request,
            $request->user(),
            $tenantInstance,
            $data['changes'],
            $data['reason'],
        );

        return $this->successResponse(
            data: ['tenant' => $this->tenantData($tenant)],
            message: 'Tenant registry updated.',
        );
    }

    public function setFeature(
        SetTenantFeatureOverrideRequest $request,
        TenantInstance $tenantInstance,
        Feature $feature,
        TenantFeatureOverrideService $service,
    ): JsonResponse {
        $data = $request->validated();
        $override = $service->set(
            $request,
            $request->user(),
            $tenantInstance,
            $feature,
            $data['enabled'],
            $data['reason'],
            isset($data['expires_at']) ? CarbonImmutable::parse($data['expires_at']) : null,
        );

        return $this->successResponse(
            data: [
                'feature_override' => [
                    'public_id' => (string) $override->public_id,
                    'tenant_public_id' => (string) $tenantInstance->public_id,
                    'feature_key' => $feature->key,
                    'enabled' => (bool) $override->enabled,
                    'expires_at' => $override->expires_at?->toISOString(),
                ],
            ],
            message: 'Tenant feature override updated.',
        );
    }

    public function updateSetting(
        UpdateMarketplaceSettingRequest $request,
        string $settingKey,
        MarketplaceSettingService $service,
    ): JsonResponse {
        $data = $request->validated();
        $setting = $service->set(
            $request,
            $request->user(),
            $settingKey,
            $data['scope_type'],
            $data['scope_key'],
            $data['value'],
            $data['reason'],
        );

        return $this->successResponse(
            data: [
                'setting' => [
                    'key' => $settingKey,
                    'scope_type' => $setting->scope_type,
                    'scope_key' => $setting->scope_key,
                    'value' => $setting->value,
                ],
            ],
            message: 'Marketplace setting updated.',
        );
    }

    /** @return array<string, mixed> */
    private function tenantData(TenantInstance $tenant): array
    {
        return [
            'public_id' => (string) $tenant->public_id,
            'display_name' => $tenant->display_name,
            'domain' => $tenant->domain,
            'state' => $tenant->state,
            'plan_key' => $tenant->plan_key,
            'subscription_status' => $tenant->subscription_status,
            'feature_set_version' => $tenant->feature_set_version,
        ];
    }
}
