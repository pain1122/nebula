<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\DashboardController as AdminDashboard;
use App\Http\Controllers\Admin\SpecialtyController;
use App\Http\Controllers\Admin\CheckupCategoryController;
use App\Http\Controllers\Admin\CheckupController;


Route::middleware(['auth','verified','role:admin'])
    ->prefix('admin')->name('admin.')
    ->group(function () {
        Route::get('/', [AdminDashboard::class,'__invoke'])->name('dashboard');
        Route::resource('specialties', SpecialtyController::class)->except('show');
        Route::resource('checkup-categories', CheckupCategoryController::class)->except('show');
        Route::resource('checkups', CheckupController::class)->except('show');
    });
