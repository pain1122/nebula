<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservation_files', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('reservation_id')->constrained()->restrictOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('disk', 60)->default('private');
            $table->string('path', 1024);
            $table->string('original_filename')->nullable();
            $table->string('safe_filename')->nullable();
            $table->string('label')->nullable();
            $table->string('mime_type', 191)->nullable();
            $table->string('extension', 20)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('checksum_sha256', 64)->nullable()->index();
            $table->string('classification', 30)->default('medical')->index();
            $table->string('scan_status', 30)->default('quarantined')->index();
            $table->timestamp('scanned_at')->nullable();
            $table->timestamp('retention_until')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservation_files');
    }
};
