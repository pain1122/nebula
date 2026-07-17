<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class QuerySorting
{
    /**
     * @param  array<string, string|callable>  $allowedSorts
     */
    public static function apply(mixed $query, Request $request, array $allowedSorts, string $defaultSort, string $defaultDirection = 'asc'): mixed
    {
        [$sortBy, $direction] = self::parse($request, $allowedSorts, $defaultSort, $defaultDirection);

        $sort = $allowedSorts[$sortBy];

        if (is_callable($sort)) {
            $sort($query, $direction);

            return $query;
        }

        $query->orderBy($sort, $direction);

        return $query;
    }

    /**
     * @param  array<string, string|callable>  $allowedSorts
     * @return array{0: string, 1: string}
     */
    public static function parse(Request $request, array $allowedSorts, string $defaultSort, string $defaultDirection = 'asc'): array
    {
        $sortBy = $request->query('sort_by', $request->query('sort', $defaultSort));

        if (! is_string($sortBy) || ! array_key_exists($sortBy, $allowedSorts)) {
            throw ValidationException::withMessages([
                'sort_by' => ['invalid_sort_column'],
            ]);
        }

        $direction = strtolower((string) $request->query('sort_dir', $request->query('direction', $defaultDirection)));

        if (! in_array($direction, ['asc', 'desc'], true)) {
            throw ValidationException::withMessages([
                'sort_dir' => ['invalid_sort_direction'],
            ]);
        }

        return [$sortBy, $direction];
    }
}
