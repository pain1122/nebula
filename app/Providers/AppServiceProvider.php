<?php

namespace App\Providers;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\Reservation;
use App\Policies\CheckupCategoryPolicy;
use App\Policies\CheckupPolicy;
use App\Policies\ReservationPolicy;
use Illuminate\Support\Facades\Gate;
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
        Schema::defaultStringLength(191);
    }
}
