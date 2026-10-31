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
use Illuminate\Support\Facades\Gate;
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
        app(\App\Services\CatalogAdministration::class)->mutate($request, 'checkup-categories', null, 'create');

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
        app(\App\Services\CatalogAdministration::class)->mutate($request, 'checkup-categories', $checkup_category->getKey(), 'update');

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
        app(\App\Services\CatalogAdministration::class)->mutate($request, 'checkup-categories', $checkup_category->getKey(), 'archive');

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
