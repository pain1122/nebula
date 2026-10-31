<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\User;
use App\Services\AdminDashboardRead;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class DashboardReadController extends ApiController
{
    public function appointments(Request $request, AdminDashboardRead $dashboard)
    {
        abort_unless($request->user() instanceof User, 401);
        $actor = $dashboard->actor($request->user());
        abort_if(array_diff(array_keys($request->query()), ['from', 'until']), 422, 'Unsupported calendar fields.');
        $fields = $request->validate(['from' => ['required', 'date_format:Y-m-d'], 'until' => ['required', 'date_format:Y-m-d', 'after:from']]);
        $from = CarbonImmutable::parse($fields['from'], 'Asia/Tehran')->startOfDay();
        $until = CarbonImmutable::parse($fields['until'], 'Asia/Tehran')->startOfDay();
        abort_unless($from->diffInDays($until) <= 42, 422, 'Calendar range exceeds six weeks.');
        $data = $dashboard->appointments($actor, $from, $until);
        abort_unless($data === $dashboard->appointments($actor, $from, $until), 409, 'Appointments changed; refresh before continuing.');
        $fresh = $dashboard->actor($actor);
        abort_unless($actor->roles->pluck('name')->sort()->values()->all() === $fresh->roles->pluck('name')->sort()->values()->all(), 403);

        return $this->successResponse(data: $data, meta: ['read_only' => true, 'generated_at' => CarbonImmutable::now('UTC')->toISOString()])
            ->header('Cache-Control', 'no-store, private');
    }

    public function index(Request $request, AdminDashboardRead $dashboard)
    {
        abort_unless($request->user() instanceof User, 401);
        $actor = $dashboard->actor($request->user());
        abort_if($request->query() !== [], 422, 'Dashboard filters are unavailable.');
        $until = CarbonImmutable::now('UTC')->startOfSecond();
        $data = $dashboard->capture($actor, $until);
        $verify = $dashboard->capture($actor, $until);
        abort_unless($data === $verify, 409, 'Dashboard changed; refresh before continuing.');
        $fresh = $dashboard->actor($actor);
        abort_unless($actor->roles->pluck('name')->sort()->values()->all() === $fresh->roles->pluck('name')->sort()->values()->all(), 403);

        return $this->successResponse(data: $data, meta: ['read_only' => true, 'generated_at' => $until->toISOString(),
            'filters_supported' => false, 'latest_limit' => 5, 'rank_limit' => 5, 'currency_limit' => 20,
            'payment_basis' => 'currently_paid_canonical_payments_created_in_period', 'updates_reserved' => true])
            ->header('Cache-Control', 'no-store, private');
    }
}
