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
            $table->unique(['setting_definition_id', 'scope_type', 'scope_key'], 'tenant_setting_scope_unique');
        });

        Schema::create('feature_entitlements', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('feature_key', 191)->unique();
            $table->boolean('enabled');
            $table->string('entitlement_version', 100);
            $table->string('signature_algorithm', 30);
            $table->string('signing_key_id', 100);
            $table->text('signature');
            $table->timestamp('issued_at');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_entitlements');
        Schema::dropIfExists('setting_values');
        Schema::dropIfExists('setting_definitions');
    }
};
