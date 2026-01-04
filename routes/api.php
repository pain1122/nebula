<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\DoctorProfileController;
use App\Http\Controllers\Api\BookingApiController;
use \App\Http\Controllers\Api\UserProfileController;
use \App\Http\Controllers\Api\AdminReservationController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\QuestionnaireController;
use App\Http\Controllers\Api\Admin\QuestionnaireSubmissionController;



use App\Http\Controllers\Api\PublicQuestionnaireController;



Route::prefix('auth')->group(function () {
    // ثبت‌نام
    Route::post('/register', [AuthController::class, 'registerPatient']);
    Route::post('/register/doctor', [AuthController::class, 'registerDoctor']);

    // لاگین
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    // رفرش توکن (فقط کاربر لاگین‌شده)
    Route::middleware('auth:sanctum')->post('/refresh', [AuthController::class, 'refresh']);

    // اطلاعات کاربر لاگین‌شده + لاگ‌اوت
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);

        // پروفایل کاربر (Patient)
        Route::get('/profile', [UserProfileController::class, 'show']);
        Route::put('/profile', [UserProfileController::class, 'update']);
    });
    Route::middleware('auth:sanctum')->get('/me', MeController::class);


});
// بقیه APIها (رزرو و...)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/checkups', [BookingApiController::class, 'checkups']);
    Route::get('/checkups/{checkup}/doctors', [BookingApiController::class, 'doctorsForCheckup']);
    Route::get('/doctors/{doctor}/availability', [BookingApiController::class, 'availability']);
    Route::get('/my/reservations', [BookingApiController::class, 'myReservations']);
    Route::post('/reservations', [BookingApiController::class, 'storeReservation']);
    Route::post('/reservations/{reservation}/cancel', [BookingApiController::class, 'cancelReservation']);

});

Route::middleware(['auth:sanctum', 'role:admin,sanctum'])
    ->prefix('admin')

    ->group(function () {
        Route::get('/doctors', [DoctorProfileController::class, 'index']);
        Route::put('/doctors/{doctorProfile}/verify', [DoctorProfileController::class, 'verify']);

        Route::get('/reservations', [AdminReservationController::class, 'index']);
        Route::get('/reservations/{reservation}', [AdminReservationController::class, 'show']);
        Route::put('/reservations/{reservation}/status', [AdminReservationController::class, 'updateStatus']);

        Route::post('/users', [UserController::class, 'store']);
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::put('/users/{user}', [UserController::class, 'update']);

        Route::get('/questionnaires', [QuestionnaireController::class, 'index']);
        Route::get('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'show']);
        Route::post('/questionnaires', [QuestionnaireController::class, 'store']);
        Route::put('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'update']);
        Route::delete('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'destroy']);
        Route::get('/questionnaire-submissions', [QuestionnaireSubmissionController::class, 'index']);
        Route::get('/questionnaire-submissions/{submission}', [QuestionnaireSubmissionController::class, 'show']);
        Route::delete('/questionnaire-submissions/{submission}', [QuestionnaireSubmissionController::class, 'destroy']);
    });


Route::middleware(['auth:sanctum', 'role:doctor'])
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
