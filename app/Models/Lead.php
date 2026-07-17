<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    use HasFactory, HasUlids;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'source',
        'source_key',
        'status',
        'questionnaire_submission_id',
        'converted_user_id',
        'meta',
        'consent_granted',
        'consent_recorded_at',
        'consent_source',
        'retention_until',
    ];

    protected $casts = [
        'meta' => 'array',
        'consent_granted' => 'boolean',
        'consent_recorded_at' => 'datetime',
        'retention_until' => 'datetime',
    ];

    public function uniqueIds(): array { return ['public_id']; }

    public function questionnaireSubmission(): BelongsTo
    {
        return $this->belongsTo(QuestionnaireSubmission::class);
    }

    public function convertedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'converted_user_id');
    }
}
