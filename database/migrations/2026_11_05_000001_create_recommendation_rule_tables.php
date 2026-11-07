<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recommendation_catalog_state', function (Blueprint $table): void {
            $table->unsignedTinyInteger('id')->primary();
            $table->unsignedBigInteger('revision')->default(0);
            $table->timestamps();
        });
        Schema::create('recommendation_reviewer_grants', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('granted_by_user_id')->constrained('users')->restrictOnDelete();
            $table->string('scope', 16);
            $table->string('evidence_ref', 200);
            $table->dateTime('valid_from');
            $table->dateTime('valid_until');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->unique(['id', 'user_id'], 'recommendation_grant_owner_unique');
            $table->index(['user_id', 'scope', 'revoked_at']);
        });
        Schema::create('recommendation_rules', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('slug', 160)->unique();
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('working_version')->default(0);
            $table->string('working_state', 16)->default('draft');
            $table->foreignId('assigned_reviewer_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('published_version')->nullable();
            $table->unsignedBigInteger('published_review_id')->nullable();
            $table->timestamp('retired_at')->nullable();
            $table->timestamps();
        });
        Schema::create('recommendation_rule_versions', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('rule_id')->constrained('recommendation_rules')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedSmallInteger('schema_version');
            $table->string('health_catalog_version', 64);
            $table->string('evaluator_version', 64);
            $table->json('definition');
            $table->json('translations');
            $table->json('population');
            $table->json('limitations');
            $table->json('sources');
            $table->json('targets');
            $table->unsignedSmallInteger('priority');
            $table->char('content_hash', 64);
            $table->timestamp('recorded_at');
            $table->unique(['rule_id', 'version']);
        });
        Schema::create('recommendation_rule_version_targets', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('rule_id');
            $table->unsignedInteger('rule_version');
            $table->foreign(['rule_id', 'rule_version'], 'recommendation_target_rule_fk')
                ->references(['rule_id', 'version'])->on('recommendation_rule_versions')->restrictOnDelete();
            // Only the accepted article adapter is representable in this first schema.
            $table->unsignedBigInteger('article_id');
            $table->unsignedInteger('article_version');
            $table->foreign(['article_id', 'article_version'], 'recommendation_target_article_fk')
                ->references(['article_id', 'version'])->on('article_versions')->restrictOnDelete();
            $table->char('content_hash', 64);
            $table->unique(['rule_id', 'rule_version', 'article_id'], 'recommendation_target_unique');
        });
        Schema::create('recommendation_rule_reviews', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->unsignedBigInteger('rule_id');
            $table->unsignedInteger('rule_version');
            $table->foreign(['rule_id', 'rule_version'], 'recommendation_review_version_fk')
                ->references(['rule_id', 'version'])->on('recommendation_rule_versions')->restrictOnDelete();
            $table->unsignedBigInteger('reviewer_grant_id');
            $table->unsignedBigInteger('reviewer_user_id');
            $table->foreign(['reviewer_grant_id', 'reviewer_user_id'], 'recommendation_review_grant_fk')
                ->references(['id', 'user_id'])->on('recommendation_reviewer_grants')->restrictOnDelete();
            $table->string('outcome', 16);
            $table->char('content_hash', 64);
            $table->text('assessment');
            $table->dateTime('valid_until');
            $table->foreignId('supersedes_review_id')->nullable()->constrained('recommendation_rule_reviews')->restrictOnDelete();
            $table->uuid('action_key')->unique();
            $table->timestamp('recorded_at');
            $table->unique(['rule_id', 'id'], 'recommendation_review_owner_unique');
        });
        Schema::table('recommendation_rules', function (Blueprint $table): void {
            $table->foreign(['id', 'published_review_id'])
                ->references(['rule_id', 'id'])->on('recommendation_rule_reviews')->restrictOnDelete();
        });
        DB::table('recommendation_catalog_state')->insert(['id' => 1, 'revision' => 0, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        $tables = ['recommendation_rule_reviews', 'recommendation_rule_version_targets', 'recommendation_rule_versions',
            'recommendation_rules', 'recommendation_reviewer_grants', 'recommendation_catalog_state'];
        foreach ($tables as $table) {
            if (! Schema::hasTable($table) || ($table !== 'recommendation_catalog_state' && DB::table($table)->exists())) {
                throw new RuntimeException('Partial schema or recommendation history exists; retain tables during rollback.');
            }
        }
        $state = DB::table('recommendation_catalog_state')->get();
        if ($state->count() !== 1 || (int) $state[0]->id !== 1 || (int) $state[0]->revision !== 0) {
            throw new RuntimeException('Recommendation catalog changed; retain tables during rollback.');
        }
        Schema::table('recommendation_rules', function (Blueprint $table): void {
            $table->dropForeign(['id', 'published_review_id']);
        });
        foreach ($tables as $table) {
            Schema::drop($table);
        }
    }
};
