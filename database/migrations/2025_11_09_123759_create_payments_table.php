<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_payment_summaries', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('reservation_id')->unique()->constrained()->restrictOnDelete();
            $table->string('provider', 60)->nullable();
            $table->string('provider_ref')->nullable();
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('status', 30)->default('unpaid')->index();
            $table->unsignedBigInteger('successful_attempt_id')->nullable()->unique();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_attempts', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('payment_summary_id')->constrained('reservation_payment_summaries')->restrictOnDelete();
            $table->foreignId('reservation_id')->constrained()->restrictOnDelete();
            $table->string('provider', 60);
            $table->string('provider_ref')->nullable();
            $table->string('idempotency_key', 100);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('status', 30)->default('initiated')->index();
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->timestamp('initiated_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'idempotency_key'], 'payment_attempt_provider_idempotency_unique');
            $table->unique(['provider', 'provider_ref'], 'payment_attempt_provider_reference_unique');
            $table->index(['reservation_id', 'status']);
        });

        Schema::table('reservation_payment_summaries', function (Blueprint $table): void {
            $table->foreign('successful_attempt_id', 'payment_summary_successful_attempt_fk')
                ->references('id')
                ->on('payment_attempts')
                ->restrictOnDelete();
        });

        Schema::create('payment_provider_events', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('payment_attempt_id')->nullable()->constrained('payment_attempts')->nullOnDelete();
            $table->string('provider', 60);
            $table->string('external_event_id', 191);
            $table->string('event_type', 100);
            $table->boolean('signature_verified')->default(false);
            $table->timestamp('received_at')->useCurrent();
            $table->timestamp('processed_at')->nullable();
            $table->json('sanitized_payload')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'external_event_id'], 'payment_provider_event_unique');
        });

        Schema::create('payment_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('payment_summary_id')->constrained('reservation_payment_summaries')->restrictOnDelete();
            $table->foreignId('payment_attempt_id')->nullable()->constrained('payment_attempts')->nullOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 30);
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('status', 30)->default('pending')->index();
            $table->string('provider_ref')->nullable();
            $table->text('reason');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_adjustments');
        Schema::dropIfExists('payment_provider_events');

        Schema::table('reservation_payment_summaries', function (Blueprint $table): void {
            if (DB::connection()->getDriverName() === 'mysql') {
                $table->dropForeign('payment_summary_successful_attempt_fk');

                return;
            }

            $table->dropForeign(['successful_attempt_id']);
        });

        Schema::dropIfExists('payment_attempts');
        Schema::dropIfExists('reservation_payment_summaries');
    }
};
