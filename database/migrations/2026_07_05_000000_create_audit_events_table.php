<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->uuid('batch_id')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->ulid('actor_public_id')->nullable();
            $table->string('actor_name_snapshot')->nullable();
            $table->string('action', 120);
            $table->string('subject_type');
            $table->unsignedBigInteger('subject_id');
            $table->ulid('subject_public_id')->nullable();
            $table->string('risk_level', 30);
            $table->text('reason')->nullable();
            $table->string('outcome', 30)->default('succeeded');
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->string('route')->nullable();
            $table->uuid('correlation_id')->nullable()->index();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->nullable()->useCurrent();

            $table->index('batch_id');
            $table->index('actor_user_id');
            $table->index('action');
            $table->index('risk_level');
            $table->index('created_at');
            $table->index(['subject_type', 'subject_id']);
            $table->index(['subject_type', 'subject_public_id'], 'audit_subject_public_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};
