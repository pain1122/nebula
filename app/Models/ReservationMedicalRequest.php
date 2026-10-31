<?php

namespace App\Models;

use App\Enums\ReservationMedicalRequestStatus;
use App\Services\MedicalAttachmentPolicy;
use DomainException;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationMedicalRequest extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'status' => ReservationMedicalRequestStatus::Open->value,
    ];

    protected $fillable = [
        'request_type',
        'title',
        'instructions',
        'due_at',
    ];

    protected function casts(): array
    {
        return [
            'attachment_policy' => 'array',
            'status' => ReservationMedicalRequestStatus::class,
            'due_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'closed_at' => 'datetime',
            'retention_until' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (ReservationMedicalRequest $request): void {
            if ($request->exists && ($request->isDirty('attachment_policy') || $request->isDirty('attachment_policy_revision'))) {
                throw new DomainException('Issued medical attachment policies are immutable.');
            }
            if (! $request->exists && ($request->attachment_policy !== null || $request->attachment_policy_revision !== null)) {
                MedicalAttachmentPolicy::validateSnapshot($request->attachment_policy, $request->attachment_policy_revision);
            }
            $validTimestamps = match ($request->status) {
                ReservationMedicalRequestStatus::Open => $request->reviewed_at === null
                    && $request->closed_at === null,
                ReservationMedicalRequestStatus::InReview => $request->reviewed_at !== null
                    && $request->closed_at === null,
                ReservationMedicalRequestStatus::Completed => $request->reviewed_at !== null
                    && $request->closed_at !== null,
                ReservationMedicalRequestStatus::Cancelled => $request->closed_at !== null,
            };

            if (! $validTimestamps) {
                throw new DomainException('Medical request state and lifecycle timestamps are inconsistent.');
            }
        });
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function reservation()
    {
        return $this->belongsTo(Reservation::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function files()
    {
        return $this->hasMany(ReservationFile::class, 'medical_request_id');
    }

    public function reports()
    {
        return $this->hasMany(ReservationReport::class, 'medical_request_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by');
    }
}
