<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\ReservationRatingOption;
use App\Support\QuerySorting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReservationRatingOptionController extends ApiController
{
    public function index(Request $request)
    {
        $query = ReservationRatingOption::query();

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }

        if ($request->filled('q')) {
            $term = trim((string) $request->query('q'));
            $query->where(function ($q) use ($term): void {
                $q->where('label', 'like', "%{$term}%")
                    ->orWhere('slug', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        QuerySorting::apply($query, $request, [
            'type' => 'reservation_rating_options.type',
            'label' => 'reservation_rating_options.label',
            'slug' => 'reservation_rating_options.slug',
            'active' => 'reservation_rating_options.active',
            'sort_order' => 'reservation_rating_options.sort_order',
            'created_at' => 'reservation_rating_options.created_at',
        ], 'sort_order');

        return $this->successResponse(
            data: $query->paginate(50),
            message: 'Admin reservation rating options.'
        );
    }

    public function store(Request $request)
    {
        $data = $this->validatedPayload($request);

        $option = ReservationRatingOption::query()->create($data);

        return $this->successResponse(
            data: $option,
            message: 'Reservation rating option created.',
            status: 201
        );
    }

    public function show(ReservationRatingOption $reservationRatingOption)
    {
        return $this->successResponse(
            data: $reservationRatingOption,
            message: 'Reservation rating option.'
        );
    }

    public function update(Request $request, ReservationRatingOption $reservationRatingOption)
    {
        $data = $this->validatedPayload($request, $reservationRatingOption->id);

        $reservationRatingOption->update($data);

        return $this->successResponse(
            data: $reservationRatingOption->fresh(),
            message: 'Reservation rating option updated.'
        );
    }

    public function destroy(ReservationRatingOption $reservationRatingOption)
    {
        $reservationRatingOption->delete();

        return response()->noContent();
    }

    private function validatedPayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'type' => ['required', Rule::in([ReservationRatingOption::TYPE_PRO, ReservationRatingOption::TYPE_CON])],
            'label' => ['required', 'string', 'max:120'],
            'slug' => [
                'required',
                'string',
                'max:140',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('reservation_rating_options', 'slug')
                    ->where(fn ($query) => $query->where('type', $request->input('type')))
                    ->ignore($ignoreId),
            ],
            'description' => ['nullable', 'string'],
            'active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
    }
}
