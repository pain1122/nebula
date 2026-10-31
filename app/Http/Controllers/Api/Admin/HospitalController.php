<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\MarketplaceHospital;
use App\Services\HospitalAdministration;
use Illuminate\Http\Request;

final class HospitalController extends ApiController
{
    public function index(Request $request, HospitalAdministration $service)
    {
        $service->actor($request->user());
        abort_if(array_diff(array_keys($request->query()), ['q', 'city', 'active', 'page']), 422);
        $data = $request->validate(['q' => ['nullable', 'string', 'max:160'], 'city' => ['nullable', 'string', 'max:120'], 'active' => ['nullable', 'in:0,1'], 'page' => ['nullable', 'integer', 'between:1,1000']]);
        $rows = MarketplaceHospital::whereNull('archived_at')
            ->when($data['q'] ?? null, fn ($q, $term) => $q->where(fn ($q) => $q->where('name', 'like', '%'.$term.'%')->orWhere('city', 'like', '%'.$term.'%')))
            ->when($data['city'] ?? null, fn ($q, $city) => $q->where('city', $city))
            ->when(isset($data['active']), fn ($q) => $q->where('is_active', $data['active']))
            ->orderBy('name')->orderBy('id')->paginate(20);
        $service->actor($request->user());

        return $this->successResponse(['hospitals' => $rows->map(fn ($row) => $service->project($row))->all(), 'page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total()])->header('Cache-Control', 'no-store, private');
    }

    public function context(Request $request, HospitalAdministration $service)
    {
        $actor = $service->actor($request->user());

        return $this->successResponse(['revision' => $service->revision($actor, null)])->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, MarketplaceHospital $hospital, HospitalAdministration $service)
    {
        $actor = $service->actor($request->user());

        return $this->successResponse(['hospital' => $service->project($hospital), 'revision' => $service->revision($actor, $hospital)])->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, HospitalAdministration $service)
    {
        return $this->successResponse(['hospital' => $service->project($service->save($request, null))])->header('Cache-Control', 'no-store, private');
    }

    public function update(Request $request, MarketplaceHospital $hospital, HospitalAdministration $service)
    {
        return $this->successResponse(['hospital' => $service->project($service->save($request, $hospital))])->header('Cache-Control', 'no-store, private');
    }
}
