<?php

namespace Tests\Feature\Database;

use App\Models\User;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleContentSchemaTest extends TestCase
{
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const TABLES = ['article_catalog_state', 'article_terms', 'article_term_versions', 'articles', 'article_versions', 'article_version_terms'];

    private function migration(): object
    {
        return require database_path('migrations/2026_10_22_000002_create_article_content_foundation_tables.php');
    }

    private function actor(): int
    {
        return User::factory()->admin()->create()->id;
    }

    private function term(int $actor, string $slug = 'heart-health'): array
    {
        $id = DB::table('article_terms')->insertGetId(['public_id' => (string) Str::ulid(), 'kind' => 'topic', 'slug' => $slug,
            'current_version' => 1, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
        $version = DB::table('article_term_versions')->insertGetId(['public_id' => (string) Str::ulid(), 'term_id' => $id,
            'version' => 1, 'schema_version' => 1, 'labels' => json_encode(['en' => 'Heart health', 'fa' => 'سلامت قلب'], JSON_THROW_ON_ERROR),
            'is_active' => true, 'actor_user_id' => $actor, 'recorded_at' => now()]);

        return [$id, $version];
    }

    private function article(int $actor): array
    {
        $id = DB::table('articles')->insertGetId(['public_id' => (string) Str::ulid(), 'slug' => 'synthetic-heart-health',
            'author_user_id' => $actor, 'working_version' => 1, 'working_state' => 'draft', 'created_at' => now(), 'updated_at' => now()]);
        $version = DB::table('article_versions')->insertGetId(['public_id' => (string) Str::ulid(), 'article_id' => $id,
            'version' => 1, 'schema_version' => 1, 'translations' => json_encode(['en' => ['title' => 'Synthetic article']], JSON_THROW_ON_ERROR),
            'health_catalog_version' => 'health-2026-10-22.1', 'health_references' => '[]', 'source_links' => '[]',
            'content_hash' => hash('sha256', 'synthetic-schema-fixture'), 'actor_user_id' => $actor, 'recorded_at' => now()]);

        return [$id, $version];
    }

    private function rejectsConstraint(Closure $operation): void
    {
        try {
            $operation();
            $this->fail('Expected a database integrity constraint refusal.');
        } catch (QueryException) {
            $this->assertTrue(true);
        }
    }

    public function test_exact_migration_and_empty_rollback_preserve_existing_business_tables_and_queue(): void
    {
        $this->actor();
        DB::table('jobs')->insert(['queue' => 'unrelated-acceptance-sentinel', 'payload' => '{"synthetic":true}',
            'attempts' => 0, 'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
        $preserved = ['users', 'roles', 'model_has_roles', 'jobs', 'reservations', 'audit_events', 'patient_health_snapshots', 'patient_biometric_observations'];
        $fingerprints = fn () => collect($preserved)->mapWithKeys(fn ($table) => [$table => hash('sha256', DB::table($table)->get()->toJson())])->all();
        $before = $fingerprints();
        $migration = $this->migration();
        $migration->down();
        foreach (self::TABLES as $table) {
            $this->assertFalse(Schema::hasTable($table));
        }
        $this->assertSame($before, $fingerprints());
        $migration->up();
        $this->assertSame($before, $fingerprints());
        $this->assertSame(1, DB::table('article_catalog_state')->count());
        $this->assertSame(0, (int) DB::table('article_catalog_state')->where('id', 1)->value('revision'));
        foreach (array_diff(self::TABLES, ['article_catalog_state']) as $table) {
            $this->assertSame(0, DB::table($table)->count());
        }
    }

    public function test_reference_cannot_bind_one_term_to_another_terms_version(): void
    {
        $actor = $this->actor();
        [$first] = $this->term($actor);
        [, $foreignVersion] = $this->term($actor, 'another-topic');
        [, $articleVersion] = $this->article($actor);
        $this->rejectsConstraint(fn () => DB::table('article_version_terms')->insert(['article_version_id' => $articleVersion,
            'term_id' => $first, 'term_version_id' => $foreignVersion]));
        $this->assertSame(0, DB::table('article_version_terms')->count());
    }

    public function test_current_term_changes_retain_original_linked_version_and_restrict_deletion(): void
    {
        $actor = $this->actor();
        [$term, $originalVersion] = $this->term($actor);
        [$article, $articleVersion] = $this->article($actor);
        DB::table('article_version_terms')->insert(['article_version_id' => $articleVersion, 'term_id' => $term, 'term_version_id' => $originalVersion]);
        $original = DB::table('article_term_versions')->where('id', $originalVersion)->first();
        DB::table('article_term_versions')->insert(['public_id' => (string) Str::ulid(), 'term_id' => $term,
            'version' => 2, 'labels' => '{"en":"Renamed topic","fa":"موضوع تازه"}', 'is_active' => false,
            'actor_user_id' => $actor, 'recorded_at' => now()]);
        DB::table('article_terms')->where('id', $term)->update(['current_version' => 2, 'is_active' => false]);
        $this->assertEquals($original, DB::table('article_term_versions')->where('id', $originalVersion)->first());
        $this->assertSame($originalVersion, (int) DB::table('article_version_terms')->value('term_version_id'));
        $this->rejectsConstraint(fn () => DB::table('article_terms')->where('id', $term)->delete());
        $this->rejectsConstraint(fn () => DB::table('article_term_versions')->where('id', $originalVersion)->delete());
        $this->rejectsConstraint(fn () => DB::table('articles')->where('id', $article)->delete());
        $this->rejectsConstraint(fn () => DB::table('article_versions')->where('id', $articleVersion)->delete());
        $this->rejectsConstraint(fn () => DB::table('users')->where('id', $actor)->delete());
    }

    public function test_archiving_or_retirement_does_not_release_reserved_slugs_or_version_numbers(): void
    {
        $actor = $this->actor();
        [$term, $termVersion] = $this->term($actor);
        [$article, $articleVersion] = $this->article($actor);
        DB::table('article_terms')->where('id', $term)->update(['is_active' => false]);
        DB::table('articles')->where('id', $article)->update(['archived_at' => now()]);
        $this->rejectsConstraint(fn () => DB::table('article_terms')->insert(['public_id' => (string) Str::ulid(), 'kind' => 'topic', 'slug' => 'heart-health']));
        $this->rejectsConstraint(fn () => DB::table('articles')->insert(['public_id' => (string) Str::ulid(), 'slug' => 'synthetic-heart-health', 'author_user_id' => $actor]));
        foreach (['article_term_versions' => $termVersion, 'article_versions' => $articleVersion] as $table => $id) {
            $copy = (array) DB::table($table)->where('id', $id)->first();
            unset($copy['id']);
            $copy['public_id'] = (string) Str::ulid();
            $this->rejectsConstraint(fn () => DB::table($table)->insert($copy));
        }
    }

    public static function populatedKinds(): array
    {
        return [['term'], ['article']];
    }

    #[DataProvider('populatedKinds')]
    public function test_populated_rollback_refuses_before_dropping_any_table(string $kind): void
    {
        $actor = $this->actor();
        $kind === 'term' ? $this->term($actor) : $this->article($actor);
        $counts = collect(self::TABLES)->mapWithKeys(fn ($table) => [$table => DB::table($table)->count()])->all();
        try {
            $this->migration()->down();
            $this->fail('Populated article history must block rollback.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('history exists', $error->getMessage());
        }
        foreach ($counts as $table => $count) {
            $this->assertTrue(Schema::hasTable($table));
            $this->assertSame($count, DB::table($table)->count());
        }
    }

    public function test_changed_coordination_state_blocks_rollback_even_if_content_tables_are_empty(): void
    {
        DB::table('article_catalog_state')->where('id', 1)->update(['revision' => 1]);
        try {
            $this->migration()->down();
            $this->fail('Changed catalog state must block rollback.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('catalog has changed', $error->getMessage());
        }
        foreach (self::TABLES as $table) {
            $this->assertTrue(Schema::hasTable($table));
        }
    }

    public function test_partial_schema_refuses_rollback_without_dropping_remaining_tables(): void
    {
        Schema::drop('article_version_terms');
        try {
            $this->migration()->down();
            $this->fail('Partial schema must not be automatically repaired.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('Partial article schema', $error->getMessage());
        }
        foreach (array_diff(self::TABLES, ['article_version_terms']) as $table) {
            $this->assertTrue(Schema::hasTable($table));
        }
    }
}
