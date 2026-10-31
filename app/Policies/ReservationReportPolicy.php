<?php

namespace App\Policies;

use App\Enums\ReservationReportStatus;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Models\User;

class ReservationReportPolicy
{
    public function create(User $user, ReservationMedicalRequest $medicalRequest): bool
    {
        return $medicalRequest->reservation?->doctor?->user_id === $user->id;
    }

    public function update(User $user, ReservationReport $report): bool
    {
        return $report->status === ReservationReportStatus::Draft
            && $report->reservation?->doctor?->user_id === $user->id;
    }

    public function publish(User $user, ReservationReport $report): bool
    {
        return $report->reservation?->doctor?->user_id === $user->id;
    }

    public function view(User $user, ReservationReport $report): bool
    {
        if ($report->reservation?->doctor?->user_id === $user->id) {
            return true;
        }

        return $report->status === ReservationReportStatus::Published
            && $report->reservation?->user_id === $user->id;
    }
}
