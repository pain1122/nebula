<?php

namespace App\Models;

use App\Enums\ReservationFileScanStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationFile extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'original_filename',
        'safe_filename',
        'label',
        'mime_type',
        'extension',
        'size_bytes',
        'checksum_sha256',
    ];

    protected $hidden = ['disk', 'path'];

    protected function casts(): array
    {
        return [
            'scan_status' => ReservationFileScanStatus::class,
            'scanned_at' => 'datetime',
            'retention_until' => 'datetime',
        ];
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

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopeAvailableForMedicalReview($query)
    {
        return $query
            ->where('disk', 'private')
            ->where('scan_status', ReservationFileScanStatus::Clean->value)
            ->where(function ($retention): void {
                $retention
                    ->whereNull('retention_until')
                    ->orWhere('retention_until', '>', now());
            });
    }
}
