<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditEvent extends Model
{
    use HasFactory, HasUlids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'batch_id',
        'actor_user_id',
        'actor_public_id',
        'actor_name_snapshot',
        'action',
        'subject_type',
        'subject_id',
        'subject_public_id',
        'risk_level',
        'reason',
        'outcome',
        'before',
        'after',
        'route',
        'correlation_id',
        'ip',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'before' => 'array',
            'after' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
