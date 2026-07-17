<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctor_workplace_checkup', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('doctor_workplace_id')->constrained('doctor_workplaces')->restrictOnDelete();
            $table->foreignId('checkup_id')->constrained('checkups')->restrictOnDelete();
            $table->unsignedBigInteger('price_override')->nullable();
            $table->char('currency_override', 3)->nullable();
            $table->unsignedSmallInteger('duration_override_minutes')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique(['doctor_workplace_id', 'checkup_id'], 'workplace_checkup_unique');
            $table->index(['checkup_id', 'is_active']);
        });

        Schema::create('doctor_working_windows', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('doctor_workplace_id')->constrained('doctor_workplaces')->restrictOnDelete();
            $table->unsignedTinyInteger('weekday');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->unsignedSmallInteger('slot_duration_minutes')->default(30);
            $table->unsignedSmallInteger('buffer_minutes')->default(0);
            $table->date('effective_from')->nullable();
            $table->date('effective_until')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->index(
                ['doctor_workplace_id', 'weekday', 'is_active', 'effective_from', 'effective_until'],
                'working_window_lookup_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_working_windows');
        Schema::dropIfExists('doctor_workplace_checkup');
    }
};
