<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AttachApiContractContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestedCorrelationId = $request->header('X-Correlation-ID');
        $correlationId = is_string($requestedCorrelationId) && Str::isUuid($requestedCorrelationId)
            ? $requestedCorrelationId
            : (string) Str::uuid();

        $request->attributes->set('correlation_id', $correlationId);
        $response = $next($request);
        $response->headers->set('X-API-Version', '1');
        $response->headers->set('X-Correlation-ID', $correlationId);

        return $response;
    }
}
