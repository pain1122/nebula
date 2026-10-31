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
use Illuminate\Support\Facades\Gate;
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

    public function store(StoreCheckupRequest $request, AuditLogger $auditLogger): RedirectResponse
    {
        app(\App\Services\CatalogAdministration::class)->mutate($request, 'checkups', null, 'create');

        return redirect()->route('admin.checkups.index')->with('status', 'چکاپ ایجاد شد.');
    }

    public function edit(Checkup $checkup): View
    {
        $cats = CheckupCategory::orderBy('name')->get();

        return view('admin.checkups.edit', ['item' => $checkup, 'cats' => $cats]);
    }

    public function update(UpdateCheckupRequest $request, Checkup $checkup, AuditLogger $auditLogger): RedirectResponse
    {
        app(\App\Services\CatalogAdministration::class)->mutate($request, 'checkups', $checkup->getKey(), 'update');

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
        app(\App\Services\CatalogAdministration::class)->mutate($request, 'checkups', $checkup->getKey(), 'archive');

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
            'currency' => $checkup->currency,
            'default_duration_minutes' => $checkup->default_duration_minutes,
            'deleted_at' => $checkup->deleted_at?->toIso8601String(),
        ];
    }
}
