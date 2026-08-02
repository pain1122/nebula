<?php

use App\Enums\UserRole;
use App\Http\Controllers\Admin\CheckupCategoryController;
use App\Http\Controllers\Admin\CheckupController;
use App\Http\Controllers\Admin\DashboardController as AdminDashboard;
use App\Http\Controllers\Admin\SpecialtyController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'account.active', 'verified', 'role:'.UserRole::Admin->value.'|'.UserRole::RootAdmin->value])
    ->prefix('admin')->name('admin.')
    ->group(function () {
        Route::get('/', [AdminDashboard::class, '__invoke'])->name('dashboard');
        Route::resource('specialties', SpecialtyController::class)->except('show');
        Route::resource('checkup-categories', CheckupCategoryController::class)->except(['show', 'destroy']);
        Route::get('checkup-categories/{checkup_category}/archive', [CheckupCategoryController::class, 'confirmArchive'])
            ->middleware('password.confirmed.recent:admin.checkup-categories.archive-confirm')
            ->name('checkup-categories.archive-confirm');
        Route::delete('checkup-categories/{checkup_category}', [CheckupCategoryController::class, 'archive'])
            ->middleware('password.confirmed.recent:admin.checkup-categories.archive-confirm')
            ->name('checkup-categories.destroy');

        Route::resource('checkups', CheckupController::class)->except(['show', 'destroy', 'update']);
        Route::match(['put', 'patch'], 'checkups/{checkup}', [CheckupController::class, 'update'])
            ->middleware('password.confirmed.recent:admin.checkups.edit')
            ->name('checkups.update');
        Route::get('checkups/{checkup}/archive', [CheckupController::class, 'confirmArchive'])
            ->middleware('password.confirmed.recent:admin.checkups.archive-confirm')
            ->name('checkups.archive-confirm');
        Route::delete('checkups/{checkup}', [CheckupController::class, 'archive'])
            ->middleware('password.confirmed.recent:admin.checkups.archive-confirm')
            ->name('checkups.destroy');
    });
