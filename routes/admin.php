<?php


use App\Enums\UserRole;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\DashboardController as AdminDashboard;
use App\Http\Controllers\Admin\SpecialtyController;
use App\Http\Controllers\Admin\CheckupCategoryController;
use App\Http\Controllers\Admin\CheckupController;


Route::middleware(['auth', 'account.active', 'verified', 'role:' . UserRole::Admin->value .'|' . UserRole::RootAdmin->value])
    ->prefix('admin')->name('admin.')
    ->group(function () {
        Route::get('/', [AdminDashboard::class,'__invoke'])->name('dashboard');
        Route::resource('specialties', SpecialtyController::class)->except('show');
        Route::resource('checkup-categories', CheckupCategoryController::class)->except(['show', 'destroy']);
        Route::get('checkup-categories/{checkup_category}/archive', [CheckupCategoryController::class, 'confirmArchive'])
            ->middleware('password.confirmed.recent:admin.checkup-categories.archive-confirm')
            ->name('checkup-categories.archive-confirm');
        Route::delete('checkup-categories/{checkup_category}', [CheckupCategoryController::class, 'archive'])
            ->middleware('password.confirmed.recent:admin.checkup-categories.archive-confirm')
            ->name('checkup-categories.destroy');

        Route::resource('checkups', CheckupController::class)->except(['show', 'destroy']);
        Route::get('checkups/{checkup}/archive', [CheckupController::class, 'confirmArchive'])
            ->middleware('password.confirmed.recent:admin.checkups.archive-confirm')
            ->name('checkups.archive-confirm');
        Route::delete('checkups/{checkup}', [CheckupController::class, 'archive'])
            ->middleware('password.confirmed.recent:admin.checkups.archive-confirm')
            ->name('checkups.destroy');
    });
