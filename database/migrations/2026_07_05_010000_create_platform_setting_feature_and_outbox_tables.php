<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('setting_definitions', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('key', 191)->unique();
            $table->string('group', 80)->index();
            $table->string('value_type', 30);
            $table->json('default_value')->nullable();
            $table->json('validation_rules')->nullable();
            $table->string('sensitivity', 30)->default('internal');
            $table->json('allowed_scopes');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('setting_values', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('setting_definition_id')->constrained()->restrictOnDelete();
            $table->string('scope_type', 30);
            $table->string('scope_key', 191);
            $table->json('value')->nullable();
            $table->string('secret_reference', 512)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['setting_definition_id', 'scope_type', 'scope_key'],
                'setting_value_scope_unique'
            );
        });

        Schema::create('features', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('key', 191)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('outbox_events', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->uuid('event_id')->unique();
            $table->string('event_type', 191)->index();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->ulid('subject_public_id')->nullable();
            $table->json('payload');
            $table->string('status', 30)->default('pending')->index();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('available_at')->index();
            $table->timestamp('dispatched_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outbox_events');
        Schema::dropIfExists('features');
        Schema::dropIfExists('setting_values');
        Schema::dropIfExists('setting_definitions');
    }
};
