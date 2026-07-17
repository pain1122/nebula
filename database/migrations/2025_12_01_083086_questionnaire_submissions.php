<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questionnaire_submissions', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('questionnaire_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('questionnaire_version')->default(1);
            $table->string('questionnaire_title', 255);
            $table->string('questionnaire_slug', 255);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('submitter_name', 255)->nullable();
            $table->string('submitter_phone', 30)->nullable();
            $table->string('guest_token_hash', 64)->nullable()->unique();
            $table->string('guest_phone', 30)->nullable();
            $table->json('answers_json');
            $table->integer('total_score')->default(0);
            $table->string('result_title', 255)->nullable();
            $table->longText('result_body_html')->nullable();
            $table->json('meta')->nullable();
            $table->string('data_classification', 30)->default('medical');
            $table->timestamp('retention_until')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['questionnaire_id', 'created_at'], 'qs_qid_created_idx');
            $table->index(['user_id', 'created_at'], 'qs_uid_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questionnaire_submissions');
    }
};
