<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AdminPanelFilters
{
    public static function validate(Request $request, array $extra = []): array
    {
        return $request->validate($extra + [
            'q' => ['nullable', 'string', 'max:200'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('from'), 'after_or_equal:from')],
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1'],
            'sort_by' => ['nullable', 'string', 'max:50'],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);
    }

    public static function dates(Builder $query, array $filters, string $column = 'created_at'): void
    {
        if (! empty($filters['from'])) {
            $query->where($column, '>=', CarbonImmutable::parse($filters['from'], 'Asia/Tehran')->startOfDay()->utc());
        }
        if (! empty($filters['to'])) {
            $query->where($column, '<', CarbonImmutable::parse($filters['to'], 'Asia/Tehran')->addDay()->startOfDay()->utc());
        }
    }

    public static function pagination($page): array
    {
        return ['pagination' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(), 'total' => $page->total(),
        ]];
    }
}
