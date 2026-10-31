<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\CatalogAdministration;
use Illuminate\Http\Request;

class CatalogMutationController extends ApiController
{
    public function context(Request $request, string $kind, ?string $catalogId = null)
    {
        abort_if($request->query(), 422);
        $id = $catalogId === null ? null : (int) validator(['id' => $catalogId], ['id' => ['required', 'integer', 'min:1']])->validate()['id'];

        return $this->successResponse(data: app(CatalogAdministration::class)->context($kind, $id, $request->user()))->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, string $kind)
    {
        $row = app(CatalogAdministration::class)->mutate($request, $kind, null, 'create');

        return $this->successResponse(data: ['id' => (int) $row->id], status: 201)->header('Cache-Control', 'no-store, private');
    }

    public function update(Request $request, string $kind, string $catalogId)
    {
        $row = app(CatalogAdministration::class)->mutate($request, $kind, $this->id($catalogId), 'update');

        return $this->successResponse(data: ['id' => (int) $row->id])->header('Cache-Control', 'no-store, private');
    }

    public function archive(Request $request, string $kind, string $catalogId)
    {
        $row = app(CatalogAdministration::class)->mutate($request, $kind, $this->id($catalogId), 'archive');

        return $this->successResponse(data: ['id' => (int) $row->id])->header('Cache-Control', 'no-store, private');
    }

    private function id(string $id): int
    {
        return (int) validator(['id' => $id], ['id' => ['required', 'integer', 'min:1']])->validate()['id'];
    }
}
