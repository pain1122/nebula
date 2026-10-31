<?php

use App\Jobs\ExpireOverdueReservationHolds;
use App\Jobs\MaterializeDoctorVisitSlots;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new ExpireOverdueReservationHolds)
    ->everyMinute()
    ->withoutOverlapping();

Schedule::job(new MaterializeDoctorVisitSlots)
    ->dailyAt('00:05')
    ->withoutOverlapping();
