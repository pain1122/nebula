<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
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
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function questionnaireSubmission(): BelongsTo
    {
        return $this->belongsTo(QuestionnaireSubmission::class);
    }

    public function convertedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'converted_user_id');
    }
}
