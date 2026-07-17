<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OutboxEvent extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = ['event_id', 'event_type', 'subject_type', 'subject_id', 'subject_public_id', 'payload', 'available_at'];
    protected $attributes = ['status' => 'pending', 'attempts' => 0];
    protected function casts(): array { return ['payload' => 'array', 'available_at' => 'datetime', 'dispatched_at' => 'datetime']; }
    public function uniqueIds(): array { return ['public_id']; }
}
