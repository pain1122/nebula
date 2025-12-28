<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('questionnaire_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('questionnaire_id')->constrained('questionnaires')->cascadeOnDelete();

            $table->integer('min_score');
            $table->integer('max_score');
            $table->string('title', 255);
            $table->longText('body_html')->nullable();

            // برای فازهای بعد: شرط‌های سن/جنسیت/...
            $table->json('conditions')->nullable();

            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->index(['questionnaire_id', 'min_score', 'max_score'], 'qr_qid_score_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questionnaire_recommendations');
    }
};
