<?php

namespace App\Models;

use App\Enums\PaymentSummaryStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory, HasUlids;

    protected $table = 'reservation_payment_summaries';

    protected $attributes = [
        'status' => PaymentSummaryStatus::Unpaid->value,
    ];

    protected $fillable = [
        'reservation_id',
        'provider',
        'provider_ref',
        'amount',
        'currency',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'refunded_at' => 'datetime',
            'status' => PaymentSummaryStatus::class,
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

    public function attempts()
    {
        return $this->hasMany(PaymentAttempt::class, 'payment_summary_id');
    }

    public function adjustments()
    {
        return $this->hasMany(PaymentAdjustment::class, 'payment_summary_id');
    }
}
