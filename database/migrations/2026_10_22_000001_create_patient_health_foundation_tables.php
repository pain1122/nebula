<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_biometric_observations', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('metric', 16);
            $table->string('source', 24);
            $table->unsignedSmallInteger('schema_version');
            $table->text('payload');
            $table->foreignId('corrects_id')->nullable()->constrained('patient_biometric_observations')->restrictOnDelete();
            $table->timestamp('recorded_at');
            $table->index(['patient_id', 'metric', 'id'], 'patient_biometric_history');
        });
        Schema::create('patient_health_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('patient_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->unsignedSmallInteger('schema_version');
            $table->string('catalog_version', 64);
            $table->text('payload');
            $table->timestamp('recorded_at');
            $table->unique(['patient_id', 'version']);
        });
    }

    public function down(): void
    {
        // Check both before dropping either: application rollback must retain all history.
        foreach (['patient_health_snapshots', 'patient_biometric_observations'] as $table) {
            if (Schema::hasTable($table) && DB::table($table)->exists()) {
                throw new RuntimeException('Health history exists; retain the additive tables during application rollback.');
            }
        }
        Schema::dropIfExists('patient_health_snapshots');
        Schema::dropIfExists('patient_biometric_observations');
    }
};
