<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCheckupRequest;
use App\Http\Requests\Admin\UpdateCheckupRequest;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class CheckupController extends Controller
{
    public function index(): View
    {
        $items = Checkup::with('category')->orderBy('title')->paginate(20);

        return view('admin.checkups.index', compact('items'));
    }

    public function create(): View
    {
        $cats = CheckupCategory::orderBy('name')->get();

        return view('admin.checkups.create', compact('cats'));
    }

    public function store(StoreCheckupRequest $request): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($data): void {
            $category = CheckupCategory::query()
                ->whereKey($data['checkup_category_id'])
                ->lockForUpdate()
                ->first();

            if (! $category) {
                throw ValidationException::withMessages([
                    'checkup_category_id' => 'دسته انتخاب‌شده دیگر فعال نیست.',
                ]);
            }

            Checkup::create($data);
        }, attempts: 3);

        return redirect()->route('admin.checkups.index')->with('status', 'چکاپ ایجاد شد.');
    }

    public function edit(Checkup $checkup): View
    {
        $cats = CheckupCategory::orderBy('name')->get();

        return view('admin.checkups.edit', ['item' => $checkup, 'cats' => $cats]);
    }

    public function update(UpdateCheckupRequest $request, Checkup $checkup): RedirectResponse
    {
        $data = $request->validated();
        $originalCategoryId = $checkup->checkup_category_id;
        $requestedCategoryId = $data['checkup_category_id'] ?? null;

        DB::transaction(function () use (
            $checkup,
            $data,
            $originalCategoryId,
            $requestedCategoryId,
        ): void {
            $categoryIds = collect([$originalCategoryId, $requestedCategoryId])
                ->filter(fn ($id) => ! is_null($id))
                ->unique()
                ->sort()
                ->values();

            $lockedCategories = CheckupCategory::withTrashed()
                ->whereIn('id', $categoryIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $requestedCategory = $requestedCategoryId
                ? $lockedCategories->get($requestedCategoryId)
                : null;

            if ($requestedCategoryId && (! $requestedCategory || $requestedCategory->trashed())) {
                throw ValidationException::withMessages([
                    'checkup_category_id' => 'دسته انتخاب‌شده دیگر فعال نیست.',
                ]);
            }

            $lockedCheckup = Checkup::query()
                ->whereKey($checkup->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedCheckup->checkup_category_id !== $originalCategoryId) {
                throw ValidationException::withMessages([
                    'checkup_category_id' => 'دسته چکاپ هم‌زمان تغییر کرده است. صفحه را تازه‌سازی و دوباره تلاش کنید.',
                ]);
            }

            $lockedCheckup->update($data);
        }, attempts: 3);

        return redirect()->route('admin.checkups.index')->with('status', 'چکاپ به‌روزرسانی شد.');
    }

    public function confirmArchive(Checkup $checkup): View
    {
        Gate::authorize('archive', $checkup);

        return view('admin.catalog.confirm-archive', [
            'title' => 'بایگانی چکاپ',
            'itemLabel' => $checkup->title,
            'warning' => 'چکاپ از فهرست‌های فعال حذف می‌شود، اما رزروها، پرداخت‌ها و اتصال پزشکان آن حفظ خواهند شد.',
            'action' => route('admin.checkups.destroy', $checkup),
            'cancelUrl' => route('admin.checkups.index'),
            'actionData' => [],
        ]);
    }

    public function archive(Request $request, Checkup $checkup, AuditLogger $auditLogger): RedirectResponse
    {
        Gate::authorize('archive', $checkup);

        DB::transaction(function () use ($request, $checkup, $auditLogger): void {
            $lockedCheckup = Checkup::query()
                ->whereKey($checkup->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $before = $this->auditSnapshot($lockedCheckup);
            $lockedCheckup->delete();

            $auditLogger->log(
                request: $request,
                actor: $request->user(),
                action: 'admin.checkup.archived',
                subject: $lockedCheckup,
                riskLevel: 'critical',
                before: $before,
                after: $this->auditSnapshot($lockedCheckup),
            );
        });

        return redirect()
            ->route('admin.checkups.index')
            ->with('status', 'چکاپ بایگانی شد و سوابق رزرو و پرداخت آن حفظ شدند.');
    }

    /**
     * @return array<string, mixed>
     */
    private function auditSnapshot(Checkup $checkup): array
    {
        return [
            'id' => $checkup->id,
            'checkup_category_id' => $checkup->checkup_category_id,
            'title' => $checkup->title,
            'slug' => $checkup->slug,
            'description' => $checkup->description,
            'price' => $checkup->price,
            'deleted_at' => $checkup->deleted_at?->toIso8601String(),
        ];
    }
}
