<?php

namespace App\Models;

use App\Enums\ReservationReportStatus;
use DomainException;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationReport extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $attributes = [
        'status' => ReservationReportStatus::Draft->value,
    ];

    protected $fillable = [
        'body',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReservationReportStatus::class,
            'published_at' => 'datetime',
            'retention_until' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (ReservationReport $report): void {
            if ($report->status === ReservationReportStatus::Published && $report->published_at === null) {
                throw new DomainException('A published reservation report requires a publication timestamp.');
            }

            if ($report->status === ReservationReportStatus::Draft && $report->published_at !== null) {
                throw new DomainException('A draft reservation report cannot have a publication timestamp.');
            }

            if ($report->supersedes_report_id !== null) {
                $superseded = self::withTrashed()->find($report->supersedes_report_id);

                if (! $superseded || $superseded->status !== ReservationReportStatus::Published) {
                    throw new DomainException('A reservation report may supersede only a published report.');
                }
            }
        });

        static::updating(function (ReservationReport $report): void {
            if ($report->getRawOriginal('status') === ReservationReportStatus::Published->value) {
                throw new DomainException('Published reservation reports are immutable.');
            }
        });

        static::deleting(function (ReservationReport $report): void {
            if ($report->getRawOriginal('status') === ReservationReportStatus::Published->value) {
                throw new DomainException('Published reservation reports cannot be deleted.');
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

    public function medicalRequest()
    {
        return $this->belongsTo(ReservationMedicalRequest::class, 'medical_request_id');
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    public function supersedes()
    {
        return $this->belongsTo(self::class, 'supersedes_report_id');
    }

    public function amendments()
    {
        return $this->hasMany(self::class, 'supersedes_report_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by');
    }
}
