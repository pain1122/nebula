<?php 

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Questionnaire extends Model
{
    protected $fillable = ['title','slug','status','cover_image_url','content_html'];

    public function questions() { return $this->hasMany(QuestionnaireQuestion::class); }
    public function recommendations() { return $this->hasMany(QuestionnaireRecommendation::class); }
}
