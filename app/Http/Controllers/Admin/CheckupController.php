<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCheckupRequest;
use App\Http\Requests\Admin\UpdateCheckupRequest;
use App\Models\Checkup;
use App\Models\CheckupCategory;

class CheckupController extends Controller
{
    public function index() {
        $items = Checkup::with('category')->orderBy('title')->paginate(20);
        return view('admin.checkups.index', compact('items'));
    }

    public function create() {
        $cats = CheckupCategory::orderBy('name')->get();
        return view('admin.checkups.create', compact('cats'));
    }

    public function store(StoreCheckupRequest $r) {
        Checkup::create($r->validated());
        return redirect()->route('admin.checkups.index')->with('status','چکاپ ایجاد شد.');
    }

    public function edit(Checkup $checkup) {
        $cats = CheckupCategory::orderBy('name')->get();
        return view('admin.checkups.edit', ['item'=>$checkup, 'cats'=>$cats]);
    }

    public function update(UpdateCheckupRequest $r, Checkup $checkup) {
        $checkup->update($r->validated());
        return redirect()->route('admin.checkups.index')->with('status','چکاپ به‌روزرسانی شد.');
    }

    public function destroy(Checkup $checkup) {
        $checkup->delete();
        return back()->with('status','چکاپ حذف شد.');
    }
}
