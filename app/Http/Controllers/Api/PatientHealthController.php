<?php

namespace App\Http\Controllers\Api;

use App\Services\Health\PatientHealthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PatientHealthController extends ApiController
{
    public function show(Request $request, PatientHealthService $health)
    {
        return $this->respond($request, $health, false);
    }

    public function update(Request $request, PatientHealthService $health)
    {
        return $this->respond($request, $health, true);
    }

    private function respond(Request $request, PatientHealthService $health, bool $write)
    {
        try {
            abort_unless(config('patient_health.enabled') === true, 503);
            abort_unless(Schema::hasTable('patient_health_snapshots') && Schema::hasTable('patient_biometric_observations'), 503);
            abort_if($request->query->count() !== 0, 422);
            $response = $this->successResponse(data: $write ? $health->save($request, $request->user(), $request->all()) : $health->read($request->user()));
        } catch (ValidationException $exception) {
            $response = $this->errorResponse('Invalid health information.', 422, $exception->errors());
        } catch (HttpExceptionInterface $exception) {
            $response = $this->errorResponse('Health information request could not be completed.', $exception->getStatusCode());
        } catch (Throwable) {
            // Unreadable history/key/schema and failed transactions never expose private values/bindings.
            // No blank fallback, overwrite or automatic retry. Operational telemetry can count status only.
            $response = $this->errorResponse('Health information is temporarily unavailable.', 503);
        }

        return $response->header('Cache-Control', 'private, no-store');
    }
}
