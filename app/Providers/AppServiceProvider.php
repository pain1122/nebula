<?php

namespace App\Providers;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\Reservation;
use App\Policies\CheckupCategoryPolicy;
use App\Policies\CheckupPolicy;
use App\Policies\ReservationPolicy;
use App\Services\MedicalUploadAdmission;
use App\Support\MedicalStorageConfiguration;
use App\Support\PhoneNumberNormalizer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Storage::extend('medical-s3', function ($app, array $config) {
            MedicalStorageConfiguration::validate($config, $app->environment());

            if (! class_exists(\League\Flysystem\AwsS3V3\AwsS3V3Adapter::class)) {
                throw new \DomainException('Medical S3 requires the Laravel Flysystem S3 adapter.');
            }

            return $app['filesystem']->createS3Driver($config);
        });

        Gate::policy(Checkup::class, CheckupPolicy::class);
        Gate::policy(CheckupCategory::class, CheckupCategoryPolicy::class);
        Gate::policy(Reservation::class, ReservationPolicy::class);
        RateLimiter::for('medical-uploads', function (Request $request): array {
            try {
                $limits = MedicalUploadAdmission::limits();
            } catch (\DomainException) {
                throw new \Illuminate\Http\Exceptions\HttpResponseException(response()->json([
                    'success' => false,
                    'message' => 'Medical upload admission is unavailable.',
                    'code' => 'upload_unavailable',
                    'errors' => null,
                    'meta' => ['api_version' => '1', 'correlation_id' => $request->attributes->get('correlation_id')],
                ], 503));
            }

            return [
                Limit::perMinute($limits['requests_per_user_per_minute'])
                    ->by('medical-upload:user:'.hash('sha256', (string) $request->user()->getAuthIdentifier())),
                Limit::perMinute($limits['requests_per_ip_per_minute'])
                    ->by('medical-upload:ip:'.hash('sha256', $request->ip() ?? 'unknown')),
            ];
        });
        RateLimiter::for('reservation-holds', function (Request $request): array {
            $userKey = (string) ($request->user()?->getAuthIdentifier() ?? 'guest');
            $deviceId = trim((string) $request->header('X-Device-ID'));
            $deviceKey = $deviceId !== ''
                ? hash('sha256', $deviceId)
                : 'missing:'.($request->ip() ?? 'unknown');

            return [
                Limit::perMinute(max(1, (int) config('payments.hold_requests_per_minute_per_user', 10)))
                    ->by('reservation-hold:user:'.$userKey),
                Limit::perMinute(max(1, (int) config('payments.hold_requests_per_minute_per_device', 10)))
                    ->by('reservation-hold:device:'.$deviceKey),
                Limit::perMinute(max(1, (int) config('payments.hold_requests_per_minute_per_ip', 30)))
                    ->by('reservation-hold:ip:'.($request->ip() ?? 'unknown')),
            ];
        });
        RateLimiter::for('questionnaire-submissions', function (Request $request): array {
            $limits = [];
            $user = $request->user('sanctum');

            if ($user !== null) {
                $limits[] = Limit::perMinute(max(1, (int) config('questionnaires.submission_limits.per_user_per_minute', 10)))
                    ->by('questionnaire-submission:user:'.$user->getAuthIdentifier());
            }

            $normalizedPhone = app(PhoneNumberNormalizer::class)->normalize($request->input('submitter_phone'));

            if ($normalizedPhone !== '') {
                $limits[] = Limit::perMinute(max(1, (int) config('questionnaires.submission_limits.per_phone_per_minute', 5)))
                    ->by('questionnaire-submission:phone:'.hash('sha256', $normalizedPhone));
            }

            $limits[] = Limit::perMinute(max(1, (int) config('questionnaires.submission_limits.per_ip_per_minute', 30)))
                ->by('questionnaire-submission:ip:'.($request->ip() ?? 'unknown'));

            return $limits;
        });
        Schema::defaultStringLength(191);
    }
}
