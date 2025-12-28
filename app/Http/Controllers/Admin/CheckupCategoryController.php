<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCheckupCategoryRequest;
use App\Http\Requests\Admin\UpdateCheckupCategoryRequest;
use App\Models\CheckupCategory;

class CheckupCategoryController extends Controller
{
    public function index() {
        $items = CheckupCategory::orderBy('name')->paginate(20);
        return view('admin.checkup_categories.index', compact('items'));
    }

    public function create() {
        return view('admin.checkup_categories.create');
    }

    public function store(StoreCheckupCategoryRequest $r) {
        CheckupCategory::create($r->validated());
        return redirect()->route('admin.checkup-categories.index')->with('status','دسته ایجاد شد.');
    }

    public function edit(CheckupCategory $checkup_category) {
        return view('admin.checkup_categories.edit', ['item'=>$checkup_category]);
    }

    public function update(UpdateCheckupCategoryRequest $r, CheckupCategory $checkup_category) {
        $checkup_category->update($r->validated());
        return redirect()->route('admin.checkup-categories.index')->with('status','دسته به‌روزرسانی شد.');
    }

    public function destroy(CheckupCategory $checkup_category) {
        $checkup_category->delete();
        return back()->with('status','دسته حذف شد.');
    }
}
