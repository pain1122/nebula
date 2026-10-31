<?php

namespace App\Services;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\Specialty;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Shared API/legacy mutation boundary. No booking snapshot or doctor assignment writes. */
class CatalogAdministration
{
    private const MODELS = ['checkups' => Checkup::class, 'checkup-categories' => CheckupCategory::class, 'specialties' => Specialty::class];

    public function context(string $kind, ?int $id, User $user): array
    {
        abort_unless(isset(self::MODELS[$kind]), 404);
        $actor = $this->actor($user);
        $state = $this->snapshot(false);
        $row = $id ? $state[$kind]->firstWhere('id', $id) : null;
        abort_if($id && ! $row, 404);
        $this->sameAuthority($actor, $this->actor($user));
        $current = ! $row || $row->deleted_at === null;
        $archive = (bool) $row && $current;
        if ($kind === 'specialties' && $row) {
            $archive = $archive && ! $state['specialties']->contains('parent_id', $id)
                && ! $state['primary']->contains('specialty_id', $id) && ! $state['secondary']->contains('specialty_id', $id);
        }

        return ['kind' => $kind, 'id' => $id, 'revision' => $this->revision($kind, $id, $actor, $state),
            'can_create' => ! $id && $this->permitted($actor, $kind, 'create', null), 'can_update' => (bool) $row && $current && $this->permitted($actor, $kind, 'update', $row), 'can_archive' => $archive && $this->permitted($actor, $kind, 'archive', $row),
            'limits' => ['name' => 190, 'slug' => 190, 'description' => $kind === 'checkup-categories' ? 2000 : 5000, 'reason' => 1000, 'min_duration' => 5, 'max_duration' => 720, 'max_price' => '9007199254740991'],
            'generated_at' => now()->toISOString()];
    }

    public function mutate(Request $request, string $kind, ?int $id, string $operation): Model
    {
        abort_unless(isset(self::MODELS[$kind]) && in_array($operation, ['create', 'update', 'archive'], true), 404);
        $initial = $this->actor($request->user());
        $rules = ['expected_revision' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'], 'reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted']];
        if ($operation === 'archive' && $kind === 'checkup-categories') {
            $rules += ['checkup_action' => ['required', Rule::in(['detach', 'reassign'])], 'replacement_category_id' => ['nullable', 'integer', 'min:1']];
        } elseif ($operation !== 'archive') {
            $rules += [$kind === 'checkups' ? 'title' : 'name' => ['required', 'string', 'max:190'], 'slug' => ['required', 'string', 'max:190', 'regex:/\A[\pL\pN][\pL\pN_-]*\z/u'], 'is_active' => ['sometimes', 'boolean']];
            if ($kind !== 'specialties') {
                $rules['description'] = ['nullable', 'string', $kind === 'checkup-categories' ? 'max:2000' : 'max:5000'];
            }
            if ($kind === 'checkups') {
                $rules += ['checkup_category_id' => ['nullable', 'integer', 'min:1'], 'price' => ['required', 'integer', 'min:0', 'max:9007199254740991'], 'currency' => ['required', 'string', 'regex:/\A[A-Z]{3}\z/'], 'default_duration_minutes' => ['required', 'integer', 'min:5', 'max:720']];
            }
            if ($kind === 'specialties') {
                $rules['parent_id'] = ['nullable', 'integer', 'min:1'];
            }
        }
        $input = $request->except(['_token', '_method']);
        if (array_diff(array_keys($input), array_keys($rules))) {
            throw ValidationException::withMessages(['fields' => 'Unsupported catalog fields.']);
        }
        $data = validator($input, $rules)->validate();
        $reason = trim($data['reason']);
        if ($reason === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required.']);
        }
        try {
            $result = Cache::lock('checkupino:catalog-administration:v1', 120)->get(function () use ($request, $kind, $id, $operation, $initial, $data, $reason) {
                return DB::transaction(function () use ($request, $kind, $id, $operation, $initial, $data, $reason) {
                    $actor = $this->actor($request->user(), true);
                    $this->sameAuthority($initial, $actor);
                    $state = $this->snapshot(true);
                    abort_unless(hash_equals($this->revision($kind, $id, $actor, $state), $data['expected_revision']), 409, 'Catalog changed; refresh before saving.');
                    $row = $id ? $state[$kind]->firstWhere('id', $id) : new (self::MODELS[$kind]);
                    abort_unless($row && ! $row->trashed(), 409, 'Catalog record is unavailable.');
                    abort_unless($this->permitted($actor, $kind, $operation, $row), 403);
                    $before = $row->exists ? $this->auditData($row) : null;
                    $affected = $state['checkups']->where('checkup_category_id', $id)->count();
                    $batch = (string) Str::uuid();
                    if ($operation === 'archive') {
                        if ($kind === 'specialties') {
                            if ($state['specialties']->contains('parent_id', $id) || $state['primary']->contains('specialty_id', $id) || $state['secondary']->contains('specialty_id', $id)) {
                                throw ValidationException::withMessages(['specialty' => 'Referenced specialties or parents cannot be archived.']);
                            }
                        }
                        if ($kind === 'checkup-categories') {
                            $this->moveChildren($request, $actor, $row, $data, $state, $reason, $batch);
                        }
                        $row->delete();
                    } else {
                        $values = collect($data)->except(['reason', 'confirmed', 'expected_revision'])->all();
                        foreach (['price', 'default_duration_minutes', 'checkup_category_id', 'parent_id'] as $number) {
                            if (isset($values[$number])) {
                                $values[$number] = (int) $values[$number];
                            }
                        }
                        if (isset($values['is_active'])) {
                            $values['is_active'] = (bool) $values['is_active'];
                        }
                        foreach (['title', 'name', 'slug'] as $field) {
                            if (isset($values[$field])) {
                                $values[$field] = trim($values[$field]);
                                if ($values[$field] === '') {
                                    throw ValidationException::withMessages([$field => 'A value is required.']);
                                }
                            }
                        }
                        $peers = $state[$kind]->where('id', '!=', $id);
                        if ($peers->contains('slug', $values['slug']) || ($kind === 'specialties' && $peers->contains('name', $values['name']))) {
                            throw ValidationException::withMessages(['slug' => 'The catalog name or slug is already reserved.']);
                        }
                        if ($kind === 'checkups') {
                            $categoryId = $values['checkup_category_id'] ?? null;
                            $category = $categoryId ? $state['checkup-categories']->firstWhere('id', $categoryId) : null;
                            if ($categoryId && (! $category || $category->trashed() || ! $category->is_active)) {
                                throw ValidationException::withMessages(['checkup_category_id' => 'Choose a current active category.']);
                            }
                            $values['checkup_category_id'] = $categoryId;
                        }
                        if ($kind === 'specialties') {
                            $parent = $values['parent_id'] ?? null;
                            if ($parent) {
                                $selected = $state['specialties']->firstWhere('id', $parent);
                                if (! $selected || $selected->trashed() || ! $selected->is_active || (int) $parent === $id) {
                                    throw ValidationException::withMessages(['parent_id' => 'Choose a different active parent.']);
                                }
                            }
                            $values['parent_id'] = $parent;
                            $values['level'] = $this->depth($parent, $state['specialties'], $id);
                        }
                        $row->forceFill($values)->save();
                        if ($kind === 'specialties') {
                            $this->updateDescendantLevels($request, $actor, $row, $state['specialties'], $reason, $batch);
                        }
                    }
                    $after = $this->auditData($row);
                    if ($operation === 'archive' && $kind === 'checkup-categories') {
                        $after += ['checkup_action' => $data['checkup_action'], 'replacement_category_id' => $data['replacement_category_id'] ?? null, 'affected_checkup_count' => $affected];
                    }
                    $this->audit($request, $actor, $row, 'admin.'.$this->subject($kind).'.'.['create' => 'created', 'update' => 'updated', 'archive' => 'archived'][$operation], $before, $after, $reason, $batch);
                    $this->sameAuthority($actor, $this->actor($request->user(), true));

                    return $row;
                }, 3);
            });
            abort_unless($result instanceof Model, 409, 'Another catalog operation is in progress.');

            return $result;
        } catch (QueryException $error) {
            if (in_array((string) $error->getCode(), ['23000', '23505'], true)) {
                throw ValidationException::withMessages(['slug' => 'The catalog value is unavailable. Refresh and try again.']);
            }
            throw $error;
        }
    }

    private function moveChildren(Request $request, User $actor, CheckupCategory $category, array $data, array $state, string $reason, string $batch): void
    {
        $replacementId = $data['replacement_category_id'] ?? null;
        if ($data['checkup_action'] === 'detach' && $replacementId) {
            throw ValidationException::withMessages(['replacement_category_id' => 'Detach cannot select a replacement.']);
        }
        $replacement = $replacementId ? $state['checkup-categories']->firstWhere('id', $replacementId) : null;
        if ($data['checkup_action'] === 'reassign' && (! $replacement || $replacement->is($category) || $replacement->trashed() || ! $replacement->is_active)) {
            throw ValidationException::withMessages(['replacement_category_id' => 'Choose a different active category.']);
        }
        foreach ($state['checkups']->where('checkup_category_id', $category->id) as $child) {
            $before = $this->auditData($child);
            $child->checkup_category_id = $replacement?->id;
            $child->save();
            $this->audit($request, $actor, $child, 'admin.checkup.category_'.($replacement ? 'reassigned' : 'detached'), $before, $this->auditData($child), $reason, $batch);
        }
    }

    private function depth(?int $parentId, Collection $rows, ?int $self): int
    {
        $seen = $self ? [$self => true] : [];
        $level = 0;
        while ($parentId) {
            if (isset($seen[$parentId]) || ++$level > 32) {
                throw ValidationException::withMessages(['parent_id' => 'A specialty hierarchy cannot contain cycles or exceed 32 levels.']);
            }
            $seen[$parentId] = true;
            $parent = $rows->firstWhere('id', $parentId);
            if (! $parent || $parent->trashed()) {
                throw ValidationException::withMessages(['parent_id' => 'The parent hierarchy is unavailable.']);
            }
            $parentId = $parent->parent_id;
        }

        return $level;
    }

    private function updateDescendantLevels(Request $request, User $actor, Specialty $row, Collection $rows, string $reason, string $batch): void
    {
        $rows = $rows->keyBy('id');
        $rows[$row->id] = $row;
        foreach ($rows as $child) {
            if ($child->id === $row->id) {
                continue;
            }
            $ancestor = $child->parent_id;
            $seen = [];
            while ($ancestor && $ancestor !== $row->id && ! isset($seen[$ancestor])) {
                $seen[$ancestor] = true;
                $ancestor = $rows->get($ancestor)?->parent_id;
            }
            if ($ancestor !== $row->id) {
                continue;
            }
            $level = $this->depth($child->parent_id, $rows, $child->id);
            if ((int) $child->level !== $level) {
                $before = $this->auditData($child);
                $child->level = $level;
                $child->save();
                $this->audit($request, $actor, $child, 'admin.specialty.updated', $before, $this->auditData($child), $reason, $batch);
            }
        }
    }

    private function snapshot(bool $lock): array
    {
        $state = [];
        foreach (['checkup-categories', 'checkups', 'specialties'] as $kind) {
            $query = (self::MODELS[$kind])::withTrashed()->orderBy('id')->limit(5001);
            if ($lock) {
                $query->lockForUpdate();
            }
            $state[$kind] = $query->get();
            abort_if($state[$kind]->count() > 5000, 503, 'Catalog exceeds the guarded operation bound.');
        }
        foreach (['primary' => 'doctor_profiles', 'secondary' => 'doctor_specialty'] as $key => $table) {
            $state[$key] = DB::table($table)->select(['id', 'specialty_id'])->orderBy('id')->limit(5001)->get();
            abort_if($state[$key]->count() > 5000, 503, 'Specialty references exceed the guarded operation bound.');
        }

        return $state;
    }

    private function revision(string $kind, ?int $id, User $actor, array $state): string
    {
        return hash_hmac('sha256', json_encode([$kind, $id, $actor->id, $actor->roles->pluck('name')->sort()->values(), $state], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    private function actor(User $user, bool $lock = false): User
    {
        $query = User::query()->whereKey($user->id);
        if ($lock) {
            $query->lockForUpdate();
        }
        $actor = $query->firstOrFail();
        if ($lock) {
            DB::table('model_has_roles')->where('model_type', User::class)->where('model_id', $user->id)->orderBy('role_id')->lockForUpdate()->get();
        }
        $actor->load('roles');
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);

        return $actor;
    }

    private function sameAuthority(User $before, User $after): void
    {
        abort_unless($before->roles->pluck('name')->sort()->values()->all() === $after->roles->pluck('name')->sort()->values()->all(), 403);
    }

    private function permitted(User $actor, string $kind, string $operation, ?Model $row): bool
    {
        if ($kind === 'checkups') {
            return Gate::forUser($actor)->allows($operation, $operation === 'create' ? Checkup::class : $row);
        }
        if ($kind === 'checkup-categories' && $operation === 'archive') {
            return Gate::forUser($actor)->allows('archive', $row);
        }

        return true;
    }

    private function subject(string $kind): string
    {
        return ['checkups' => 'checkup', 'checkup-categories' => 'checkup_category', 'specialties' => 'specialty'][$kind];
    }

    private function auditData(Model $row): array
    {
        return collect($row->getAttributes())->only(['id', 'checkup_category_id', 'title', 'name', 'slug', 'description', 'price', 'currency', 'default_duration_minutes', 'is_active', 'parent_id', 'level', 'deleted_at'])->all();
    }

    private function audit(Request $request, User $actor, Model $row, string $action, ?array $before, array $after, string $reason, string $batch): void
    {
        $critical = str_ends_with($action, 'archived') || in_array($action, ['admin.checkup.category_detached', 'admin.checkup.category_reassigned'], true);
        app(AuditLogger::class)->log(request: $request, actor: $actor, action: $action, subject: $row, riskLevel: $critical ? 'critical' : 'high', before: $before, after: $after, batchId: $batch, reason: $reason);
    }
}
