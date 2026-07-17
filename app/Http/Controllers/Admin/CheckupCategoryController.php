<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCheckupCategoryRequest;
use App\Http\Requests\Admin\UpdateCheckupCategoryRequest;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class CheckupCategoryController extends Controller
{
    public function index(): View
    {
        $items = CheckupCategory::orderBy('name')->paginate(20);
        $replacementCategories = CheckupCategory::orderBy('name')->get(['id', 'name']);

        return view('admin.checkup_categories.index', compact('items', 'replacementCategories'));
    }

    public function create(): View
    {
        return view('admin.checkup_categories.create');
    }

    public function store(StoreCheckupCategoryRequest $request): RedirectResponse
    {
        CheckupCategory::create($request->validated());

        return redirect()->route('admin.checkup-categories.index')->with('status', 'دسته ایجاد شد.');
    }

    public function edit(CheckupCategory $checkup_category): View
    {
        return view('admin.checkup_categories.edit', ['item' => $checkup_category]);
    }

    public function update(
        UpdateCheckupCategoryRequest $request,
        CheckupCategory $checkup_category,
    ): RedirectResponse {
        $data = $request->validated();

        DB::transaction(function () use ($checkup_category, $data): void {
            $lockedCategory = CheckupCategory::query()
                ->whereKey($checkup_category->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $lockedCategory->update($data);
        }, attempts: 3);

        return redirect()->route('admin.checkup-categories.index')->with('status', 'دسته به‌روزرسانی شد.');
    }

    public function confirmArchive(Request $request, CheckupCategory $checkup_category): View
    {
        Gate::authorize('archive', $checkup_category);

        [$checkupAction, $replacementCategory] = $this->validatedArchiveChoice($request, $checkup_category);
        $affectedCheckupCount = Checkup::withTrashed()
            ->where('checkup_category_id', $checkup_category->id)
            ->count();

        $choiceDescription = $checkupAction === 'detach'
            ? 'دسته از تمام چکاپ‌های وابسته حذف می‌شود و خود چکاپ‌ها فعال و محفوظ می‌مانند.'
            : 'تمام چکاپ‌های وابسته به دسته «'.$replacementCategory?->name.'» منتقل می‌شوند.';

        return view('admin.catalog.confirm-archive', [
            'title' => 'بایگانی دسته چکاپ',
            'itemLabel' => $checkup_category->name,
            'warning' => $choiceDescription.' تعداد چکاپ‌های متاثر: '.$affectedCheckupCount.'. هیچ رزرو یا پرداختی حذف نمی‌شود.',
            'action' => route('admin.checkup-categories.destroy', $checkup_category),
            'cancelUrl' => route('admin.checkup-categories.index'),
            'actionData' => [
                'checkup_action' => $checkupAction,
                'replacement_category_id' => $replacementCategory?->id,
            ],
        ]);
    }

    public function archive(
        Request $request,
        CheckupCategory $checkup_category,
        AuditLogger $auditLogger,
    ): RedirectResponse {
        Gate::authorize('archive', $checkup_category);

        [$checkupAction, $replacementCategory] = $this->validatedArchiveChoice($request, $checkup_category);
        $replacementCategoryId = $replacementCategory?->id;
        $batchId = (string) Str::uuid();

        DB::transaction(function () use (
            $request,
            $checkup_category,
            $checkupAction,
            $replacementCategoryId,
            $batchId,
            $auditLogger,
        ): void {
            $categoryIds = collect([$checkup_category->getKey(), $replacementCategoryId])
                ->filter(fn ($id) => ! is_null($id))
                ->unique()
                ->sort()
                ->values();

            $lockedCategories = CheckupCategory::query()
                ->whereIn('id', $categoryIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $lockedCategory = $lockedCategories->get($checkup_category->getKey());
            $lockedReplacement = $replacementCategoryId
                ? $lockedCategories->get($replacementCategoryId)
                : null;

            if (! $lockedCategory || ($replacementCategoryId && ! $lockedReplacement)) {
                throw ValidationException::withMessages([
                    'replacement_category_id' => 'دسته مبدا یا جایگزین دیگر فعال نیست. صفحه را تازه‌سازی و دوباره تلاش کنید.',
                ]);
            }

            $checkups = Checkup::withTrashed()
                ->where('checkup_category_id', $lockedCategory->id)
                ->lockForUpdate()
                ->get();

            foreach ($checkups as $checkup) {
                $before = $this->checkupAuditSnapshot($checkup);
                $checkup->checkup_category_id = $lockedReplacement?->id;
                $checkup->save();

                $auditLogger->log(
                    request: $request,
                    actor: $request->user(),
                    action: $checkupAction === 'detach'
                        ? 'admin.checkup.category_detached'
                        : 'admin.checkup.category_reassigned',
                    subject: $checkup,
                    riskLevel: 'critical',
                    before: $before,
                    after: $this->checkupAuditSnapshot($checkup),
                    batchId: $batchId,
                );
            }

            $before = $this->categoryAuditSnapshot($lockedCategory);
            $lockedCategory->delete();

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.checkup_category.archived',
                subject: $lockedCategory,
                riskLevel: 'critical',
                before: $before,
                after: array_merge($this->categoryAuditSnapshot($lockedCategory), [
                    'checkup_action' => $checkupAction,
                    'replacement_category_id' => $lockedReplacement?->id,
                    'affected_checkup_count' => $checkups->count(),
                ]),
                batchId: $batchId,
            );
        }, attempts: 3);

        return redirect()
            ->route('admin.checkup-categories.index')
            ->with('status', 'دسته بایگانی شد و تمام چکاپ‌ها و سوابق وابسته حفظ شدند.');
    }

    /**
     * @return array{0: string, 1: CheckupCategory|null}
     */
    private function validatedArchiveChoice(
        Request $request,
        CheckupCategory $category,
    ): array {
        $data = $request->validate([
            'checkup_action' => ['required', Rule::in(['detach', 'reassign'])],
            'replacement_category_id' => ['nullable', 'integer'],
        ]);

        if ($data['checkup_action'] === 'detach') {
            return ['detach', null];
        }

        $replacementId = $data['replacement_category_id'] ?? null;
        $replacementCategory = $replacementId
            ? CheckupCategory::query()
                ->whereKey($replacementId)
                ->whereKeyNot($category->getKey())
                ->first()
            : null;

        if (! $replacementCategory) {
            throw ValidationException::withMessages([
                'replacement_category_id' => 'یک دسته فعال و متفاوت برای انتقال چکاپ‌ها انتخاب کنید.',
            ]);
        }

        return ['reassign', $replacementCategory];
    }

    /**
     * @return array<string, mixed>
     */
    private function categoryAuditSnapshot(CheckupCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'deleted_at' => $category->deleted_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function checkupAuditSnapshot(Checkup $checkup): array
    {
        return [
            'id' => $checkup->id,
            'checkup_category_id' => $checkup->checkup_category_id,
            'title' => $checkup->title,
            'slug' => $checkup->slug,
            'price' => $checkup->price,
            'deleted_at' => $checkup->deleted_at?->toIso8601String(),
        ];
    }
}
