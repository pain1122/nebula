<?php

namespace App\Http\Controllers\Api;

use App\Models\ReservationRatingOption;
use Illuminate\Http\Request;

class ReservationRatingOptionController extends ApiController
{
    public function index(Request $request)
    {
        $query = ReservationRatingOption::query()
            ->where('active', true)
            ->orderBy('type')
            ->orderBy('sort_order')
            ->orderBy('label');

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        return $this->successResponse(
            data: $query->get(),
            message: 'Reservation rating options.'
        );
    }
}
