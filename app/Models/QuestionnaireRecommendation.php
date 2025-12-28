<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionnaireRecommendation extends Model
{
    protected $table = 'questionnaire_recommendations';
    protected $fillable = ['questionnaire_id','min_score','max_score','title','body_html','priority','conditions'];
    protected $casts = ['conditions' => 'array'];

    public function questionnaire() { return $this->belongsTo(Questionnaire::class); }
}
