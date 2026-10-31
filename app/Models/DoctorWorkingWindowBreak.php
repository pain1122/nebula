<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DoctorWorkingWindowBreak extends Model
{
    protected $fillable = [
        'starts_at',
        'ends_at',
    ];

    public function workingWindow()
    {
        return $this->belongsTo(DoctorWorkingWindow::class, 'doctor_working_window_id');
    }
}
