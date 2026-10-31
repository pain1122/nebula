<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\AdminVisitSlotControl;
use Illuminate\Http\Request;

class ScheduleControlController extends ApiController
{
    public function preview(Request $request, string $workplaceId)
    {
        return $this->successResponse(data: app(AdminVisitSlotControl::class)->preview($request, $this->id($workplaceId)))->header('Cache-Control', 'no-store, private');
    }

    public function update(Request $request, string $workplaceId)
    {
        abort_if($request->query(), 422);

        return $this->successResponse(data: app(AdminVisitSlotControl::class)->change($request, $this->id($workplaceId)))->header('Cache-Control', 'no-store, private');
    }

    private function id(string $id): int
    {
        return (int) validator(['id' => $id], ['id' => ['required', 'integer', 'min:1']])->validate()['id'];
    }
}
