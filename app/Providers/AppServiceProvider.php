<?php

namespace App\Providers;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\Reservation;
use App\Policies\CheckupCategoryPolicy;
use App\Policies\CheckupPolicy;
use App\Policies\ReservationPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
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
        Gate::policy(Checkup::class, CheckupPolicy::class);
        Gate::policy(CheckupCategory::class, CheckupCategoryPolicy::class);
        Gate::policy(Reservation::class, ReservationPolicy::class);
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
        Schema::defaultStringLength(191);
    }
}
