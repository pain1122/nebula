<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('questionnaire_choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained('questionnaire_questions')->cascadeOnDelete();
            $table->integer('sort_order')->default(0);
            $table->text('text');
            $table->integer('score')->default(0);
            $table->timestamps();

            $table->index(['question_id', 'sort_order']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('questionnaire_choices');
    }
};
