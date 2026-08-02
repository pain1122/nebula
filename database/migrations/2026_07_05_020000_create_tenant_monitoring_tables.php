<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_instances', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('marketplace_hospital_id')->nullable()->constrained('marketplace_hospitals')->nullOnDelete();
            $table->string('display_name');
            $table->string('domain', 191)->unique();
            $table->string('state', 30)->default('active')->index();
            $table->string('plan_key', 100)->nullable()->index();
            $table->string('subscription_status', 30)->nullable()->index();
            $table->string('feature_set_version', 100)->nullable();
            $table->string('application_version', 100)->nullable();
            $table->string('schema_version', 100)->nullable();
            $table->string('machine_secret_reference', 512)->nullable();
            $table->timestamp('last_heartbeat_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('tenant_feature_overrides', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('tenant_instance_id')->constrained()->restrictOnDelete();
            $table->foreignId('feature_id')->constrained()->restrictOnDelete();
            $table->boolean('enabled');
            $table->text('reason');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['tenant_instance_id', 'feature_id'], 'tenant_feature_override_unique');
        });

        Schema::create('tenant_health_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('tenant_instance_id')->constrained()->restrictOnDelete();
            $table->ulid('heartbeat_nonce')->unique();
            $table->string('health_status', 30)->index();
            $table->json('component_statuses')->nullable();
            $table->json('error_fingerprints')->nullable();
            $table->json('aggregate_counters')->nullable();
            $table->timestamp('observed_at')->index();
            $table->timestamps();

            $table->index(['tenant_instance_id', 'observed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_health_snapshots');
        Schema::dropIfExists('tenant_feature_overrides');
        Schema::dropIfExists('tenant_instances');
    }
};
