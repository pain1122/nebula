<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReservationNote extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'reservation_id',
        'user_id',
        'author_name_snapshot',
        'type',
        'visibility',
        'body',
    ];

    public function uniqueIds(): array { return ['public_id']; }

    public function reservation() { return $this->belongsTo(Reservation::class); }
    public function author() { return $this->belongsTo(User::class, 'user_id'); }
}
