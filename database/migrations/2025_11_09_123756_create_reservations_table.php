<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('doctor_profile_id')->constrained()->restrictOnDelete();
            $table->foreignId('doctor_workplace_id')->constrained('doctor_workplaces')->restrictOnDelete();
            $table->foreignId('checkup_id')->constrained()->restrictOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->unsignedSmallInteger('duration_minutes');
            $table->string('timezone', 64);
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('hold_expires_at')->nullable()->index();
            $table->string('booking_idempotency_key', 100)->nullable()->unique();
            $table->string('hospital_name_snapshot');
            $table->string('doctor_name_snapshot');
            $table->string('checkup_title_snapshot');
            $table->string('category_name_snapshot')->nullable();
            $table->unsignedBigInteger('price_snapshot');
            $table->char('currency_snapshot', 3);
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expired_at')->nullable();
            $table->timestamps();

            $table->index(
                ['doctor_profile_id', 'starts_at', 'ends_at', 'status'],
                'reservation_doctor_conflict_idx'
            );
            $table->index(
                ['doctor_workplace_id', 'starts_at', 'ends_at', 'status'],
                'reservation_workplace_conflict_idx'
            );
            $table->index(['user_id', 'status', 'starts_at']);
        });

        Schema::create('reservation_schedule_changes', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('reservation_id')->constrained('reservations')->restrictOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('previous_doctor_workplace_id');
            $table->unsignedBigInteger('new_doctor_workplace_id');
            $table->dateTime('previous_starts_at');
            $table->dateTime('previous_ends_at');
            $table->unsignedSmallInteger('previous_duration_minutes');
            $table->dateTime('new_starts_at');
            $table->dateTime('new_ends_at');
            $table->unsignedSmallInteger('new_duration_minutes');
            $table->text('reason');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('previous_doctor_workplace_id', 'schedule_change_previous_workplace_fk')
                ->references('id')
                ->on('doctor_workplaces')
                ->restrictOnDelete();
            $table->foreign('new_doctor_workplace_id', 'schedule_change_new_workplace_fk')
                ->references('id')
                ->on('doctor_workplaces')
                ->restrictOnDelete();
        });

        Schema::create('reservation_rating_options', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('type', 20);
            $table->string('label', 120);
            $table->string('slug', 140);
            $table->text('description')->nullable();
            $table->boolean('active')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['type', 'slug']);
            $table->index(['type', 'active', 'sort_order'], 'rating_options_type_active_sort_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_rating_options');
        Schema::dropIfExists('reservation_schedule_changes');
        Schema::dropIfExists('reservations');
    }
};
