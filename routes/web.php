<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Front\BookingController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/book', [BookingController::class,'chooseCheckup'])->name('book.choose-checkup');
    Route::get('/book/{checkup}/doctors', [BookingController::class,'chooseDoctor'])->name('book.choose-doctor');
    Route::get('/book/{checkup}/doctor/{doctor}', [BookingController::class,'pickTime'])->name('book.pick-time');
    Route::post('/book/{checkup}/doctor/{doctor}', [BookingController::class,'store'])->name('book.store');

    Route::get('/my/reservations', [BookingController::class,'myReservations'])->name('book.my');
});

require __DIR__.'/auth.php';

require __DIR__.'/admin.php';
require __DIR__.'/doctor.php';

Route::get('/debug/res-last', function(){
    return \App\Models\Reservation::with('user','doctor.user','checkup')->latest()->first();
});