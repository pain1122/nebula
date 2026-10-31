<?php

namespace App\Http\Controllers\Api;

use App\Services\DoctorLocationService;
use Illuminate\Http\Request;

final class DoctorLocationController extends ApiController
{
    public function options(Request $request, DoctorLocationService $service)
    {
        return $this->successResponse($service->options($request))->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, DoctorLocationService $service)
    {
        return $this->successResponse($service->attach($request))->header('Cache-Control', 'no-store, private');
    }

    public function prices(Request $request, \App\Models\DoctorWorkplace $workplace, DoctorLocationService $service)
    {
        return $this->successResponse($service->prices($request, $workplace))->header('Cache-Control', 'no-store, private');
    }
}
