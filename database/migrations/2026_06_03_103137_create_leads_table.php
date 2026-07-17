<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            
            $table->string('name')->nullable();
            $table->string('phone', 30)->index();
            $table->string('email')->nullable()->index();

            $table->string('source', 100)->default('manual')->index();
            $table->string('source_key', 150)->default('');
            $table->string('status', 30)->default('new')->index();
            $table->boolean('consent_granted')->default(false);
            $table->timestamp('consent_recorded_at')->nullable();
            $table->string('consent_source', 100)->nullable();
            $table->timestamp('retention_until')->nullable()->index();

            $table->foreignId('questionnaire_submission_id')
                ->nullable()
                ->constrained('questionnaire_submissions')
                ->nullOnDelete();

            $table->foreignId('converted_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(['phone','source','source_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
