<?php

namespace App\Models;

use App\Enums\HospitalListingRequestStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HospitalListingRequest extends Model
{
    use HasFactory, HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => HospitalListingRequestStatus::Pending->value,
    ];

    protected $fillable = [
        'requesting_user_id',
        'proposed_name',
        'proposed_city',
        'proposed_address',
        'proposed_phone',
        'evidence_notes',
    ];

    protected function casts(): array
    {
        return [
            'status' => HospitalListingRequestStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }
}
