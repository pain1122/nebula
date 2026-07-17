<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class QuestionnaireSubmission extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    protected $fillable = [
        'questionnaire_id',
        'questionnaire_title',
        'questionnaire_slug',
        'user_id',

        'submitter_name',
        'submitter_phone',

        'guest_token_hash',
        'guest_phone',
        'answers_json',
        'total_score',
        'result_title',
        'result_body_html',
    ];

    protected $hidden = [
        'guest_token_hash',
    ];



    protected $casts = [
        'answers_json' => 'array',
        'meta' => 'array',
        'retention_until' => 'datetime',
    ];

    public function uniqueIds(): array
    {
        return ['public_id'];
    }
}
