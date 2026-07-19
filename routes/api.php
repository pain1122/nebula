<?php

use App\Enums\UserRole;
use App\Http\Controllers\Api\Admin\QuestionnaireController;
use App\Http\Controllers\Api\Admin\QuestionnaireSubmissionController;
use App\Http\Controllers\Api\Admin\ReservationRatingOptionController as AdminReservationRatingOptionController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AdminReservationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingApiController;
use App\Http\Controllers\Api\DoctorProfileController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PasswordConfirmationController;
use App\Http\Controllers\Api\PublicQuestionnaireController;
use App\Http\Controllers\Api\ReservationRatingOptionController;
use App\Http\Controllers\Api\UserProfileController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    // ثبت‌نام
    Route::post('/register', [AuthController::class, 'registerPatient']);
    Route::post('/register/doctor', [AuthController::class, 'registerDoctor']);

    // لاگین
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    // رفرش توکن (فقط کاربر لاگین‌شده)
    Route::middleware(['auth:sanctum', 'account.active'])->post('/refresh', [AuthController::class, 'refresh']);

    // اطلاعات کاربر لاگین‌شده + لاگ‌اوت
    Route::middleware(['auth:sanctum', 'account.active'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/confirm-password', [PasswordConfirmationController::class, 'store']);

        // پروفایل کاربر (Patient)
        Route::get('/profile', [UserProfileController::class, 'show']);
        Route::put('/profile', [UserProfileController::class, 'update']);
    });
    Route::middleware(['auth:sanctum', 'account.active'])->get('/me', MeController::class);

});
// بقیه APIها (رزرو و...)
Route::middleware(['auth:sanctum', 'account.active'])->group(function () {
    Route::get('/checkups', [BookingApiController::class, 'checkups']);
    Route::get('/checkups/{checkup}/doctors', [BookingApiController::class, 'doctorsForCheckup']);
    Route::get('/doctors/{doctor}/availability', [BookingApiController::class, 'availability']);
    Route::get('/reservation-rating-options', [ReservationRatingOptionController::class, 'index']);
    Route::get('/my/reservations', [BookingApiController::class, 'myReservations']);
    Route::post('/reservations', [BookingApiController::class, 'storeReservation']);
    Route::post('/reservations/{reservation}/cancel', [BookingApiController::class, 'cancelReservation']);

});

Route::middleware(['auth:sanctum', 'account.active', 'role:'.UserRole::Admin->value.'|'.UserRole::RootAdmin->value.',sanctum'])
    ->prefix('admin')

    ->group(function () {
        Route::get('/doctors', [DoctorProfileController::class, 'index']);
        Route::put('/doctors/{doctorProfile}/verify', [DoctorProfileController::class, 'verify']);

        Route::get('/reservations', [AdminReservationController::class, 'index']);
        Route::get('/reservations/{reservation}', [AdminReservationController::class, 'show']);
        Route::put('/reservations/{reservation}/status', [AdminReservationController::class, 'updateStatus']);
        Route::get('/reservation-rating-options', [AdminReservationRatingOptionController::class, 'index']);
        Route::post('/reservation-rating-options', [AdminReservationRatingOptionController::class, 'store']);
        Route::get('/reservation-rating-options/{reservationRatingOption}', [AdminReservationRatingOptionController::class, 'show']);
        Route::put('/reservation-rating-options/{reservationRatingOption}', [AdminReservationRatingOptionController::class, 'update']);
        Route::delete('/reservation-rating-options/{reservationRatingOption}', [AdminReservationRatingOptionController::class, 'destroy']);

        Route::post('/users', [UserController::class, 'store'])
            ->middleware('password.confirmed.recent');
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::put('/users/{user}', [UserController::class, 'update'])
            ->middleware('password.confirmed.recent');
        Route::put('/users/{user}/account-state', [UserController::class, 'updateAccountState'])
            ->middleware('password.confirmed.recent');

        Route::get('/questionnaires', [QuestionnaireController::class, 'index']);
        Route::get('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'show']);
        Route::post('/questionnaires', [QuestionnaireController::class, 'store']);
        Route::put('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'update']);
        Route::delete('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'destroy']);
        Route::get('/questionnaire-submissions', [QuestionnaireSubmissionController::class, 'index']);
        Route::get('/questionnaire-submissions/{submission}', [QuestionnaireSubmissionController::class, 'show']);
        Route::delete('/questionnaire-submissions/{submission}', [QuestionnaireSubmissionController::class, 'destroy']);
    });

Route::middleware(['auth:sanctum', 'account.active', 'role:'.UserRole::Doctor->value.',sanctum'])
    ->prefix('doctor')
    ->group(function () {
        Route::get('/profile', [DoctorProfileController::class, 'show']);
        Route::put('/profile', [DoctorProfileController::class, 'update']);

        Route::get('/reservations', [BookingApiController::class, 'doctorReservations']);
        Route::get('/reservations/{reservation}', [BookingApiController::class, 'doctorReservationShow']);
        Route::post('/reservations/{reservation}/complete', [BookingApiController::class, 'doctorCompleteReservation']);

    });

// public routes
Route::get('/questionnaires', [PublicQuestionnaireController::class, 'index']);
Route::get('/questionnaires/{slug}', [PublicQuestionnaireController::class, 'show']);
Route::post('/questionnaires/{slug}/submit', [PublicQuestionnaireController::class, 'submit']);
