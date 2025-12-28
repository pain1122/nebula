<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReservationFile extends Model
{
    protected $fillable = ['reservation_id','path','label'];

    public function reservation() { return $this->belongsTo(Reservation::class); }
}
