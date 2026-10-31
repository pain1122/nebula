<?php

namespace Tests\Feature\Api;

use App\Enums\AccountState;
use App\Models\ArticleTerm;
use App\Models\AuditEvent;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\ArticleReadFixtures;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleTaxonomyWriteTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const BASE = '/api/admin/article-taxonomies';

    private function signIn(?User $actor = null): User
    {
        config(['article_content.enabled' => true]);
        $actor ??= User::factory()->admin()->create();
        $this->actingAs($actor)->withHeader('Origin', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $actor;
    }

    private function context(?string $id = null): array
    {
        return $this->getJson(self::BASE.($id === null ? '' : '/'.$id).'/write-context')->assertOk()->json('data');
    }

    private function body(?string $id = null, array $replace = []): array
    {
        return array_replace(['expected_revision' => $this->context($id)['revision'], 'reason' => 'Synthetic taxonomy maintenance', 'confirmed' => true,
            'labels' => ['en' => 'Heart health', 'fa' => 'سلامت قلب'], 'descriptions' => ['en' => 'Educational topic'], 'parent_id' => null]
            + ($id === null ? ['kind' => 'topic', 'slug' => 'heart-health'] : []), $replace);
    }

    private function retire(string $id)
    {
        return $this->postJson(self::BASE.'/'.$id.'/actions', ['expected_revision' => $this->context($id)['revision'],
            'reason' => 'Synthetic retirement', 'confirmed' => true, 'action' => 'retire']);
    }

    private function fingerprint(): string
    {
        $tables = ['article_catalog_state', 'article_terms', 'article_term_versions', 'articles', 'article_versions', 'article_version_terms', 'audit_events'];

        return hash('sha256', json_encode(array_map(fn ($table) => DB::table($table)->orderBy('id')->get()->all(), $tables), JSON_THROW_ON_ERROR));
    }

    public static function roles(): array
    {
        return [['guest', 401], ['patient', 403], ['doctor', 403], ['admin', 200], ['root-admin', 200]];
    }

    #[DataProvider('roles')]
    public function test_context_and_all_writes_require_active_staff_and_private_responses(string $role, int $status): void
    {
        config(['article_content.enabled' => true]);
        $admin = User::factory()->admin()->create();
        $term = $this->termFixture($admin);
        if ($role !== 'guest') {
            $actor = User::factory()->create();
            $actor->assignRole($role);
            $this->signIn($actor);
        }
        $before = $this->fingerprint();
        foreach ([self::BASE.'/write-context', self::BASE.'/'.$term->public_id.'/write-context'] as $url) {
            $response = $this->getJson($url)->assertStatus($status);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        }
        if ($status !== 200) {
            foreach (['post' => self::BASE, 'put' => self::BASE.'/'.$term->public_id, 'action' => self::BASE.'/'.$term->public_id.'/actions'] as $method => $url) {
                $response = $method === 'put' ? $this->putJson($url, []) : $this->postJson($url, []);
                $response->assertStatus($status);
                $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            }
        } else {
            $id = $this->postJson(self::BASE, $this->body(replace: ['slug' => 'new-topic']))->assertCreated()->json('data.id');
            $this->putJson(self::BASE.'/'.$id, $this->body($id, ['labels' => ['en' => 'Changed']]))->assertOk();
            $this->retire($id)->assertOk();

            return;
        }
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_create_update_retire_append_safe_history_and_preserve_published_snapshots(): void
    {
        $actor = $this->signIn();
        $parent = $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'slug' => 'care-parent']))->assertCreated()->json('data.id');
        $id = $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'slug' => 'heart-child', 'parent_id' => strtoupper($parent)]))
            ->assertCreated()->assertJsonPath('data.parent_id', $parent)->assertJsonPath('data.version', 1)->json('data.id');
        $term = DB::table('article_terms')->where('public_id', $id)->first();
        $article = $this->publishFixture($this->articleFixture($actor, terms: [$term]), $actor);
        $articleBefore = DB::table('articles')->find($article->id);
        $immutable = DB::table('article_versions')->where('article_id', $article->id)->first();
        $originalTerm = DB::table('article_term_versions')->where('term_id', $term->id)->where('version', 1)->first();
        $this->putJson(self::BASE.'/'.strtoupper($id), $this->body($id, ['labels' => ['en' => 'Changed title'], 'parent_id' => $parent]))
            ->assertOk()->assertJsonPath('data.version', 2);
        $this->retire($id)->assertOk()->assertJsonPath('data.version', 3)->assertJsonPath('data.is_active', false);
        $this->getJson(self::BASE.'/'.$id.'/versions')->assertOk()->assertJsonPath('meta.pagination.total', 3)
            ->assertJsonPath('data.2.labels.fa', 'سلامت قلب')->assertJsonPath('data.2.is_active', true);
        $this->getJson('/api/admin/articles/'.$article->public_id)->assertOk()->assertJsonPath('data.published.taxonomy.0.labels.en', 'Heart health')
            ->assertJsonPath('data.published.taxonomy.0.currently_active', false)->assertJsonPath('data.published.taxonomy.0.version', 1);
        $this->assertEquals($articleBefore, DB::table('articles')->find($article->id));
        $this->assertEquals($immutable, DB::table('article_versions')->find($immutable->id));
        $this->assertEquals($originalTerm, DB::table('article_term_versions')->find($originalTerm->id));
        $this->assertSame(4, (int) DB::table('article_catalog_state')->value('revision'));
        $this->assertSame(4, AuditEvent::count());
        $audit = AuditEvent::latest('id')->first();
        $this->assertSame('admin.article_term.retired', $audit->action);
        $this->assertSame(ArticleTerm::class, $audit->subject_type);
        $this->assertSame($id, $audit->subject_public_id);
        $this->assertSame($actor->id, $audit->actor_user_id);
        $this->assertSame($actor->name, $audit->actor_name_snapshot);
        $this->assertSame(2, $audit->before['version']);
        $this->assertSame(3, $audit->after['version']);
        $this->assertFalse($audit->after['is_active']);
        $this->assertSame(['id', 'version_id', 'kind', 'slug', 'version', 'is_active', 'parent_id'], array_keys($audit->after));
        $this->assertStringNotContainsString('سلامت', json_encode($audit->after, JSON_UNESCAPED_UNICODE));
        $this->assertSame(['can_create' => false, 'can_update' => false, 'can_retire' => false], array_intersect_key($this->context($id), array_flip(['can_create', 'can_update', 'can_retire'])));
        $this->assertSame(3, $this->context($id)['current']['version']);
        $this->assertSame('Changed title', $this->context($id)['current']['labels']['en']);
    }

    public function test_stale_duplicate_and_cross_actor_target_or_reader_revisions_cannot_write(): void
    {
        $actor = $this->signIn();
        $body = $this->body();
        $id = $this->postJson(self::BASE, $body)->assertCreated()->json('data.id');
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $term = $this->termFixture($actor, 'tag', 'other-tag');
        $wrong = $this->body($id, ['expected_revision' => $this->context($term->public_id)['revision']]);
        $this->putJson(self::BASE.'/'.$id, $wrong)->assertConflict();
        $readerRevision = $this->getJson(self::BASE.'/'.$id)->assertOk()->json('meta.revision');
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['expected_revision' => $readerRevision]))->assertConflict();
        $saved = $this->body($id, ['labels' => ['en' => 'Next title']]);
        $this->signIn(User::factory()->admin()->create());
        $this->putJson(self::BASE.'/'.$id, $saved)->assertConflict();
        $this->signIn($actor);
        $this->postJson(self::BASE, $this->body(replace: ['slug' => 'another-topic']))->assertCreated();
        $this->putJson(self::BASE.'/'.$id, $saved)->assertConflict();
        $this->assertSame(1, (int) DB::table('article_terms')->where('public_id', $id)->value('current_version'));
    }

    public function test_noop_retired_edits_reactivation_and_reserved_slug_reuse_refuse_without_changes(): void
    {
        $this->signIn();
        $id = $this->postJson(self::BASE, $this->body())->assertCreated()->json('data.id');
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$id, $this->body($id))->assertConflict();
        $this->postJson(self::BASE, $this->body())->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $this->retire($id)->assertOk();
        $before = $this->fingerprint();
        $this->retire($id)->assertConflict();
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['labels' => ['en' => 'Reopen']]))->assertConflict();
        $this->postJson(self::BASE, $this->body())->assertConflict();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_hierarchy_rejects_self_descendant_flat_missing_and_retired_parents(): void
    {
        $actor = $this->signIn();
        $root = $this->termFixture($actor, 'category', 'root-category');
        $child = $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'slug' => 'child-category', 'parent_id' => $root->public_id]))->assertCreated()->json('data.id');
        foreach ([$root->public_id, $child] as $parent) {
            $this->putJson(self::BASE.'/'.$root->public_id, $this->body($root->public_id, ['parent_id' => $parent]))->assertUnprocessable();
        }
        foreach (['topic', 'tag'] as $kind) {
            $this->postJson(self::BASE, $this->body(replace: ['kind' => $kind, 'parent_id' => $root->public_id]))->assertUnprocessable();
        }
        $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'parent_id' => strtolower((string) Str::ulid())]))->assertUnprocessable();
        $flat = $this->termFixture($actor, 'tag', 'flat-tag');
        $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'parent_id' => $flat->public_id]))->assertUnprocessable();
        // Fixtures above are not writes under test; retain a new exact baseline.
        $before = $this->fingerprint();
        $this->assertFalse($this->context($root->public_id)['can_retire']);
        $this->retire($root->public_id)->assertConflict();
        $this->assertSame($before, $this->fingerprint());
        $this->retire($child)->assertOk();
        $this->retire($root->public_id)->assertOk();
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'parent_id' => $root->public_id]))->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
        $this->getJson(self::BASE.'/'.$child.'/versions')->assertOk()->assertJsonPath('data.1.parent_id', $root->public_id);
    }

    public static function invalidInputs(): array
    {
        return [
            'empty labels' => [['labels' => []]], 'blank labels' => [['labels' => ['en' => " \u{200b}"]]],
            'unknown locale' => [['labels' => ['de' => 'Title']]], 'nested label' => [['labels' => ['en' => ['text']]]],
            'oversized label' => [['labels' => ['en' => str_repeat('ع', 201)]]],
            'oversized description' => [['descriptions' => ['fa' => str_repeat('ع', 1001)]]],
            'bad descriptions' => [['descriptions' => ['en' => null]]], 'control characters' => [['labels' => ['en' => "title\0"]]],
            'bad slug' => [['slug' => 'Upper-Case']], 'bad kind' => [['kind' => 'condition']],
            'unsafe parent' => [['parent_id' => 1]], 'unknown field' => [['is_active' => true]],
            'no confirmation' => [['confirmed' => false]], 'blank reason' => [['reason' => " \u{200b}"]],
            'oversized reason' => [['reason' => str_repeat('x', 1001)]], 'bad revision' => [['expected_revision' => 'invalid']],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_payloads_are_bounded_and_leave_no_partial_version_or_audit(array $replace): void
    {
        $this->signIn();
        $body = $this->body(replace: $replace);
        $before = $this->fingerprint();
        $response = $this->postJson(self::BASE, $body)->assertUnprocessable();
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_update_cannot_change_identity_and_action_cannot_smuggle_content_or_unsupported_state(): void
    {
        $this->signIn();
        $id = $this->postJson(self::BASE, $this->body())->assertCreated()->json('data.id');
        $before = $this->fingerprint();
        foreach (['kind' => 'tag', 'slug' => 'new-slug', 'is_active' => false] as $key => $value) {
            $this->putJson(self::BASE.'/'.$id, $this->body($id, [$key => $value]))->assertUnprocessable();
        }
        foreach (['publish', 'restore', 'delete'] as $action) {
            $this->postJson(self::BASE.'/'.$id.'/actions', ['expected_revision' => $this->context($id)['revision'], 'reason' => 'Synthetic reason', 'confirmed' => true, 'action' => $action])->assertUnprocessable();
        }
        $this->postJson(self::BASE.'/'.$id.'/actions', $this->body($id, ['action' => 'retire']))->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_missing_password_disabled_schema_and_unknown_ids_fail_closed(): void
    {
        $this->signIn();
        $body = $this->body();
        $this->withSession(['auth.password_confirmed_at' => time() - 10000])->postJson(self::BASE, $body)->assertStatus(423);
        $this->withSession(['auth.password_confirmed_at' => time()]);
        config(['article_content.enabled' => false]);
        $this->postJson(self::BASE, $body)->assertStatus(503);
        config(['article_content.enabled' => true]);
        $missing = strtolower((string) Str::ulid());
        $this->getJson(self::BASE.'/'.$missing.'/write-context')->assertNotFound();
        $this->putJson(self::BASE.'/'.$missing, $body)->assertUnprocessable();
        $this->getJson(self::BASE.'/write-context?unknown=1')->assertUnprocessable();
        $this->postJson(self::BASE.'?unknown=1', $body)->assertUnprocessable();
        Schema::drop('article_version_terms');
        $this->postJson(self::BASE, $body)->assertStatus(503);
        $this->assertSame(0, DB::table('article_terms')->count());
        $this->assertSame(0, AuditEvent::count());
    }

    public function test_fresh_role_and_account_checks_refuse_cached_authority(): void
    {
        $actor = $this->signIn();
        $body = $this->body();
        $actor->load('roles');
        User::findOrFail($actor->id)->syncRoles('patient');
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertForbidden();
        $this->assertSame($before, $this->fingerprint());
        User::findOrFail($actor->id)->syncRoles('admin');
        User::whereKey($actor->id)->update(['account_state' => AccountState::Suspended->value]);
        $this->postJson(self::BASE, $body)->assertForbidden();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_late_audit_failure_rolls_back_create_update_and_retire_including_anchor(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor);
        $this->mock(AuditLogger::class)->shouldReceive('log')->times(3)->andThrow(new RuntimeException('Synthetic secret must not leak'));
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $this->body(replace: ['slug' => 'new-term']))->assertStatus(503)->assertDontSee('Synthetic secret');
        $this->putJson(self::BASE.'/'.$term->public_id, $this->body($term->public_id, ['labels' => ['en' => 'New title']]))->assertStatus(503);
        $this->retire($term->public_id)->assertStatus(503);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_corrupt_current_version_and_anchor_refuse_without_repair(): void
    {
        $actor = $this->signIn();
        $term = $this->termFixture($actor);
        $body = $this->body($term->public_id, ['labels' => ['en' => 'New title']]);
        DB::table('article_terms')->where('id', $term->id)->update(['current_version' => 9]);
        $before = $this->fingerprint();
        $this->putJson(self::BASE.'/'.$term->public_id, $body)->assertStatus(503);
        $this->assertSame($before, $this->fingerprint());
        DB::table('article_terms')->where('id', $term->id)->update(['current_version' => 1]);
        DB::table('article_catalog_state')->where('id', 1)->delete();
        $before = $this->fingerprint();
        $this->getJson(self::BASE.'/write-context')->assertStatus(503);
        $this->putJson(self::BASE.'/'.$term->public_id, $body)->assertStatus(503);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_raw_json_bounds_malformed_utf8_and_control_bytes_are_not_silently_normalized(): void
    {
        $this->signIn();
        $body = $this->body();
        $before = $this->fingerprint();
        foreach (['[]', 'null', '{"broken":', str_repeat(' ', 65537).'{}', "{\"reason\":\"\xff\"}"] as $raw) {
            $this->call('POST', self::BASE, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:3000'], $raw)->assertUnprocessable();
        }
        $this->postJson(self::BASE, array_replace($body, ['reason' => "reason\0"]))->assertUnprocessable();
        $this->postJson(self::BASE, array_replace($body, ['descriptions' => ['en' => "text\0"]]))->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_hierarchy_can_move_to_another_active_root_and_detach_without_changing_history(): void
    {
        $actor = $this->signIn();
        $first = $this->termFixture($actor, 'category', 'first-root');
        $second = $this->termFixture($actor, 'category', 'second-root');
        $id = $this->postJson(self::BASE, $this->body(replace: ['kind' => 'category', 'slug' => 'movable-child', 'parent_id' => $first->public_id]))->assertCreated()->json('data.id');
        $this->putJson(self::BASE.'/'.$id, $this->body($id, ['parent_id' => $second->public_id]))->assertOk()->assertJsonPath('data.parent_id', $second->public_id);
        $this->putJson(self::BASE.'/'.$id, $this->body($id))->assertOk()->assertJsonPath('data.parent_id', null);
        $this->getJson(self::BASE.'/'.$id.'/versions')->assertOk()->assertJsonPath('data.0.parent_id', null)
            ->assertJsonPath('data.1.parent_id', $second->public_id)->assertJsonPath('data.2.parent_id', $first->public_id);
    }

    public function test_fresh_password_is_rechecked_after_waiting_for_the_catalog_lock(): void
    {
        $this->signIn();
        $body = $this->body();
        $changed = false;
        DB::connection()->beforeExecuting(function ($sql) use (&$changed): void {
            if (! $changed && str_contains($sql, 'article_catalog_state')) {
                $changed = true;
                request()->session()->put('auth.password_confirmed_at', 1);
            }
        });
        $before = $this->fingerprint();
        // The callback above also sees this local fingerprint; reset the injected state explicitly.
        $changed = false;
        $this->withSession(['auth.password_confirmed_at' => time()])->postJson(self::BASE, $body)->assertStatus(423);
        $this->assertTrue($changed);
        $this->assertSame($before, $this->fingerprint());
    }

    public function test_successful_writer_does_not_access_health_or_consume_jobs_and_rejects_unknown_public_ids(): void
    {
        $this->signIn();
        DB::table('jobs')->insert(['queue' => 'unrelated-sentinel', 'payload' => '{"synthetic":true}', 'attempts' => 0,
            'reserved_at' => null, 'available_at' => time(), 'created_at' => time()]);
        $jobs = DB::table('jobs')->get()->toJson();
        $healthQueries = [];
        $broadUserReads = [];
        DB::listen(function ($event) use (&$healthQueries, &$broadUserReads) {
            if (preg_match('/patient_health|patient_biometric|reservation_medical|reservation_files|reservation_reports/i', $event->sql)) {
                $healthQueries[] = $event->sql;
            }
            if (preg_match('/select\s+\*\s+from\s+["`]?users["`]?/i', $event->sql)) {
                $broadUserReads[] = $event->sql;
            }
        });
        $this->postJson(self::BASE, $this->body())->assertCreated()->assertJsonMissingPath('data.email')->assertJsonMissingPath('data.password');
        $missing = strtolower((string) Str::ulid());
        $this->putJson(self::BASE.'/'.$missing, ['expected_revision' => str_repeat('0', 64), 'labels' => ['en' => 'Missing'],
            'confirmed' => true, 'reason' => 'Synthetic update'])->assertNotFound();
        $this->assertSame($jobs, DB::table('jobs')->get()->toJson());
        $this->assertSame([], $healthQueries);
        $this->assertSame([], $broadUserReads);
    }

    public function test_already_cyclic_parent_ancestry_is_bounded_and_never_repaired_by_a_save(): void
    {
        $actor = $this->signIn();
        $one = $this->termFixture($actor, 'category', 'cycle-one');
        $two = $this->termFixture($actor, 'category', 'cycle-two');
        foreach ([[$one, $two], [$two, $one]] as [$term, $parent]) {
            DB::table('article_terms')->where('id', $term->id)->update(['parent_id' => $parent->id]);
            DB::table('article_term_versions')->where('term_id', $term->id)->update(['parent_id' => $parent->id]);
        }
        $body = $this->body(replace: ['kind' => 'category', 'parent_id' => $one->public_id]);
        $before = $this->fingerprint();
        $this->postJson(self::BASE, $body)->assertUnprocessable();
        $this->assertSame($before, $this->fingerprint());
    }

    public static function authorityChanges(): array
    {
        return [['role'], ['state']];
    }

    #[DataProvider('authorityChanges')]
    public function test_revocation_after_route_checks_is_seen_under_the_catalog_lock(string $change): void
    {
        $actor = $this->signIn();
        $actor->load('roles');
        $body = $this->body();
        $before = $this->fingerprint();
        $changed = false;
        DB::connection()->beforeExecuting(function ($sql) use ($actor, $change, &$changed): void {
            if (! $changed && str_contains($sql, 'article_catalog_state')) {
                $changed = true;
                if ($change === 'role') {
                    User::findOrFail($actor->id)->syncRoles('patient');
                } else {
                    User::whereKey($actor->id)->update(['account_state' => AccountState::Suspended->value]);
                }
            }
        });
        $this->postJson(self::BASE, $body)->assertForbidden();
        $this->assertTrue($changed);
        $this->assertSame($before, $this->fingerprint());
    }
}
