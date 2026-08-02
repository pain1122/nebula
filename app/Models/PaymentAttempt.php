<?php

namespace App\Models;

use App\Enums\PaymentAttemptStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentAttempt extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'payment_summary_id',
        'reservation_id',
        'provider',
        'provider_ref',
        'idempotency_key',
        'amount',
        'currency',
    ];

    protected $attributes = [
        'status' => PaymentAttemptStatus::Initiated->value,
    ];

    protected function casts(): array
    {
        return [
            'initiated_at' => 'datetime',
            'expires_at' => 'datetime',
            'completed_at' => 'datetime',
            'metadata' => 'array',
            'status' => PaymentAttemptStatus::class,
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }
}
