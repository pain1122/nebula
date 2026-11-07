<?php

namespace App\Http\Controllers\Api;

use App\Services\Recommendations\PatientRecommendationService;
use App\Services\Recommendations\RecommendationAdministration;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class RecommendationController extends ApiController
{
    public function index(Request $request, RecommendationAdministration $service)
    {
        return $this->safe(fn () => $service->read($request));
    }

    public function show(Request $request, RecommendationAdministration $service, string $ruleId)
    {
        return $this->safe(fn () => $service->read($request, $ruleId));
    }

    public function store(Request $request, RecommendationAdministration $service)
    {
        return $this->safe(fn () => $service->save($request, null));
    }

    public function update(Request $request, RecommendationAdministration $service, string $ruleId)
    {
        return $this->safe(fn () => $service->save($request, $ruleId));
    }

    public function action(Request $request, RecommendationAdministration $service, string $ruleId)
    {
        return $this->safe(fn () => $service->act($request, $ruleId));
    }

    public function grant(Request $request, RecommendationAdministration $service)
    {
        return $this->safe(fn () => $service->designate($request));
    }

    public function revoke(Request $request, RecommendationAdministration $service, string $grantId)
    {
        return $this->safe(fn () => $service->designate($request, $grantId));
    }

    public function patient(Request $request, PatientRecommendationService $service)
    {
        return $this->safe(fn () => $service->read($request));
    }

    public function preview(Request $request, RecommendationAdministration $service, string $ruleId)
    {
        return $this->safe(fn () => $service->preview($request, $ruleId));
    }

    public function media(Request $request, RecommendationAdministration $service, string $ruleId, string $assetId)
    {
        return $this->safe(function () use ($request, $service, $ruleId, $assetId) {
            $result = $service->media($request, $ruleId, $assetId);

            return response()->stream(function () use ($result): void {
                try {
                    fpassthru($result['stream']);
                } finally {
                    fclose($result['stream']);
                }
            }, 200, ['Content-Type' => $result['mime'], 'Content-Length' => (string) $result['bytes'], 'X-Content-Type-Options' => 'nosniff',
                'Content-Security-Policy' => "default-src 'none'; sandbox", 'Content-Disposition' => 'inline']);
        });
    }

    private function safe(callable $operation)
    {
        try {
            $result = $operation();

            return $result instanceof \Symfony\Component\HttpFoundation\Response ? $result : $this->successResponse(data: $result);
        } catch (ValidationException|InvalidArgumentException) {
            return $this->errorResponse('Invalid recommendation request.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Recommendation request could not be completed.', $error->getStatusCode());
        } catch (Throwable) {
            // Do not report private health payloads, qualification evidence or parser/SQL details.
            return $this->errorResponse('Recommendations are temporarily unavailable.', 503);
        }
    }
}
