<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('questionnaire_submissions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('questionnaire_id')->constrained()->cascadeOnDelete();
            $table->string('questionnaire_title', 255);
            $table->string('questionnaire_slug', 255);

            // اگر لاگین بود
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('submitter_name', 255)->nullable();
            $table->string('submitter_phone', 30)->nullable();

            // اگر مهمان بود (اختیاری)
            $table->string('guest_token', 64)->nullable();
            $table->string('guest_phone', 30)->nullable();

            $table->json('answers_json');

            $table->integer('total_score')->default(0);
            $table->string('result_title', 255)->nullable(); // عنوان توصیه انتخاب‌شده
            $table->longText('result_body_html')->nullable(); // متن توصیه انتخاب‌شده (snapshot)
            $table->json('meta')->nullable(); // هرچی بعداً خواستی

            $table->timestamps();

            $table->index(['questionnaire_id', 'created_at'], 'qs_qid_created_idx');
            $table->index(['user_id', 'created_at'], 'qs_uid_created_idx');
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('questionnaire_submissions');
    }
};
