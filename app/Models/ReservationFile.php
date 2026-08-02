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
        'reservation_id',
        'uploaded_by',
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

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
