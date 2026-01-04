<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionnaireSubmission extends Model
{
    protected $fillable = [
        'questionnaire_id',
        'questionnaire_title',
        'questionnaire_slug',
        'user_id',

        'submitter_name',
        'submitter_phone',

        'guest_token',
        'guest_phone',
        'answers_json',
        'total_score',
        'result_title',
        'result_body_html',
    ];



    protected $casts = [
        'answers_json' => 'array',
    ];
}
