<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionnaireChoice extends Model
{
    protected $table = 'questionnaire_choices';
    protected $fillable = ['question_id','text','score','sort_order'];

    public function question() { return $this->belongsTo(QuestionnaireQuestion::class, 'question_id'); }
}
