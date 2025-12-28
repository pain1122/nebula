<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReservationNote extends Model
{
    protected $fillable = ['reservation_id','user_id','body'];

    public function reservation() { return $this->belongsTo(Reservation::class); }
    public function author() { return $this->belongsTo(User::class, 'user_id'); }
}
