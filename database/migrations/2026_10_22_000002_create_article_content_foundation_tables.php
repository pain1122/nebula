<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_catalog_state', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->unsignedBigInteger('revision')->default(0);
            $table->timestamps();
        });
        Schema::create('article_terms', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('kind', 16);
            $table->string('slug', 160);
            $table->unsignedInteger('current_version')->default(0);
            $table->foreignId('parent_id')->nullable()->constrained('article_terms')->restrictOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['kind', 'slug']);
            $table->index(['kind', 'is_active', 'id']);
        });
        Schema::create('article_term_versions', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('term_id')->constrained('article_terms')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->json('labels');
            $table->json('descriptions')->nullable();
            $table->boolean('is_active');
            $table->foreignId('parent_id')->nullable()->constrained('article_terms')->restrictOnDelete();
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('recorded_at');
            $table->unique(['term_id', 'version']);
            $table->unique(['term_id', 'id'], 'article_term_version_owner_unique');
        });
        Schema::create('articles', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('slug', 160)->unique();
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('working_version')->default(0);
            $table->string('working_state', 16)->default('draft');
            $table->unsignedInteger('reviewed_version')->nullable();
            $table->char('reviewed_hash', 64)->nullable();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedInteger('published_version')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->index(['working_state', 'archived_at', 'id']);
            $table->index(['author_user_id', 'id']);
        });
        Schema::create('article_versions', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('article_id')->constrained('articles')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->unsignedSmallInteger('schema_version')->default(1);
            $table->json('translations');
            $table->string('health_catalog_version', 64);
            $table->json('health_references');
            $table->json('source_links');
            $table->char('content_hash', 64);
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('recorded_at');
            $table->unique(['article_id', 'version']);
        });
        Schema::create('article_version_terms', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('article_version_id')->constrained('article_versions')->restrictOnDelete();
            $table->foreignId('term_id')->constrained('article_terms')->restrictOnDelete();
            $table->unsignedBigInteger('term_version_id');
            $table->foreign(['term_id', 'term_version_id'], 'article_version_term_owner_fk')
                ->references(['term_id', 'id'])->on('article_term_versions')->restrictOnDelete();
            $table->unique(['article_version_id', 'term_id']);
            $table->index(['term_id', 'article_version_id']);
        });
        // A shared transaction lock anchor, not a user/content/clinical seed.
        DB::table('article_catalog_state')->insert(['id' => 1, 'revision' => 0, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        // MySQL DDL is not transactionally reversible. Inspect every table before dropping any.
        $tables = ['article_version_terms', 'article_versions', 'articles', 'article_term_versions', 'article_terms', 'article_catalog_state'];
        foreach ($tables as $table) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException('Partial article schema; retain tables and inspect the deployment.');
            }
            if ($table !== 'article_catalog_state' && DB::table($table)->exists()) {
                throw new RuntimeException('Article history exists; retain content tables during application rollback.');
            }
        }
        $state = DB::table('article_catalog_state')->get();
        if ($state->count() !== 1 || (int) $state[0]->id !== 1 || (int) $state[0]->revision !== 0) {
            throw new RuntimeException('Article catalog has changed; retain content tables during application rollback.');
        }
        foreach ($tables as $table) {
            Schema::drop($table);
        }
    }
};
