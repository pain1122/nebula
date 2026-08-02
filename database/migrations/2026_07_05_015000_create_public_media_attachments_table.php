<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('public_media_attachments', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->morphs('attachable');
            $table->string('collection', 80)->default('default')->index();
            $table->string('disk', 60)->default('public');
            $table->string('path', 1024);
            $table->string('mime_type', 191);
            $table->string('extension', 20);
            $table->unsignedBigInteger('size_bytes');
            $table->string('checksum_sha256', 64)->index();
            $table->string('alt_text')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('archived_at')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();

            $table->index(['attachable_type', 'attachable_id', 'collection', 'sort_order'], 'public_media_collection_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('public_media_attachments');
    }
};
