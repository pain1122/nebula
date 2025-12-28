<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('questionnaire_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('questionnaire_id')->constrained('questionnaires')->cascadeOnDelete();
            $table->integer('sort_order')->default(0);
            $table->text('text');
            $table->timestamps();

            $table->index(['questionnaire_id', 'sort_order']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('questionnaire_questions');
    }
};
