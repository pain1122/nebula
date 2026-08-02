<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\ReservationRatingOptionResource;
use App\Models\ReservationRatingOption;
use App\Services\AuditLogger;
use App\Support\QuerySorting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
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

        $options = $query->paginate(max(1, min($request->integer('per_page', 50), 100)));

        return $this->successResponse(
            data: ReservationRatingOptionResource::collection($options->getCollection())->resolve($request),
            message: 'Admin reservation rating options.',
            meta: [
                'pagination' => [
                    'current_page' => $options->currentPage(),
                    'last_page' => $options->lastPage(),
                    'per_page' => $options->perPage(),
                    'total' => $options->total(),
                ],
            ],
        );
    }

    public function store(Request $request, AuditLogger $auditLogger)
    {
        Gate::authorize('create', ReservationRatingOption::class);
        $data = $this->validatedPayload($request);
        $reason = trim($data['reason']);
        unset($data['reason']);

        $option = DB::transaction(function () use ($request, $auditLogger, $data, $reason): ReservationRatingOption {
            $option = ReservationRatingOption::query()->create($data);
            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.rating_option.created',
                subject: $option,
                riskLevel: 'high',
                before: null,
                after: $this->auditSnapshot($option),
                reason: $reason,
            );

            return $option;
        });

        return $this->successResponse(
            data: (new ReservationRatingOptionResource($option))->resolve($request),
            message: 'Reservation rating option created.',
            status: 201
        );
    }

    public function show(Request $request, ReservationRatingOption $reservationRatingOption)
    {
        return $this->successResponse(
            data: (new ReservationRatingOptionResource($reservationRatingOption))->resolve($request),
            message: 'Reservation rating option.'
        );
    }

    public function update(Request $request, ReservationRatingOption $reservationRatingOption, AuditLogger $auditLogger)
    {
        Gate::authorize('update', $reservationRatingOption);
        $data = $this->validatedPayload($request, $reservationRatingOption->id);
        $reason = trim($data['reason']);
        unset($data['reason']);

        $reservationRatingOption = DB::transaction(function () use ($request, $auditLogger, $reservationRatingOption, $data, $reason): ReservationRatingOption {
            $option = ReservationRatingOption::query()->lockForUpdate()->findOrFail($reservationRatingOption->getKey());
            $before = $this->auditSnapshot($option);
            $option->update($data);
            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.rating_option.updated',
                subject: $option,
                riskLevel: 'high',
                before: $before,
                after: $this->auditSnapshot($option),
                reason: $reason,
            );

            return $option->fresh();
        });

        return $this->successResponse(
            data: (new ReservationRatingOptionResource($reservationRatingOption->fresh()))->resolve($request),
            message: 'Reservation rating option updated.'
        );
    }

    public function destroy(Request $request, ReservationRatingOption $reservationRatingOption, AuditLogger $auditLogger)
    {
        Gate::authorize('delete', $reservationRatingOption);
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        DB::transaction(function () use ($request, $auditLogger, $reservationRatingOption, $data): void {
            $option = ReservationRatingOption::query()->lockForUpdate()->findOrFail($reservationRatingOption->getKey());
            $before = $this->auditSnapshot($option);
            $option->delete();
            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.rating_option.archived',
                subject: $option,
                riskLevel: 'high',
                before: $before,
                after: $this->auditSnapshot($option),
                reason: trim($data['reason']),
            );
        });

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
            'reason' => ['required', 'string', 'max:1000'],
        ]);
    }

    /** @return array<string, mixed> */
    private function auditSnapshot(ReservationRatingOption $option): array
    {
        return [
            'type' => $option->type,
            'slug' => $option->slug,
            'active' => (bool) $option->active,
            'sort_order' => $option->sort_order,
            'deleted_at' => $option->deleted_at?->toISOString(),
        ];
    }
}
