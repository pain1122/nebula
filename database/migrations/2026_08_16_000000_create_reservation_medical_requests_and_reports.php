<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_medical_requests', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('reservation_id')->constrained('reservations')->restrictOnDelete();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->string('request_type', 60);
            $table->string('title');
            $table->text('instructions')->nullable();
            $table->string('status', 30)->default('open')->index();
            $table->timestamp('due_at')->nullable()->index();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('retention_until')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(
                ['id', 'reservation_id'],
                'medical_request_reservation_scope_unique'
            );
            $table->index(['reservation_id', 'status', 'due_at'], 'medical_request_status_due_idx');
        });

        Schema::table('reservation_files', function (Blueprint $table): void {
            $table->unsignedBigInteger('medical_request_id')->nullable()->after('reservation_id');
            $table->index(
                ['medical_request_id', 'reservation_id'],
                'reservation_file_medical_request_idx'
            );
            $table->foreign(
                ['medical_request_id', 'reservation_id']
            )->references(['id', 'reservation_id'])
                ->on('reservation_medical_requests')
                ->restrictOnDelete();
        });

        Schema::create('reservation_reports', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('reservation_id')->constrained('reservations')->restrictOnDelete();
            $table->unsignedBigInteger('medical_request_id');
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->string('author_name_snapshot');
            $table->string('status', 30)->default('draft')->index();
            $table->longText('body');
            $table->timestamp('published_at')->nullable()->index();
            $table->unsignedBigInteger('supersedes_report_id')->nullable();
            $table->timestamp('retention_until')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(
                ['id', 'reservation_id', 'medical_request_id'],
                'reservation_report_history_scope_unique'
            );
            $table->index(
                ['medical_request_id', 'reservation_id'],
                'reservation_report_medical_request_idx'
            );
            $table->index(
                ['supersedes_report_id', 'reservation_id', 'medical_request_id'],
                'reservation_report_supersedes_scope_idx'
            );
            $table->foreign(
                ['medical_request_id', 'reservation_id'],
                'reservation_reports_medical_request_reservation_fk'
            )->references(['id', 'reservation_id'])
                ->on('reservation_medical_requests')
                ->restrictOnDelete();
            $table->foreign(
                ['supersedes_report_id', 'reservation_id', 'medical_request_id'],
                'reservation_reports_supersedes_scope_fk'
            )->references(['id', 'reservation_id', 'medical_request_id'])
                ->on('reservation_reports')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_reports');

        Schema::table('reservation_files', function (Blueprint $table): void {
            $table->dropForeign(['medical_request_id', 'reservation_id']);
            $table->dropIndex('reservation_file_medical_request_idx');
            $table->dropColumn('medical_request_id');
        });

        Schema::dropIfExists('reservation_medical_requests');
    }
};
