<?php

namespace App\Models;

use App\Enums\PaymentAdjustmentStatus;
use App\Enums\PaymentAdjustmentType;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class PaymentAdjustment extends Model
{
    use HasUlids;

    protected $guarded = [
        'id',
        'public_id',
        'payment_summary_id',
        'payment_attempt_id',
        'actor_id',
        'type',
        'amount',
        'currency',
        'status',
        'provider_ref',
    ];

    protected $attributes = [
        'status' => PaymentAdjustmentStatus::Pending->value,
    ];

    protected function casts(): array
    {
        return [
            'type' => PaymentAdjustmentType::class,
            'status' => PaymentAdjustmentStatus::class,
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class, 'payment_summary_id');
    }
}
