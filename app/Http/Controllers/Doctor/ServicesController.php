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

        return view('doctor.services.edit', compact('profile', 'checkups'));
    }

    public function update(Request $request)
    {
        $ids = collect($request->input('checkups', []))
            ->map(fn ($id) => (int) $id)
            ->all();

        $profile = auth()->user()->doctorProfile;

        if (! $profile) {
            return back()->withErrors(['profile' => 'Doctor profile not found.']);
        }

        $profile->checkups()->sync($ids);

        return back()->with('status', 'Services updated successfully.');
    }
}
