<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreSpecialtyRequest;
use App\Http\Requests\Admin\UpdateSpecialtyRequest;
use App\Models\Specialty;
use Illuminate\Support\Str;

class SpecialtyController extends Controller
{
    public function index()
    {
        $items = Specialty::with('parent')->orderBy('level')->orderBy('name')->paginate(20);

        return view('admin.specialties.index', compact('items'));
    }

    public function create()
    {
        $parents = Specialty::orderBy('name')->get();

        return view('admin.specialties.create', compact('parents'));
    }

    public function store(StoreSpecialtyRequest $req)
    {
        $req->merge(['slug' => $req->input('slug') ?: Str::slug($req->input('name'))]);
        app(\App\Services\CatalogAdministration::class)->mutate($req, 'specialties', null, 'create');

        return redirect()->route('admin.specialties.index')->with('status', 'تخصص ایجاد شد.');
    }

    public function edit(Specialty $specialty)
    {
        $parents = Specialty::where('id', '!=', $specialty->id)->orderBy('name')->get();

        return view('admin.specialties.edit', ['item' => $specialty, 'parents' => $parents]);
    }

    public function update(UpdateSpecialtyRequest $req, Specialty $specialty)
    {
        $req->merge(['slug' => $req->input('slug') ?: $specialty->slug]);
        app(\App\Services\CatalogAdministration::class)->mutate($req, 'specialties', $specialty->getKey(), 'update');

        return redirect()->route('admin.specialties.index')->with('status', 'تخصص به‌روزرسانی شد.');
    }

    public function destroy(Specialty $specialty)
    {
        app(\App\Services\CatalogAdministration::class)->mutate(request(), 'specialties', $specialty->getKey(), 'archive');

        return back()->with('status', 'تخصص حذف شد.');
    }
}
