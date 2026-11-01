<?php

use App\Enums\UserRole;
use App\Http\Controllers\Api\Admin\ActivityController;
use App\Http\Controllers\Api\Admin\CatalogMutationController;
use App\Http\Controllers\Api\Admin\CatalogReadController;
use App\Http\Controllers\Api\Admin\MedicalRequestController as AdminMedicalRequestController;
use App\Http\Controllers\Api\Admin\PaymentAdjustmentController;
use App\Http\Controllers\Api\Admin\PaymentReadController;
use App\Http\Controllers\Api\Admin\PlatformPrimitiveController;
use App\Http\Controllers\Api\Admin\QuestionnaireController;
use App\Http\Controllers\Api\Admin\QuestionnaireSubmissionController;
use App\Http\Controllers\Api\Admin\ReservationRatingOptionController as AdminReservationRatingOptionController;
use App\Http\Controllers\Api\Admin\ScheduleControlController;
use App\Http\Controllers\Api\Admin\ScheduleReadController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AdminReservationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingApiController;
use App\Http\Controllers\Api\DoctorMedicalRequestController;
use App\Http\Controllers\Api\DoctorProfileController;
use App\Http\Controllers\Api\DoctorReservationReportController;
use App\Http\Controllers\Api\LocalSandboxPaymentController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PanelProfileController;
use App\Http\Controllers\Api\PasswordConfirmationController;
use App\Http\Controllers\Api\PatientHealthController;
use App\Http\Controllers\Api\PatientMedicalFileController;
use App\Http\Controllers\Api\PatientMedicalOutcomeController;
use App\Http\Controllers\Api\PatientQuestionnaireSubmissionController;
use App\Http\Controllers\Api\PublicQuestionnaireController;
use App\Http\Controllers\Api\ReservationRatingOptionController;
use App\Http\Controllers\Api\TenantHeartbeatController;
use App\Http\Controllers\Api\UserProfileController;
use Illuminate\Support\Facades\Route;

Route::post('/tenant-heartbeats/{tenantInstance:public_id}', TenantHeartbeatController::class)
    ->middleware('throttle:30,1');

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
    Route::get('/my/health-profile', [PatientHealthController::class, 'show'])
        ->middleware(['role:'.UserRole::Patient->value.',sanctum', 'throttle:30,1']);
    Route::put('/my/health-profile', [PatientHealthController::class, 'update'])
        ->middleware(['role:'.UserRole::Patient->value.',sanctum', 'password.confirmed.recent', 'throttle:10,1']);
    Route::get('/my/questionnaire-submissions', [PatientQuestionnaireSubmissionController::class, 'index'])
        ->middleware('role:'.UserRole::Patient->value.',sanctum');
    Route::get('/my/questionnaire-submissions/{submissionId}', [PatientQuestionnaireSubmissionController::class, 'show'])
        ->whereUlid('submissionId')->middleware('role:'.UserRole::Patient->value.',sanctum');
    Route::get('/panel-profile', [PanelProfileController::class, 'showSelf']);
    Route::put('/panel-profile', [PanelProfileController::class, 'updateSelf'])->middleware('password.confirmed.recent');
    Route::get('/checkups', [BookingApiController::class, 'checkups']);
    Route::get('/checkups/{checkup}/doctors', [BookingApiController::class, 'doctorsForCheckup']);
    Route::get('/doctors/{doctor}/availability', [BookingApiController::class, 'availability']);
    Route::get('/reservation-rating-options', [ReservationRatingOptionController::class, 'index']);
    Route::get('/my/reservations', [BookingApiController::class, 'myReservations']);
    Route::post('/reservations/{reservation:public_id}/sandbox/checkout', [LocalSandboxPaymentController::class, 'start'])
        ->middleware(['role:'.UserRole::Patient->value.',sanctum', 'throttle:10,1']);
    Route::post('/reservations/{reservation:public_id}/sandbox/attempts/{attempt:public_id}/complete', [LocalSandboxPaymentController::class, 'complete'])
        ->middleware(['role:'.UserRole::Patient->value.',sanctum', 'throttle:10,1']);
    Route::post('/reservations', [BookingApiController::class, 'storeReservation'])
        ->middleware('throttle:reservation-holds');
    Route::post('/reservations/{reservation}/cancel', [BookingApiController::class, 'cancelReservation']);
    Route::post(
        '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/files',
        [PatientMedicalFileController::class, 'store']
    )->middleware('throttle:medical-uploads');
    Route::get(
        '/reservations/{reservation:public_id}/medical-requests',
        [PatientMedicalOutcomeController::class, 'index']
    );
    Route::get(
        '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/outcome',
        [PatientMedicalOutcomeController::class, 'show']
    );
    Route::get(
        '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/files/{file:public_id}/download',
        [PatientMedicalOutcomeController::class, 'download']
    );

});

Route::middleware([\App\Http\Middleware\ArticleReadPrivacy::class, 'auth:sanctum', 'account.active', 'role:'.UserRole::Patient->value.',sanctum'])
    ->prefix('my')->group(function () {
        $reader = \App\Http\Controllers\Api\PatientArticleController::class;
        Route::get('/articles', [$reader, 'index']);
        Route::get('/article-taxonomies', [$reader, 'taxonomies']);
        Route::get('/articles/{articleId}', [$reader, 'show'])->whereUlid('articleId');
        Route::get('/articles/{articleId}/media/{assetId}', [$reader, 'media'])->whereUlid(['articleId', 'assetId']);
    });

// Privacy wraps authorization refusals as well as source-gated content reads/writes.
Route::middleware([\App\Http\Middleware\ArticleReadPrivacy::class, 'auth:sanctum', 'account.active', 'role:'.UserRole::Admin->value.'|'.UserRole::RootAdmin->value.',sanctum'])
    ->prefix('admin')->group(function () {
        $controller = \App\Http\Controllers\Api\Admin\ArticleReadController::class;
        $media = \App\Http\Controllers\Api\Admin\ArticleMediaController::class;
        Route::get('/article-media', [$media, 'index']);
        Route::get('/article-media/upload-context', [$media, 'context']);
        Route::post('/article-media', [$media, 'upload'])->middleware('throttle:10,1');
        Route::get('/article-media/{assetId}', [$media, 'show'])->whereUlid('assetId');
        Route::get('/article-media/{assetId}/content', [$media, 'content'])->whereUlid('assetId');
        Route::post('/article-media/{assetId}/actions', [$media, 'action'])->whereUlid('assetId')->middleware('throttle:10,1');
        Route::get('/articles', [$controller, 'index']);
        $drafts = \App\Http\Controllers\Api\Admin\ArticleDraftWriteController::class;
        Route::get('/articles/write-context', [$drafts, 'context']);
        Route::get('/articles/{articleId}/write-context', [$drafts, 'context'])->whereUlid('articleId');
        Route::post('/articles', [$drafts, 'store']);
        Route::put('/articles/{articleId}', [$drafts, 'update'])->whereUlid('articleId');
        $editorial = \App\Http\Controllers\Api\Admin\ArticleEditorialController::class;
        Route::get('/articles/{articleId}/action-context', [$editorial, 'context'])->whereUlid('articleId');
        // The service retains recent-password checks for archive/recovery/review; Publish is a direct action.
        Route::post('/articles/{articleId}/actions', [$editorial, 'action'])->whereUlid('articleId');
        $schedules = \App\Http\Controllers\Api\Admin\ArticleScheduleController::class;
        Route::get('/articles/{articleId}/schedule-context', [$schedules, 'context'])->whereUlid('articleId');
        Route::post('/articles/{articleId}/schedule-actions', [$schedules, 'action'])->whereUlid('articleId')->middleware('password.confirmed.recent');
        Route::get('/articles/{articleId}/events', [$controller, 'events'])->whereUlid('articleId');
        Route::get('/articles/{articleId}', [$controller, 'show'])->whereUlid('articleId');
        Route::get('/articles/{articleId}/versions', [$controller, 'versions'])->whereUlid('articleId');
        Route::get('/articles/{articleId}/versions/{versionId}', [$controller, 'version'])->whereUlid(['articleId', 'versionId']);
        Route::get('/article-taxonomies', [$controller, 'terms']);
        $writer = \App\Http\Controllers\Api\Admin\ArticleTaxonomyWriteController::class;
        Route::get('/article-taxonomies/write-context', [$writer, 'context']);
        Route::get('/article-taxonomies/{termId}/write-context', [$writer, 'context'])->whereUlid('termId');
        Route::post('/article-taxonomies', [$writer, 'store'])->middleware('password.confirmed.recent');
        Route::put('/article-taxonomies/{termId}', [$writer, 'update'])->whereUlid('termId')->middleware('password.confirmed.recent');
        Route::post('/article-taxonomies/{termId}/actions', [$writer, 'action'])->whereUlid('termId')->middleware('password.confirmed.recent');
        Route::get('/article-taxonomies/{termId}', [$controller, 'term'])->whereUlid('termId');
        Route::get('/article-taxonomies/{termId}/versions', [$controller, 'termVersions'])->whereUlid('termId');
    });

Route::middleware(['auth:sanctum', 'account.active', 'role:'.UserRole::Admin->value.'|'.UserRole::RootAdmin->value.',sanctum'])
    ->prefix('admin')

    ->group(function () {
        Route::get('/dashboard', [\App\Http\Controllers\Api\Admin\DashboardReadController::class, 'index']);
        Route::get('/dashboard/appointments', [\App\Http\Controllers\Api\Admin\DashboardReadController::class, 'appointments']);
        Route::get('/doctors', [DoctorProfileController::class, 'index']);
        Route::put('/doctors/{doctorProfile}/verify', [DoctorProfileController::class, 'verify'])
            ->middleware('password.confirmed.recent');

        Route::get('/reservations', [AdminReservationController::class, 'index']);
        Route::get('/reservations/{reservation}', [AdminReservationController::class, 'show']);
        Route::get('/reservations/{reservation}/reschedule-slots', [AdminReservationController::class, 'rescheduleSlots']);
        Route::put('/reservations/{reservation}/status', [AdminReservationController::class, 'updateStatus'])
            ->middleware('password.confirmed.recent');
        Route::put('/reservations/{reservation}/schedule', [AdminReservationController::class, 'reschedule'])
            ->middleware('password.confirmed.recent');
        Route::post('/payments/{payment:public_id}/adjustments', [PaymentAdjustmentController::class, 'store'])
            ->middleware('password.confirmed.recent');
        Route::get('/payments/{payment:public_id}/adjustment-context', [PaymentAdjustmentController::class, 'context'])->middleware('throttle:30,1');
        Route::get('/payments', [PaymentReadController::class, 'index']);
        Route::get('/payments/{paymentPublicId}', [PaymentReadController::class, 'show']);
        Route::get('/payments/{paymentPublicId}/attempts', [PaymentReadController::class, 'attempts']);
        Route::get('/payments/{paymentPublicId}/adjustments', [PaymentReadController::class, 'adjustments']);
        Route::get('/payments/{paymentPublicId}/events', [PaymentReadController::class, 'events']);
        Route::get('/reservation-rating-options', [AdminReservationRatingOptionController::class, 'index']);
        Route::post('/reservation-rating-options', [AdminReservationRatingOptionController::class, 'store'])
            ->middleware('password.confirmed.recent');
        Route::get('/reservation-rating-options/{reservationRatingOption}', [AdminReservationRatingOptionController::class, 'show']);
        Route::put('/reservation-rating-options/{reservationRatingOption}', [AdminReservationRatingOptionController::class, 'update'])
            ->middleware('password.confirmed.recent');
        Route::delete('/reservation-rating-options/{reservationRatingOption}', [AdminReservationRatingOptionController::class, 'destroy'])
            ->middleware('password.confirmed.recent');

        Route::post('/users', [UserController::class, 'store'])
            ->middleware('password.confirmed.recent');
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/staff', [UserController::class, 'staff']);
        Route::get('/clinical-accounts/create-context', [\App\Http\Controllers\Api\Admin\ClinicalAccountController::class, 'context']);
        Route::post('/clinical-accounts', [\App\Http\Controllers\Api\Admin\ClinicalAccountController::class, 'store'])->middleware('password.confirmed.recent');
        Route::get('/hospitals', [\App\Http\Controllers\Api\Admin\HospitalController::class, 'index']);
        Route::get('/hospitals/create-context', [\App\Http\Controllers\Api\Admin\HospitalController::class, 'context']);
        Route::post('/hospitals', [\App\Http\Controllers\Api\Admin\HospitalController::class, 'store'])->middleware('password.confirmed.recent');
        Route::get('/hospitals/{hospital:public_id}', [\App\Http\Controllers\Api\Admin\HospitalController::class, 'show']);
        Route::put('/hospitals/{hospital:public_id}', [\App\Http\Controllers\Api\Admin\HospitalController::class, 'update'])->middleware('password.confirmed.recent');
        Route::get('/activity', [ActivityController::class, 'index']);
        Route::get('/schedules/workplaces', [ScheduleReadController::class, 'index']);
        Route::get('/schedules/workplaces/{workplaceId}', [ScheduleReadController::class, 'show'])->whereNumber('workplaceId');
        Route::get('/schedules/workplaces/{workplaceId}/rules', [ScheduleReadController::class, 'rules'])->whereNumber('workplaceId');
        Route::get('/schedules/workplaces/{workplaceId}/slots', [ScheduleReadController::class, 'slots'])->whereNumber('workplaceId');
        Route::get('/schedules/workplaces/{workplaceId}/slot-control', [ScheduleControlController::class, 'preview'])->whereNumber('workplaceId')->middleware('throttle:30,1');
        Route::put('/schedules/workplaces/{workplaceId}/slot-control', [ScheduleControlController::class, 'update'])->whereNumber('workplaceId')->middleware(['password.confirmed.recent', 'throttle:10,1']);
        Route::get('/checkups', [CatalogReadController::class, 'checkups']);
        Route::get('/catalog/{kind}/context/{catalogId?}', [CatalogMutationController::class, 'context'])->whereIn('kind', ['checkups', 'checkup-categories', 'specialties'])->whereNumber('catalogId');
        Route::post('/{kind}', [CatalogMutationController::class, 'store'])->whereIn('kind', ['checkups', 'checkup-categories', 'specialties'])->middleware('password.confirmed.recent');
        Route::put('/{kind}/{catalogId}', [CatalogMutationController::class, 'update'])->whereIn('kind', ['checkups', 'checkup-categories', 'specialties'])->whereNumber('catalogId')->middleware('password.confirmed.recent');
        Route::delete('/{kind}/{catalogId}', [CatalogMutationController::class, 'archive'])->whereIn('kind', ['checkups', 'checkup-categories', 'specialties'])->whereNumber('catalogId')->middleware('password.confirmed.recent');
        Route::get('/specialties', [CatalogReadController::class, 'specialties']);
        Route::get('/specialties/{specialtyId}', [CatalogReadController::class, 'specialty'])->whereNumber('specialtyId');
        Route::get('/checkups/{checkupId}', [CatalogReadController::class, 'checkup'])->whereNumber('checkupId');
        Route::get('/checkup-categories', [CatalogReadController::class, 'categories']);
        Route::get('/checkup-categories/{categoryId}', [CatalogReadController::class, 'category'])->whereNumber('categoryId');
        Route::get('/users/{user:public_id}/support-profile', [PanelProfileController::class, 'showSupport']);
        Route::put('/users/{user:public_id}/support-profile', [PanelProfileController::class, 'updateSupport'])
            ->middleware('password.confirmed.recent');
        Route::get('/users/{user}', [UserController::class, 'show']);
        Route::put('/users/{user}', [UserController::class, 'update'])
            ->middleware('password.confirmed.recent');
        Route::put('/users/{user}/account-state', [UserController::class, 'updateAccountState'])
            ->middleware('password.confirmed.recent');

        Route::get('/questionnaires', [QuestionnaireController::class, 'index']);
        Route::get('/medical-requests', [AdminMedicalRequestController::class, 'index']);
        Route::get('/medical-requests/{medicalRequest:public_id}', [AdminMedicalRequestController::class, 'show']);
        Route::get('/medical-requests/{medicalRequest:public_id}/files/{file:public_id}/download', [AdminMedicalRequestController::class, 'download']);
        Route::post('/medical-requests', [AdminMedicalRequestController::class, 'store'])->middleware('password.confirmed.recent');
        Route::post('/medical-requests/{medicalRequest:public_id}/review', [AdminMedicalRequestController::class, 'review'])->middleware('password.confirmed.recent');
        Route::post('/medical-requests/{medicalRequest:public_id}/reports', [AdminMedicalRequestController::class, 'draft'])->middleware('password.confirmed.recent');
        Route::post('/medical-requests/{medicalRequest:public_id}/reports/{report:public_id}/publish', [AdminMedicalRequestController::class, 'publish'])->middleware('password.confirmed.recent');
        Route::get('/questionnaire-submissions/by-public-id/{submission:public_id}', [QuestionnaireSubmissionController::class, 'show']);
        Route::delete('/questionnaire-submissions/by-public-id/{submission:public_id}', [QuestionnaireSubmissionController::class, 'destroy'])->middleware('password.confirmed.recent');
        Route::get('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'show']);
        Route::post('/questionnaires', [QuestionnaireController::class, 'store'])
            ->middleware('password.confirmed.recent');
        Route::put('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'update'])
            ->middleware('password.confirmed.recent');
        Route::delete('/questionnaires/{questionnaire}', [QuestionnaireController::class, 'destroy'])
            ->middleware('password.confirmed.recent');
        Route::get('/questionnaire-submissions', [QuestionnaireSubmissionController::class, 'index']);
        Route::get('/questionnaire-submissions/{submission}', [QuestionnaireSubmissionController::class, 'show']);
        Route::delete('/questionnaire-submissions/{submission}', [QuestionnaireSubmissionController::class, 'destroy'])
            ->middleware('password.confirmed.recent');
        Route::put('/tenant-instances/{tenantInstance:public_id}', [PlatformPrimitiveController::class, 'updateTenant'])
            ->middleware('password.confirmed.recent');
        Route::put('/tenant-instances/{tenantInstance:public_id}/features/{feature:key}', [PlatformPrimitiveController::class, 'setFeature'])
            ->middleware('password.confirmed.recent')
            ->withoutScopedBindings();
        Route::get('/settings/general', [\App\Http\Controllers\Api\Admin\GeneralSettingsReadController::class, 'index'])
            ->middleware('throttle:30,1');
        Route::get('/settings/{settingKey}', [PlatformPrimitiveController::class, 'showUploadSetting'])
            ->where('settingKey', '[A-Za-z0-9._-]+');
        Route::put('/settings/{settingKey}', [PlatformPrimitiveController::class, 'updateSetting'])
            ->where('settingKey', '[A-Za-z0-9._-]+')
            ->middleware('password.confirmed.recent');
    });

Route::middleware(['auth:sanctum', 'account.active', 'role:'.UserRole::Doctor->value.',sanctum'])
    ->prefix('doctor')
    ->group(function () {
        Route::get('/dashboard/appointments', \App\Http\Controllers\Api\DoctorAppointmentCalendarController::class);
        Route::get('/profile', [DoctorProfileController::class, 'show']);
        Route::put('/profile', [\App\Http\Controllers\Api\DoctorPracticeController::class, 'update'])->middleware('password.confirmed.recent');
        Route::get('/practice', [\App\Http\Controllers\Api\DoctorPracticeController::class, 'show']);
        Route::get('/location-options', [\App\Http\Controllers\Api\DoctorLocationController::class, 'options']);
        Route::post('/locations', [\App\Http\Controllers\Api\DoctorLocationController::class, 'store'])->middleware('password.confirmed.recent');
        Route::put('/locations/{workplace}/services', [\App\Http\Controllers\Api\DoctorLocationController::class, 'prices'])->whereNumber('workplace')->middleware('password.confirmed.recent');
        Route::put('/practice', [\App\Http\Controllers\Api\DoctorPracticeController::class, 'update'])->middleware('password.confirmed.recent');
        Route::patch('/visit-slots/{doctorVisitSlot}', [DoctorProfileController::class, 'controlVisitSlot']);
        Route::patch('/workplaces/{doctorWorkplace}/visit-slots', [DoctorProfileController::class, 'controlVisitSlotRange']);

        Route::get('/reservations', [BookingApiController::class, 'doctorReservations']);
        Route::get('/reservations/{reservation}', [BookingApiController::class, 'doctorReservationShow']);
        Route::put('/reservations/{reservation}/schedule', [BookingApiController::class, 'doctorRescheduleReservation']);
        Route::post('/reservations/{reservation}/complete', [BookingApiController::class, 'doctorCompleteReservation']);
        Route::post('/reservations/{reservation:public_id}/medical-requests', [DoctorMedicalRequestController::class, 'store']);
        Route::get('/reservations/{reservation:public_id}/attachment-options', [DoctorMedicalRequestController::class, 'attachmentOptions']);
        Route::get('/reservations/{reservation:public_id}/medical-requests', [DoctorMedicalRequestController::class, 'index']);
        Route::get(
            '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}',
            [DoctorMedicalRequestController::class, 'show']
        );
        Route::post(
            '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/review',
            [DoctorMedicalRequestController::class, 'review']
        );
        Route::get(
            '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/files/{file:public_id}/download',
            [DoctorMedicalRequestController::class, 'download']
        );
        Route::post(
            '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/reports',
            [DoctorReservationReportController::class, 'store']
        );
        Route::put(
            '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/reports/{report:public_id}',
            [DoctorReservationReportController::class, 'update']
        );
        Route::post(
            '/reservations/{reservation:public_id}/medical-requests/{medicalRequest:public_id}/reports/{report:public_id}/publish',
            [DoctorReservationReportController::class, 'publish']
        );

    });

// public routes
Route::get('/questionnaires', [PublicQuestionnaireController::class, 'index']);
Route::get('/questionnaires/{slug}', [PublicQuestionnaireController::class, 'show']);
Route::post('/questionnaires/{slug}/submit', [PublicQuestionnaireController::class, 'submit'])
    ->middleware('throttle:questionnaire-submissions');
