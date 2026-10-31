<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\Specialty;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Catalog metadata only; historical booking snapshots never become catalog writes. */
class CatalogReadController extends ApiController
{
    public function checkups(Request $request)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, true);
        $query = $this->checkupQuery();
        $this->applyFilters($query, $filters, 'title');
        if (isset($filters['category_id'])) {
            $query->where('checkup_category_id', $filters['category_id']);
        }
        if ($filters['uncategorized'] ?? false) {
            $query->whereNull('checkup_category_id');
        }
        foreach (['currency' => ['currency', '='], 'min_price' => ['price', '>='], 'max_price' => ['price', '<=']] as $filter => [$column, $operator]) {
            if (isset($filters[$filter])) {
                $query->where($column, $operator, $filters[$filter]);
            }
        }
        $rows = $query->paginate($filters['per_page'] ?? 20);

        return $this->respond($actor, $rows->getCollection()->map(fn (Checkup $row) => $this->checkupData($row)), $this->pagination($rows));
    }

    public function checkup(Request $request, string $checkupId)
    {
        $actor = $this->actor($request);
        $this->detailFilters($request);
        $row = $this->checkupQuery()->findOrFail($this->id($checkupId));

        return $this->respond($actor, $this->checkupData($row, true));
    }

    public function categories(Request $request)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, false);
        $query = $this->categoryQuery();
        $this->applyFilters($query, $filters, 'name');
        $rows = $query->paginate($filters['per_page'] ?? 20);

        return $this->respond($actor, $rows->getCollection()->map(fn (CheckupCategory $row) => $this->categoryData($row)), $this->pagination($rows));
    }

    public function category(Request $request, string $categoryId)
    {
        $actor = $this->actor($request);
        $this->detailFilters($request);
        $row = $this->categoryQuery()->findOrFail($this->id($categoryId));

        return $this->respond($actor, $this->categoryData($row, true));
    }

    private function checkupQuery(): Builder
    {
        return Checkup::withTrashed()
            ->select(['id', 'public_id', 'checkup_category_id', 'title', 'slug', 'description', 'price', 'currency', 'default_duration_minutes', 'is_active', 'deleted_at', 'created_at', 'updated_at'])
            ->with(['category' => fn ($query) => $query->withTrashed()->select(['id', 'public_id', 'name', 'slug', 'is_active', 'deleted_at'])])
            ->withCount(['reservations', 'workplaces']);
    }

    public function specialties(Request $request)
    {
        $actor = $this->actor($request);
        $filters = $this->filters($request, false, true);
        $query = $this->specialtyQuery();
        $this->applyFilters($query, $filters, 'name');
        if (isset($filters['parent_id'])) {
            $query->where('parent_id', $filters['parent_id']);
        }
        if ($filters['root_only'] ?? false) {
            $query->whereNull('parent_id');
        }
        $rows = $query->paginate($filters['per_page'] ?? 20);

        return $this->respond($actor, $rows->getCollection()->map(fn (Specialty $row) => $this->specialtyData($row)), $this->pagination($rows));
    }

    public function specialty(Request $request, string $specialtyId)
    {
        $actor = $this->actor($request);
        $this->detailFilters($request);
        $row = $this->specialtyQuery()->findOrFail($this->id($specialtyId));

        return $this->respond($actor, $this->specialtyData($row));
    }

    private function specialtyQuery(): Builder
    {
        return Specialty::withTrashed()->select(['id', 'public_id', 'name', 'slug', 'parent_id', 'level', 'is_active', 'deleted_at', 'created_at', 'updated_at'])
            ->with(['parent' => fn ($query) => $query->withTrashed()->select(['id', 'public_id', 'name', 'slug', 'is_active', 'deleted_at'])])
            ->withCount(['children as children_count' => fn ($query) => $query->withTrashed()])
            ->selectSub(DB::table('doctor_profiles')->selectRaw('COUNT(*)')->whereColumn('specialty_id', 'specialties.id'), 'primary_doctors_count')
            ->selectSub(DB::table('doctor_specialty')->selectRaw('COUNT(*)')->whereColumn('specialty_id', 'specialties.id'), 'secondary_associations_count');
    }

    private function specialtyData(Specialty $row): array
    {
        return ['id' => (int) $row->id, 'public_id' => (string) $row->public_id, 'name' => $row->name, 'slug' => $row->slug,
            'level' => (int) $row->level, 'is_active' => (bool) $row->is_active, 'state' => $this->state($row),
            'parent' => $row->parent ? ['id' => (int) $row->parent->id, 'public_id' => (string) $row->parent->public_id, 'name' => $row->parent->name, 'slug' => $row->parent->slug, 'state' => $this->state($row->parent)] : null,
            'counts' => ['children' => (int) $row->children_count, 'primary_doctors' => (int) $row->primary_doctors_count, 'secondary_associations' => (int) $row->secondary_associations_count],
            'archived_at' => $row->deleted_at?->toISOString(), 'created_at' => $row->created_at?->toISOString(), 'updated_at' => $row->updated_at?->toISOString(), 'description' => null];
    }

    private function categoryQuery(): Builder
    {
        return CheckupCategory::withTrashed()
            ->select(['id', 'public_id', 'name', 'slug', 'description', 'is_active', 'deleted_at', 'created_at', 'updated_at'])
            ->withCount([
                'checkups as checkups_total_count' => fn ($query) => $query->withTrashed(),
                'checkups as checkups_active_count' => fn ($query) => $query->where('is_active', true),
                'checkups as checkups_archived_count' => fn ($query) => $query->onlyTrashed(),
            ]);
    }

    private function filters(Request $request, bool $checkups, bool $specialties = false): array
    {
        $sorts = $checkups ? ['id', 'title', 'slug', 'price', 'created_at', 'updated_at'] : ['id', 'name', 'slug', 'created_at', 'updated_at'];
        $rules = [
            'q' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', Rule::in(['current', 'active', 'inactive', 'archived', 'all'])],
            'sort_by' => ['nullable', Rule::in($sorts)],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
        if ($checkups) {
            $rules += [
                'category_id' => ['nullable', 'integer', 'min:1'],
                'uncategorized' => ['nullable', 'boolean'],
                'currency' => ['nullable', 'string', 'regex:/\A[A-Z]{3}\z/'],
                'min_price' => ['nullable', 'integer', 'min:0', 'max:9007199254740991'],
                'max_price' => ['nullable', 'integer', 'min:0', 'max:9007199254740991'],
            ];
        }
        if ($specialties) {
            $rules += ['parent_id' => ['nullable', 'integer', 'min:1'], 'root_only' => ['nullable', 'boolean']];
        }
        if (array_diff(array_keys($request->query()), array_keys($rules))) {
            throw ValidationException::withMessages(['filters' => 'Unsupported catalog filter.']);
        }
        $data = $request->validate($rules);
        if (isset($data['parent_id']) && ($data['root_only'] ?? false)) {
            throw ValidationException::withMessages(['parent_id' => 'Choose a parent or root-only, not both.']);
        }
        if (isset($data['category_id']) && ($data['uncategorized'] ?? false)) {
            throw ValidationException::withMessages(['category_id' => 'Choose a category or uncategorized, not both.']);
        }
        if (isset($data['min_price'], $data['max_price']) && $data['min_price'] > $data['max_price']) {
            throw ValidationException::withMessages(['max_price' => 'Choose an ordered price range.']);
        }

        return $data;
    }

    private function applyFilters(Builder $query, array $filters, string $label): void
    {
        $table = $query->getModel()->getTable();
        $state = $filters['state'] ?? 'current';
        if ($state === 'archived') {
            $query->onlyTrashed();
        } elseif ($state !== 'all') {
            $query->withoutTrashed();
            if (in_array($state, ['active', 'inactive'], true)) {
                $query->where('is_active', $state === 'active');
            }
        }
        $term = trim($filters['q'] ?? '');
        if ($term !== '') {
            // Explicit cross-driver escape: user percent/underscore characters are literal.
            $literal = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
            $query->where(fn ($search) => $search->whereRaw("{$table}.{$label} LIKE ? ESCAPE '!'", [$literal])
                ->orWhereRaw("{$table}.slug LIKE ? ESCAPE '!'", [$literal])->orWhere('public_id', $term));
        }
        $sort = $filters['sort_by'] ?? $label;
        $direction = $filters['sort_dir'] ?? 'asc';
        $query->orderBy($table.'.'.$sort, $direction);
        if ($sort !== 'id') {
            $query->orderBy($table.'.id', $direction);
        }
    }

    private function checkupData(Checkup $row, bool $detail = false): array
    {
        $data = [
            'id' => (int) $row->id, 'public_id' => (string) $row->public_id,
            'title' => $row->title, 'slug' => $row->slug,
            'price' => (string) $row->price, 'currency' => $row->currency,
            'default_duration_minutes' => (int) $row->default_duration_minutes,
            'is_active' => (bool) $row->is_active, 'state' => $this->state($row),
            'category' => $row->category ? [
                'id' => (int) $row->category->id, 'public_id' => (string) $row->category->public_id,
                'name' => $row->category->name, 'slug' => $row->category->slug,
                'state' => $this->state($row->category),
            ] : null,
            'counts' => ['reservations' => (int) $row->reservations_count, 'workplace_assignments' => (int) $row->workplaces_count],
            'archived_at' => $row->deleted_at?->toISOString(),
            'created_at' => $row->created_at?->toISOString(), 'updated_at' => $row->updated_at?->toISOString(),
        ];
        if ($detail) {
            $data['description'] = $row->description;
        }

        return $data;
    }

    private function categoryData(CheckupCategory $row, bool $detail = false): array
    {
        $data = [
            'id' => (int) $row->id, 'public_id' => (string) $row->public_id,
            'name' => $row->name, 'slug' => $row->slug,
            'is_active' => (bool) $row->is_active, 'state' => $this->state($row),
            'counts' => [
                'checkups' => (int) $row->checkups_total_count,
                'active_checkups' => (int) $row->checkups_active_count,
                'archived_checkups' => (int) $row->checkups_archived_count,
            ],
            'archived_at' => $row->deleted_at?->toISOString(),
            'created_at' => $row->created_at?->toISOString(), 'updated_at' => $row->updated_at?->toISOString(),
        ];
        if ($detail) {
            $data['description'] = $row->description;
        }

        return $data;
    }

    private function state(Checkup|CheckupCategory|Specialty $row): string
    {
        return $row->trashed() ? 'archived' : ($row->is_active ? 'active' : 'inactive');
    }

    private function actor(Request $request): User
    {
        $actor = User::with('roles')->findOrFail($request->user()->id);
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function respond(User $actor, mixed $data, array $meta = [])
    {
        $current = User::with('roles')->find($actor->id);
        abort_unless($current?->permitsAuthentication() && $current->canAccessAdminPanel()
            && $current->roles->pluck('name')->sort()->values()->all() === $actor->roles->pluck('name')->sort()->values()->all(), 403);

        return $this->successResponse(data: $data, meta: $meta + ['generated_at' => now()->toISOString()])
            ->header('Cache-Control', 'no-store, private');
    }

    private function pagination($rows): array
    {
        return ['pagination' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'per_page' => $rows->perPage(), 'total' => $rows->total()]];
    }

    private function id(string $id): int
    {
        return (int) validator(['id' => $id], ['id' => ['required', 'integer', 'min:1']])->validate()['id'];
    }

    private function detailFilters(Request $request): void
    {
        if ($request->query()) {
            throw ValidationException::withMessages(['filters' => 'Catalog details accept no filters.']);
        }
    }
}
