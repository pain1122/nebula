<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['articles', 'article_versions', 'users', 'audit_events'] as $table) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException('Article foundation is required before the scheduling/media extension.');
            }
        }
        foreach (['article_publication_schedules', 'article_media_assets', 'article_version_media'] as $table) {
            if (Schema::hasTable($table)) {
                throw new RuntimeException('Partial scheduling/media schema; inspect before continuing.');
            }
        }
        if (Schema::hasColumn('article_versions', 'presentation')) {
            throw new RuntimeException('Partial scheduling/media schema; retain the existing column.');
        }
        Schema::table('article_versions', function (Blueprint $table): void {
            $table->json('presentation')->nullable();
        });
        Schema::create('article_publication_schedules', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('article_id')->unique()->constrained('articles')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->char('content_hash', 64);
            $table->timestamp('publish_at');
            $table->string('timezone', 64);
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 20)->default('armed');
            $table->unsignedBigInteger('revision')->default(1);
            $table->string('blocker', 64)->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->foreign(['article_id', 'version'], 'article_schedule_version_owner_fk')
                ->references(['article_id', 'version'])->on('article_versions')->restrictOnDelete();
            $table->index(['status', 'publish_at', 'id'], 'article_schedule_due_index');
        });
        Schema::create('article_media_assets', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('purpose', 32)->default('article_editorial');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->string('disk', 64);
            $table->string('object_key', 255)->unique();
            $table->string('display_name', 255);
            $table->string('mime_type', 64);
            $table->unsignedBigInteger('size_bytes');
            $table->char('checksum_sha256', 64);
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('status', 20)->default('quarantined');
            $table->unsignedBigInteger('revision')->default(1);
            $table->char('upload_policy_revision', 64);
            $table->json('validation_evidence')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->unique(['id', 'checksum_sha256'], 'article_asset_checksum_owner_unique');
            $table->index(['purpose', 'status', 'id'], 'article_asset_library_index');
        });
        Schema::create('article_version_media', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('article_id')->constrained('articles')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->foreignId('asset_id')->constrained('article_media_assets')->restrictOnDelete();
            $table->char('checksum_sha256', 64);
            $table->string('usage', 16);
            $table->string('language', 2);
            $table->foreign(['article_id', 'version'], 'article_media_version_owner_fk')
                ->references(['article_id', 'version'])->on('article_versions')->restrictOnDelete();
            $table->foreign(['asset_id', 'checksum_sha256'], 'article_media_checksum_owner_fk')
                ->references(['id', 'checksum_sha256'])->on('article_media_assets')->restrictOnDelete();
            $table->unique(['article_id', 'version', 'asset_id', 'usage', 'language'], 'article_version_media_usage_unique');
        });
    }

    public function down(): void
    {
        $tables = ['article_version_media', 'article_publication_schedules', 'article_media_assets'];
        foreach ($tables as $table) {
            if (! Schema::hasTable($table) || DB::table($table)->exists()) {
                throw new RuntimeException('Scheduling/media state exists or is partial; retain it during application rollback.');
            }
        }
        if (! Schema::hasColumn('article_versions', 'presentation')
            || DB::table('article_versions')->whereNotNull('presentation')->orWhere('schema_version', '>=', 3)->exists()
            || DB::table('audit_events')->where('action', 'like', 'admin.article_schedule.%')
                ->orWhere('action', 'like', 'admin.article_media.%')->exists()) {
            throw new RuntimeException('Scheduling/media history exists or is partial; retain it during application rollback.');
        }
        foreach ($tables as $table) {
            Schema::drop($table);
        }
        Schema::table('article_versions', fn (Blueprint $table) => $table->dropColumn('presentation'));
    }
};
