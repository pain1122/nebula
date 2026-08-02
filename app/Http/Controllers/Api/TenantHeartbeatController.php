<?php

namespace App\Http\Controllers\Api;

use App\Models\TenantInstance;
use App\Services\TenantHeartbeatIngestor;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantHeartbeatController extends ApiController
{
    public function __invoke(
        Request $request,
        TenantInstance $tenantInstance,
        TenantHeartbeatIngestor $ingestor,
    ): JsonResponse {
        $signature = trim((string) $request->header('X-Tenant-Signature'));

        if ($signature === '') {
            return $this->errorResponse(
                message: 'Heartbeat authentication failed.',
                status: 401,
                code: 'heartbeat_authentication_failed',
            );
        }

        try {
            $snapshot = $ingestor->ingest($tenantInstance, $request->all(), $signature);
        } catch (DomainException) {
            return $this->errorResponse(
                message: 'Heartbeat authentication failed.',
                status: 401,
                code: 'heartbeat_authentication_failed',
            );
        }

        return $this->successResponse(
            data: [
                'snapshot_public_id' => (string) $snapshot->public_id,
                'accepted_at' => now('UTC')->toISOString(),
            ],
            message: 'Heartbeat accepted.',
            status: 202,
        );
    }
}
