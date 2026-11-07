<?php

namespace Tests\Feature\Database;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class RecommendationSchemaTest extends TestCase
{
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const TABLES = ['recommendation_rules', 'recommendation_rule_versions', 'recommendation_rule_version_targets',
        'recommendation_rule_reviews', 'recommendation_reviewer_grants', 'recommendation_catalog_state'];

    private function migration(): object
    {
        return require database_path('migrations/2026_11_05_000001_create_recommendation_rule_tables.php');
    }

    public function test_source_schema_is_additive_disabled_and_has_no_rules_or_grants(): void
    {
        $this->assertFalse(config('recommendations.enabled'));
        $this->assertFalse(config('recommendations.authoring_enabled'));
        foreach (self::TABLES as $table) {
            $this->assertTrue(Schema::hasTable($table));
            $this->assertSame($table === 'recommendation_catalog_state' ? 1 : 0, DB::table($table)->count());
        }
        $this->assertSame(0, User::count());
        $this->assertTrue(Schema::hasTable('patient_health_snapshots'));
        $this->assertTrue(Schema::hasTable('articles'));
    }

    public function test_empty_source_schema_can_roll_back_without_removing_health_or_content(): void
    {
        $this->migration()->down();
        foreach (self::TABLES as $table) {
            $this->assertFalse(Schema::hasTable($table));
        }
        $this->assertTrue(Schema::hasTable('patient_health_snapshots'));
        $this->assertTrue(Schema::hasTable('articles'));
        $this->migration()->up();
    }

    public function test_history_blocks_rollback_before_any_table_is_removed(): void
    {
        $user = User::factory()->create();
        DB::table('recommendation_reviewer_grants')->insert(['public_id' => strtolower((string) \Illuminate\Support\Str::ulid()),
            'user_id' => $user->id, 'granted_by_user_id' => $user->id, 'scope' => 'article', 'evidence_ref' => 'Synthetic source test only',
            'valid_from' => now(), 'valid_until' => now()->addDay(), 'created_at' => now(), 'updated_at' => now()]);
        try {
            $this->migration()->down();
            $this->fail('Populated rollback accepted.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('retain tables', $error->getMessage());
        }
        foreach (self::TABLES as $table) {
            $this->assertTrue(Schema::hasTable($table));
        }
    }

    public function test_catalog_changes_and_partial_schemas_refuse_destructive_rollback(): void
    {
        DB::table('recommendation_catalog_state')->where('id', 1)->update(['revision' => 1]);
        try {
            $this->migration()->down();
            $this->fail('Changed catalog rollback accepted.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('catalog changed', $error->getMessage());
        }
        DB::table('recommendation_catalog_state')->where('id', 1)->update(['revision' => 0]);
        Schema::drop('recommendation_rule_version_targets');
        try {
            $this->migration()->down();
            $this->fail('Partial rollback accepted.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('Partial schema', $error->getMessage());
        }
        $this->assertTrue(Schema::hasTable('recommendation_rules'));
    }
}
