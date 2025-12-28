<?php


namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use App\Models\Checkup;
use Illuminate\Http\Request;

class ServicesController extends Controller
{
    public function edit()
    {
        $profile = auth()->user()->doctorProfile;
        $checkups = Checkup::with('category')->orderBy('title')->get();
        return view('doctor.services.edit', compact('profile','checkups'));
    }

    public function update(Request $r)
    {
        $ids = collect($r->input('checkups', []))->map(fn($i)=>(int)$i)->all();
        auth()->user()->doctorProfile->checkups()->sync($ids);
        return back()->with('status','سرویس‌ها به‌روزرسانی شد.');
    }
}
