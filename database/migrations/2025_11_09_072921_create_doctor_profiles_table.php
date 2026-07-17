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
        Schema::create('doctor_profiles', function (Blueprint $t): void {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $t->foreignId('specialty_id')->nullable()->constrained('specialties')->nullOnDelete();
            $t->string('phone')->nullable();
            $t->unsignedInteger('experience_years')->default(0);
            $t->unsignedBigInteger('fee')->default(0);
            $t->text('bio')->nullable();
            $t->boolean('verified')->default(false);
            $t->timestamp('verified_at')->nullable();
            $t->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $t->softDeletes();
            $t->timestamps();
        });

        Schema::create('doctor_specialty', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('doctor_profile_id')->constrained('doctor_profiles')->cascadeOnDelete();
            $table->foreignId('specialty_id')->constrained('specialties')->restrictOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->unique(['doctor_profile_id', 'specialty_id']);
            $table->index(['specialty_id', 'doctor_profile_id']);
        });

        Schema::create('doctor_workplaces', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('doctor_profile_id')->constrained('doctor_profiles')->restrictOnDelete();
            $table->foreignId('marketplace_hospital_id')->constrained('marketplace_hospitals')->restrictOnDelete();
            $table->string('display_name')->nullable();
            $table->text('booking_notes')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('archived_at')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();

            $table->unique(
                ['doctor_profile_id', 'marketplace_hospital_id'],
                'doctor_workplace_hospital_unique'
            );
            $table->index(['marketplace_hospital_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('doctor_workplaces');
        Schema::dropIfExists('doctor_specialty');
        Schema::dropIfExists('doctor_profiles');
    }
};
