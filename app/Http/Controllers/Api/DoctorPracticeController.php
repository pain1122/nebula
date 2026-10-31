<?php

namespace App\Http\Controllers\Api;

use App\Services\DoctorPracticeService;
use Illuminate\Http\Request;

final class DoctorPracticeController extends ApiController
{
    public function show(Request $request, DoctorPracticeService $service)
    {
        $data = $service->capture($request->user());
        $service->actor($request->user());

        return $this->successResponse(data: $data)->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, DoctorPracticeService $service)
    {
        return $this->successResponse(data: $service->save($request))->header('Cache-Control', 'private, no-store');
    }
}
