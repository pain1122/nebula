<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Doctor\DashboardController as DoctorDashboard;
use App\Http\Controllers\Doctor\ProfileController;
use App\Http\Controllers\Doctor\ServicesController;

Route::middleware(['auth', 'verified', 'role:doctor'])
    ->prefix('doctor')->name('doctor.')
    ->group(function () {
        Route::get('/', [DoctorDashboard::class, '__invoke'])->name('dashboard');
        Route::get('/profile/edit', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::get('/services', [ServicesController::class, 'edit'])->name('services.edit');
        Route::put('/services', [ServicesController::class, 'update'])->name('services.update');
    });
