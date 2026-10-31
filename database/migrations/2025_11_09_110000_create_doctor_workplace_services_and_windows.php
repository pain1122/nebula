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
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->unique(['doctor_workplace_id', 'checkup_id'], 'workplace_checkup_unique');
            $table->index(['checkup_id', 'is_active']);
        });

        Schema::create('doctor_working_windows', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('doctor_workplace_id')->constrained('doctor_workplaces')->restrictOnDelete();
            $table->foreignId('checkup_id')->constrained('checkups')->restrictOnDelete();
            $table->unsignedTinyInteger('weekday');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->unsignedSmallInteger('visit_duration_minutes')->default(30);
            $table->unsignedBigInteger('price_override')->nullable();
            $table->char('currency_override', 3)->nullable();
            $table->date('effective_from')->nullable();
            $table->date('effective_until')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->foreign(['doctor_workplace_id', 'checkup_id'], 'working_slot_service_fk')
                ->references(['doctor_workplace_id', 'checkup_id'])
                ->on('doctor_workplace_checkup')
                ->restrictOnDelete();
            $table->index(
                ['doctor_workplace_id', 'checkup_id', 'weekday', 'is_active'],
                'working_slot_lookup_idx'
            );
        });

        Schema::create('doctor_working_window_breaks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('doctor_working_window_id')
                ->constrained('doctor_working_windows')
                ->restrictOnDelete();
            $table->time('starts_at');
            $table->time('ends_at');
            $table->timestamps();

            $table->index(
                ['doctor_working_window_id', 'starts_at'],
                'working_window_break_lookup_idx'
            );
        });

        Schema::create('doctor_visit_slots', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('doctor_working_window_id')
                ->constrained('doctor_working_windows')
                ->restrictOnDelete();
            $table->foreignId('doctor_workplace_id')->constrained('doctor_workplaces')->restrictOnDelete();
            $table->foreignId('checkup_id')->constrained('checkups')->restrictOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->unsignedBigInteger('price');
            $table->char('currency', 3);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();

            $table->foreign(['doctor_workplace_id', 'checkup_id'], 'visit_slot_service_fk')
                ->references(['doctor_workplace_id', 'checkup_id'])
                ->on('doctor_workplace_checkup')
                ->restrictOnDelete();
            $table->unique(
                ['doctor_working_window_id', 'starts_at'],
                'visit_slot_rule_start_unique'
            );
            $table->index(
                ['doctor_workplace_id', 'checkup_id', 'starts_at', 'is_active'],
                'visit_slot_availability_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_visit_slots');
        Schema::dropIfExists('doctor_working_window_breaks');
        Schema::dropIfExists('doctor_working_windows');
        Schema::dropIfExists('doctor_workplace_checkup');
    }
};
