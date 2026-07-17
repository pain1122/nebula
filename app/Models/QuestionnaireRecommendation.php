<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuestionnaireRecommendation extends Model
{
    use HasFactory, HasUlids;

    protected $table = 'questionnaire_recommendations';
    protected $fillable = ['questionnaire_id','min_score','max_score','title','body_html','priority','conditions'];
    protected $casts = ['conditions' => 'array'];

    public function uniqueIds(): array { return ['public_id']; }

    public function questionnaire() { return $this->belongsTo(Questionnaire::class); }
}
