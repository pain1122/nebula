<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ClamdScanner;
use App\Services\Content\ArticleMediaStorage;
use App\Services\MedicalContentValidator;
use App\Support\MedicalContentPolicy;
use App\Support\MedicalScanVerdict;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

/** Only guarded memory SQLite and private tmpfs objects. Mocked validators are never engine acceptance. */
class ArticleMediaTest extends TestCase
{
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private const BASE = '/api/admin/article-media';

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAYAAABOzvzpAAAAXUlEQVR4nO3QQQ0AIRAEwZWPgjOJABI+hwAETMLWo/+dqrnX37lKD6QDkB5IdwHUN54OAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAvAOmBdO0BDsIFXYfazv/IAAAAAElFTkSuQmCC';

    private function signIn(?User $user = null): User
    {
        config(['article_content.enabled' => true, 'article_content.media_enabled' => true, 'article_content.presentation_enabled' => true]);
        $user ??= User::factory()->admin()->create();
        $this->actingAs($user)->withHeader('Origin', 'http://localhost:3000')->withSession(['auth.password_confirmed_at' => time()]);

        return $user;
    }

    private function upload(): array
    {
        $context = $this->getJson(self::BASE.'/upload-context')->assertOk()->json('data');
        $file = UploadedFile::fake()->createWithContent('synthetic.png', base64_decode(self::PNG));

        return $this->post(self::BASE, ['file' => $file, 'upload_id' => $context['upload_id'], 'expires_at' => $context['expires_at'],
            'expected_revision' => $context['revision']], ['Accept' => 'application/json'])
            ->assertCreated()->json('data');
    }

    private function validators(ReservationFileScanStatus $status = ReservationFileScanStatus::Clean): void
    {
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->andReturnUsing(function ($stream) use ($status) {
            rewind($stream);

            return new MedicalScanVerdict($status, hash('sha256', stream_get_contents($stream)), '1.5.4', '28199', date(DATE_ATOM));
        });
        $this->mock(MedicalContentValidator::class)->shouldReceive('validate')->andReturn([
            'content_policy_revision' => MedicalContentPolicy::current()->revision, 'content_validator' => 'gd-2.3.3/medical-v1']);
    }

    private function act(array $resource, string $action = 'validate')
    {
        return $this->postJson(self::BASE.'/'.$resource['asset']['id'].'/actions', ['action' => $action,
            'expected_revision' => $resource['revision']]);
    }

    private function released(): array
    {
        $this->validators();

        return $this->act($this->upload())->assertOk()->assertJsonPath('data.selectable', true)->json('data');
    }

    private function draft(array $image, ?string $id = null): array
    {
        $context = $this->getJson('/api/admin/articles'.($id ? '/'.$id : '').'/write-context')->assertOk()->json('data');

        return ['slug' => 'synthetic-image-article', 'expected_revision' => $context['revision'], 'reason' => 'Synthetic image draft', 'confirmed' => true,
            'translations' => ['en' => ['title' => 'Synthetic article', 'body_html' => '<p>Text.</p><figure class="image"><img src="'.self::BASE.'/'.$image['asset']['id'].'/content" alt="Synthetic"></figure>', 'seo' => []]],
            'presentation' => ['publication' => null, 'thumbnail' => ['id' => $image['asset']['id'], 'alt' => ['en' => 'Synthetic', 'fa' => 'آزمایشی']],
                'inline' => [['id' => $image['asset']['id'], 'language' => 'en']]]];
    }

    public function test_showcase_keeps_safe_image_styles_and_every_supported_text_format(): void
    {
        $ids = ['01k7g3sjhb0000000000000001', '01k7g3sjhb0000000000000002', '01k7g3sjhb0000000000000003'];
        $images = array_map(fn ($id) => ['content_path' => self::BASE.'/'.$id.'/content'], $ids);
        $sanitizer = new \App\Services\Content\ArticleRichText;
        foreach (\Database\Seeders\Support\DemoArticleShowcase::translations($images) as $translation) {
            $safe = $sanitizer->sanitize($translation['body_html'], $ids);
            foreach (['h2', 'h3', 'h4', 'strong', 'em', 'u', 'ul', 'ol', 'blockquote', 'a', 'figcaption'] as $tag) {
                $this->assertStringContainsString('<'.$tag, $safe);
            }
            $this->assertSame(4, substr_count($safe, '<img '));
            $this->assertStringContainsString('class="image image-style-side"', $safe);
            $this->assertSame($safe, $sanitizer->sanitize($safe, $ids));
        }
        $hostile = '<figure class="image image-style-side position-fixed" style="position:fixed" onclick="evil()"><img src="'.self::BASE.'/'.$ids[0].'/content"></figure>';
        $safe = $sanitizer->sanitize($hostile, [$ids[0]]);
        $this->assertStringContainsString('class="image image-style-side"', $safe);
        $this->assertStringNotContainsString('position', $safe);
        $this->assertStringNotContainsString('onclick', $safe);
    }

    public function test_admission_is_private_quarantined_purpose_scoped_and_safe_audited(): void
    {
        $this->signIn();
        $image = $this->upload();
        $this->assertFalse($image['selectable']);
        $this->assertSame('quarantined', $image['status']);
        $this->getJson(self::BASE)->assertOk()->assertJsonCount(0, 'data.assets');
        $this->getJson(self::BASE.'?view=all')->assertOk()->assertJsonCount(1, 'data.assets');
        $this->get(self::BASE.'/'.$image['asset']['id'].'/content')->assertConflict();
        $this->assertStringNotContainsString('object_key', json_encode($image));
        $this->assertDatabaseHas('audit_events', ['action' => 'admin.article_media.uploaded']);
        $this->assertSame(0, DB::table('jobs')->count());
        $this->assertSame(0, DB::table('reservation_files')->count());
    }

    public function test_release_requires_both_current_scanner_and_decoder_proof_and_serves_exact_private_bytes(): void
    {
        $this->signIn(User::factory()->rootAdmin()->create());
        $image = $this->released();
        $this->assertSame(64, $image['asset']['width']);
        $response = $this->get(self::BASE.'/'.$image['asset']['id'].'/content')->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame(base64_decode(self::PNG), $response->streamedContent());
        $this->getJson(self::BASE.'?q=synthetic')->assertOk()->assertJsonCount(1, 'data.assets');
        $this->getJson(self::BASE.'?q=%25')->assertOk()->assertJsonCount(0, 'data.assets');
    }

    public function test_infected_or_unavailable_validation_never_releases(): void
    {
        $this->signIn();
        $this->validators(ReservationFileScanStatus::Infected);
        $image = $this->act($this->upload())->assertOk()->assertJsonPath('data.selectable', false)->json('data');
        $this->assertSame('quarantined', $image['status']);
        $this->assertDatabaseHas('audit_events', ['action' => 'admin.article_media.validation_failed']);
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->andThrow(new \RuntimeException('Unavailable'));
        $this->act($image)->assertOk()->assertJsonPath('data.selectable', false);
    }

    public function test_stale_definition_and_content_policy_evidence_block_selection_and_reads(): void
    {
        $this->signIn();
        $image = $this->released();
        $row = DB::table('article_media_assets')->first();
        $evidence = json_decode($row->validation_evidence, true);
        $evidence['scanner_database_updated_at'] = date(DATE_ATOM, time() - 172801);
        DB::table('article_media_assets')->where('id', $row->id)->update(['validation_evidence' => json_encode($evidence)]);
        $this->getJson(self::BASE.'/'.$image['asset']['id'])->assertOk()->assertJsonPath('data.selectable', false);
        $this->get(self::BASE.'/'.$image['asset']['id'].'/content')->assertConflict();
    }

    public function test_forged_metadata_and_unreleased_images_cannot_be_saved_as_article_references(): void
    {
        $this->signIn();
        $image = $this->upload();
        $this->postJson('/api/admin/articles', $this->draft($image))->assertUnprocessable();
        $body = $this->draft($image);
        $body['presentation']['thumbnail']['status'] = 'released';
        $this->postJson('/api/admin/articles', $body)->assertUnprocessable();
        $this->assertSame(0, DB::table('article_versions')->count());
    }

    public function test_exact_immutable_manifest_survives_history_while_retirement_blocks_new_promotion(): void
    {
        $this->signIn();
        $image = $this->released();
        $article = $this->postJson('/api/admin/articles', $this->draft($image))->assertCreated()->json('data');
        $this->assertSame(3, $article['working']['schema_version']);
        $this->assertSame($image['asset'], $article['working']['presentation']['thumbnail']['asset']);
        $this->assertSame(3, DB::table('article_version_media')->count());
        $this->getJson('/api/admin/articles/'.$article['id'])->assertOk();
        $this->act($image, 'retire')->assertOk()->assertJsonPath('data.selectable', false);
        $this->getJson('/api/admin/articles/'.$article['id'])->assertOk()->assertJsonPath('data.working.content_hash', $article['working']['content_hash']);
        $this->getJson('/api/admin/articles/'.$article['id'].'/action-context?action=submit')->assertOk()->assertJsonPath('data.eligible', false)
            ->assertJsonPath('data.blockers.0', 'media_not_released');
    }

    public function test_changed_object_bytes_block_serving_and_draft_reference_resolution(): void
    {
        $this->signIn();
        $image = $this->released();
        $row = DB::table('article_media_assets')->first();
        app(ArticleMediaStorage::class)->disk()->put($row->object_key, 'corrupted synthetic object');
        $this->get(self::BASE.'/'.$image['asset']['id'].'/content')->assertStatus(503);
        $this->postJson('/api/admin/articles', $this->draft($image))->assertStatus(503);
        $this->assertSame(0, DB::table('articles')->count());
    }

    public function test_password_prompt_is_unnecessary_while_role_flag_and_stale_boundaries_remain(): void
    {
        $this->signIn();
        $image = $this->upload();
        $this->withSession(['auth.password_confirmed_at' => 0]);
        $this->act($image, 'retire')->assertOk();
        $this->act($image, 'retire')->assertConflict();
        foreach ([User::factory()->doctor()->create(), User::factory()->patient()->create()] as $user) {
            $this->actingAs($user)->getJson(self::BASE)->assertForbidden();
            $this->get(self::BASE.'/'.$image['asset']['id'].'/content')->assertForbidden();
        }
        $this->signIn();
        config(['article_content.media_enabled' => false]);
        $this->getJson(self::BASE)->assertStatus(503);
    }

    public function test_admission_policy_changes_and_extra_path_fields_are_refused(): void
    {
        $this->signIn();
        $context = $this->getJson(self::BASE.'/upload-context')->assertOk()->json('data');
        $context['revision'] = str_repeat('0', 64);
        $this->post(self::BASE, ['file' => UploadedFile::fake()->createWithContent('synthetic.png', base64_decode(self::PNG)),
            'upload_id' => $context['upload_id'], 'expires_at' => $context['expires_at'], 'expected_revision' => $context['revision'],
            'reason' => 'Synthetic refusal', 'confirmed' => true], ['Accept' => 'application/json'])->assertConflict();
        $this->getJson(self::BASE.'?disk=private')->assertUnprocessable();
        $this->assertSame(0, DB::table('article_media_assets')->count());
    }

    public function test_audit_failure_rolls_back_release_and_keeps_the_private_file_quarantined(): void
    {
        $this->signIn();
        $image = $this->upload();
        $this->validators();
        $this->mock(AuditLogger::class)->shouldReceive('log')->andThrow(new \RuntimeException('Synthetic audit failure'));
        $this->act($image)->assertStatus(503);
        $this->assertDatabaseHas('article_media_assets', ['public_id' => $image['asset']['id'], 'status' => 'quarantined', 'revision' => 1]);
        $this->get(self::BASE.'/'.$image['asset']['id'].'/content')->assertConflict();
    }

    public function test_article_only_sanitization_is_idempotent_bilingual_and_manifest_bound(): void
    {
        $this->signIn();
        $image = $this->released();
        $sanitizer = new \App\Services\Content\ArticleRichText;
        $html = '<p>متن آزمایشی</p><figure class="image evil"><img src="'.self::BASE.'/'.$image['asset']['id'].'/content" onerror="alert(1)" alt="آزمایشی"><figcaption>عنوان تصویر</figcaption></figure><img src="https://evil.test/tracker"><script>alert(1)</script>';
        $safe = $sanitizer->sanitize($html, [$image['asset']['id']]);
        $this->assertStringContainsString('متن آزمایشی', $safe);
        $this->assertStringNotContainsString('evil.test', $safe);
        $this->assertStringNotContainsString('onerror', $safe);
        $this->assertSame($safe, $sanitizer->sanitize($safe, [$image['asset']['id']]));
        $this->expectException(\InvalidArgumentException::class);
        $sanitizer->sanitize($html, []);
    }

    public function test_tampered_version_media_links_fail_closed_without_rewriting_content(): void
    {
        $this->signIn();
        $image = $this->released();
        $article = $this->postJson('/api/admin/articles', $this->draft($image))->assertCreated()->json('data');
        DB::table('article_version_media')->where('usage', 'inline')->delete();
        $this->getJson('/api/admin/articles/'.$article['id'])->assertStatus(503);
        $this->assertDatabaseHas('article_versions', ['content_hash' => $article['working']['content_hash']]);
    }

    public function test_ordinary_publication_edit_and_copy_preserve_exact_media_and_published_history(): void
    {
        $this->signIn();
        $image = $this->released();
        $body = $this->draft($image) + ['intent' => 'publish', 'editorial_confirmed' => true];
        $article = $this->postJson('/api/admin/articles', $body)->assertCreated()->json('data');
        $original = $article['working'];
        $this->assertSame('published', $article['working_state']);
        $body = $this->draft($image, $article['id']);
        $body['translations']['en']['title'] = 'Changed synthetic title';
        $edited = $this->putJson('/api/admin/articles/'.$article['id'], $body)->assertOk()->json('data');
        $this->assertSame($original['content_hash'], $edited['published']['content_hash']);
        $context = $this->getJson('/api/admin/articles/'.$article['id'].'/action-context?action=copy_version&source_version_id='.$original['id'])
            ->assertOk()->json('data');
        $copy = $this->postJson('/api/admin/articles/'.$article['id'].'/actions', ['action' => 'copy_version', 'expected_revision' => $context['revision'],
            'expected_version' => 2, 'expected_hash' => $edited['working']['content_hash'], 'source_version_id' => $original['id'], 'source_hash' => $original['content_hash'],
            'reason' => 'Synthetic version recovery', 'confirmed' => true])->assertOk()->json('data');
        $this->assertSame($original['content_hash'], $copy['working']['content_hash']);
        $this->assertSame($original['presentation'], $copy['working']['presentation']);
        $this->assertSame(9, DB::table('article_version_media')->count());
        $this->assertSame($original['id'], $copy['published']['id']);
    }

    public function test_stored_json_object_order_does_not_change_exact_media_identity_or_hash(): void
    {
        $this->signIn();
        $image = $this->released();
        $article = $this->postJson('/api/admin/articles', $this->draft($image))->assertCreated()->json('data');
        $row = DB::table('article_versions')->first();
        $presentation = json_decode($row->presentation, true);
        $presentation['thumbnail']['asset'] = array_reverse($presentation['thumbnail']['asset'], true);
        $presentation['inline'][0]['asset'] = array_reverse($presentation['inline'][0]['asset'], true);
        DB::table('article_versions')->where('id', $row->id)->update(['presentation' => json_encode($presentation)]);
        $this->getJson('/api/admin/articles/'.$article['id'])->assertOk()->assertJsonPath('data.working.content_hash', $article['working']['content_hash']);
    }

    public function test_upload_and_release_need_no_recent_password_or_client_attestation_but_remain_audited(): void
    {
        $this->signIn();
        $this->withSession(['auth.password_confirmed_at' => 0]);
        $image = $this->released();
        $this->assertTrue($image['selectable']);
        $events = DB::table('audit_events')->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertSame('File Manager editorial image action: uploaded.', $events[0]->reason);
        $this->assertSame('File Manager editorial image action: validated.', $events[1]->reason);
        $this->assertSame(0, session('auth.password_confirmed_at'));
        $this->assertSame(0, DB::table('jobs')->count());
    }

    public function test_role_revocation_during_processing_prevents_release_after_scanning(): void
    {
        $actor = $this->signIn();
        $image = $this->upload();
        $this->validators();
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->andReturnUsing(function ($stream) use ($actor) {
            $actor->syncRoles('patient');
            rewind($stream);

            return new MedicalScanVerdict(ReservationFileScanStatus::Clean, hash('sha256', stream_get_contents($stream)), '1.5.4', '28199', date(DATE_ATOM));
        });
        $this->act($image)->assertForbidden();
        $this->assertDatabaseHas('article_media_assets', ['public_id' => $image['asset']['id'], 'status' => 'quarantined', 'revision' => 1]);
        $this->assertSame(1, DB::table('audit_events')->count());
    }
}
