<?php

namespace Tests\Feature\Database;

use App\Models\User;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleSchedulingMediaSchemaTest extends TestCase
{
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const TABLES = ['article_version_media', 'article_publication_schedules', 'article_media_assets'];

    private function migration(): object
    {
        return require database_path('migrations/2026_10_23_000001_create_article_scheduling_media_tables.php');
    }

    private function version(int $actor, string $slug, int $schema = 2, ?string $presentation = null): array
    {
        $article = DB::table('articles')->insertGetId(['public_id' => strtolower((string) Str::ulid()), 'slug' => $slug,
            'author_user_id' => $actor, 'working_version' => 1, 'working_state' => 'draft', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('article_versions')->insert(['public_id' => strtolower((string) Str::ulid()), 'article_id' => $article,
            'version' => 1, 'schema_version' => $schema, 'translations' => '{}', 'health_catalog_version' => 'health-2026-10-22.1',
            'health_references' => '[]', 'source_links' => '[]', 'content_hash' => str_repeat('a', 64), 'actor_user_id' => $actor,
            'recorded_at' => now(), 'presentation' => $presentation]);

        return [$article, 1];
    }

    private function asset(int $actor): int
    {
        return DB::table('article_media_assets')->insertGetId(['public_id' => strtolower((string) Str::ulid()),
            'actor_user_id' => $actor, 'disk' => 'article-media', 'object_key' => 'editorial/'.Str::ulid(),
            'display_name' => 'Synthetic image.png', 'mime_type' => 'image/png', 'size_bytes' => 100,
            'checksum_sha256' => str_repeat('b', 64), 'upload_policy_revision' => str_repeat('c', 64),
            'created_at' => now(), 'updated_at' => now()]);
    }

    private function refuses(Closure $operation): void
    {
        try {
            $operation();
            $this->fail('Expected database integrity refusal.');
        } catch (QueryException) {
            $this->assertTrue(true);
        }
    }

    private function fingerprints(): array
    {
        return collect(['users', 'roles', 'jobs', 'audit_events', 'articles', 'patient_health_snapshots', 'patient_biometric_observations'])
            ->mapWithKeys(fn ($t) => [$t => hash('sha256', DB::table($t)->orderBy('id')->get()->toJson())])->all();
    }

    public function test_empty_extension_rollback_preserves_original_versions_business_health_and_queue(): void
    {
        $actor = User::factory()->admin()->create()->id;
        $this->version($actor, 'existing-schema-one', 1);
        $this->version($actor, 'existing-schema-two');
        DB::table('jobs')->insert(['queue' => 'unrelated-sentinel', 'payload' => '{}', 'attempts' => 0,
            'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
        $before = $this->fingerprints();
        $versions = DB::table('article_versions')->orderBy('id')->get()->map(fn ($r) => collect((array) $r)->except('presentation')->all())->all();
        $this->migration()->down();
        $this->assertFalse(Schema::hasColumn('article_versions', 'presentation'));
        foreach (self::TABLES as $t) {
            $this->assertFalse(Schema::hasTable($t));
        }
        $this->assertSame($before, $this->fingerprints());
        $this->assertSame($versions, DB::table('article_versions')->orderBy('id')->get()->map(fn ($r) => (array) $r)->all());
        $this->migration()->up();
        foreach (self::TABLES as $t) {
            $this->assertTrue(Schema::hasTable($t));
            $this->assertSame(0, DB::table($t)->count());
        }
        $this->assertTrue(Schema::hasColumn('article_versions', 'presentation'));
        $this->assertSame(0, DB::table('article_versions')->whereNotNull('presentation')->count());
        $this->assertSame($before, $this->fingerprints());
    }

    public function test_schedule_version_ownership_current_schedule_uniqueness_and_delete_restrictions(): void
    {
        $actor = User::factory()->admin()->create()->id;
        [$article] = $this->version($actor, 'scheduled-article');
        $row = ['public_id' => strtolower((string) Str::ulid()), 'article_id' => $article, 'version' => 1,
            'content_hash' => str_repeat('a', 64), 'publish_at' => now()->addDay(), 'timezone' => 'Asia/Tehran', 'actor_user_id' => $actor];
        DB::table('article_publication_schedules')->insert($row);
        $this->refuses(fn () => DB::table('article_publication_schedules')->insert(array_replace($row, ['public_id' => strtolower((string) Str::ulid())])));
        [$other] = $this->version($actor, 'other-article');
        $this->refuses(fn () => DB::table('article_publication_schedules')->insert(array_replace($row, ['article_id' => $other, 'version' => 2, 'public_id' => strtolower((string) Str::ulid())])));
        $this->refuses(fn () => DB::table('article_versions')->where('article_id', $article)->delete());
        $this->refuses(fn () => DB::table('users')->where('id', $actor)->delete());
        $this->assertSame(1, DB::table('article_publication_schedules')->count());
    }

    public function test_media_links_bind_the_exact_asset_checksum_and_article_version_without_duplicates(): void
    {
        $actor = User::factory()->admin()->create()->id;
        [$article] = $this->version($actor, 'image-article');
        $asset = $this->asset($actor);
        $row = ['article_id' => $article, 'version' => 1, 'asset_id' => $asset, 'checksum_sha256' => str_repeat('b', 64),
            'usage' => 'inline', 'language' => 'en'];
        DB::table('article_version_media')->insert($row);
        $this->refuses(fn () => DB::table('article_version_media')->insert($row));
        $this->refuses(fn () => DB::table('article_version_media')->insert(array_replace($row, ['language' => 'fa', 'checksum_sha256' => str_repeat('d', 64)])));
        $this->refuses(fn () => DB::table('article_version_media')->insert(array_replace($row, ['version' => 2])));
        $this->refuses(fn () => DB::table('article_media_assets')->where('id', $asset)->delete());
        DB::table('article_version_media')->insert(array_replace($row, ['language' => 'fa']));
        $this->assertSame(2, DB::table('article_version_media')->count());
        $this->assertSame('quarantined', DB::table('article_media_assets')->value('status'));
    }

    public function test_existing_asset_refuses_rollback_before_any_ddl(): void
    {
        $this->asset(User::factory()->admin()->create()->id);
        try {
            $this->migration()->down();
            $this->fail('Populated rollback should refuse.');
        } catch (RuntimeException) {
            foreach (self::TABLES as $t) {
                $this->assertTrue(Schema::hasTable($t));
            }
            $this->assertTrue(Schema::hasColumn('article_versions', 'presentation'));
        }
    }

    public function test_existing_schedule_refuses_rollback_without_removing_empty_reference_tables(): void
    {
        $actor = User::factory()->admin()->create()->id;
        [$article] = $this->version($actor, 'preserved-schedule');
        DB::table('article_publication_schedules')->insert(['public_id' => strtolower((string) Str::ulid()),
            'article_id' => $article, 'version' => 1, 'content_hash' => str_repeat('a', 64),
            'publish_at' => now()->addDay(), 'timezone' => 'Asia/Tehran', 'actor_user_id' => $actor]);
        try {
            $this->migration()->down();
            $this->fail('Existing schedule should refuse rollback.');
        } catch (RuntimeException) {
            foreach (self::TABLES as $t) {
                $this->assertTrue(Schema::hasTable($t));
            }
            $this->assertSame(1, DB::table('article_publication_schedules')->count());
        }
    }

    public function test_audit_history_alone_refuses_rollback_after_operational_rows_are_absent(): void
    {
        $actor = User::factory()->admin()->create();
        DB::table('audit_events')->insert(['public_id' => strtolower((string) Str::ulid()), 'actor_user_id' => $actor->id,
            'action' => 'admin.article_schedule.cancelled', 'subject_type' => 'SyntheticArticleSchedule', 'subject_id' => 1,
            'risk_level' => 'high', 'outcome' => 'succeeded', 'created_at' => now()]);
        $before = $this->fingerprints();
        try {
            $this->migration()->down();
            $this->fail('Retained audit should refuse rollback.');
        } catch (RuntimeException) {
            $this->assertTrue(Schema::hasColumn('article_versions', 'presentation'));
            foreach (self::TABLES as $t) {
                $this->assertTrue(Schema::hasTable($t));
            }
            $this->assertSame($before, $this->fingerprints());
        }
    }

    public function test_partial_schema_refuses_down_before_touching_other_tables_or_column(): void
    {
        Schema::drop('article_version_media');
        try {
            $this->migration()->down();
            $this->fail('Partial state should refuse rollback.');
        } catch (RuntimeException) {
            $this->assertTrue(Schema::hasTable('article_publication_schedules'));
            $this->assertTrue(Schema::hasTable('article_media_assets'));
            $this->assertTrue(Schema::hasColumn('article_versions', 'presentation'));
        }
    }

    public function test_presentation_history_refuses_rollback_even_without_link_rows(): void
    {
        $this->version(User::factory()->admin()->create()->id, 'historical-presentation', 3, '{}');
        $this->expectException(RuntimeException::class);
        $this->migration()->down();
    }

    public function test_preexisting_extension_refuses_up_without_changing_any_rows(): void
    {
        $before = $this->fingerprints();
        try {
            $this->migration()->up();
            $this->fail('Existing schema should refuse.');
        } catch (RuntimeException) {
            $this->assertSame($before, $this->fingerprints());
            $this->assertTrue(Schema::hasColumn('article_versions', 'presentation'));
        }
    }
}
