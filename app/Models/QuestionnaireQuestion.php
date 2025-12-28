<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionnaireQuestion extends Model
{
    protected $table = 'questionnaire_questions';
    protected $fillable = ['questionnaire_id','text','sort_order'];

    public function questionnaire() { return $this->belongsTo(Questionnaire::class); }
    public function choices() { return $this->hasMany(QuestionnaireChoice::class, 'question_id'); }
}
