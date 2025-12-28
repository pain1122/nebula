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
        $data = $req->validated();
        $data['slug'] = $data['slug'] ?: Str::slug($data['name']);
        $data['level'] = $data['parent_id'] ? (optional(Specialty::find($data['parent_id']))->level + 1) : 0;
        Specialty::create($data);
        return redirect()->route('admin.specialties.index')->with('status','تخصص ایجاد شد.');
    }

    public function edit(Specialty $specialty)
    {
        $parents = Specialty::where('id','!=',$specialty->id)->orderBy('name')->get();
        return view('admin.specialties.edit', ['item'=>$specialty, 'parents'=>$parents]);
    }

    public function update(UpdateSpecialtyRequest $req, Specialty $specialty)
    {
        $data = $req->validated();
        $data['slug'] = $data['slug'] ?: $specialty->slug;
        $data['level'] = $data['parent_id'] ? (optional(Specialty::find($data['parent_id']))->level + 1) : 0;
        $specialty->update($data);
        return redirect()->route('admin.specialties.index')->with('status','تخصص به‌روزرسانی شد.');
    }

    public function destroy(Specialty $specialty)
    {
        $specialty->delete();
        return back()->with('status','تخصص حذف شد.');
    }
}
