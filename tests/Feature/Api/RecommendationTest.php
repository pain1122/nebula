<?php

namespace Tests\Feature\Api;

use App\Enums\ReservationFileScanStatus;
use App\Models\DoctorProfile;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ClamdScanner;
use App\Services\Content\ArticleMediaStorage;
use App\Services\Health\HealthCatalog;
use App\Services\Health\PatientHealthService;
use App\Services\MedicalContentValidator;
use App\Support\MedicalContentPolicy;
use App\Support\MedicalScanVerdict;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Support\ArticleReadFixtures;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

/** Mechanics with invented records/designations only; never actual clinical approval. */
class RecommendationTest extends TestCase
{
    use ArticleReadFixtures;
    use IsolatedArticleApplication;
    use RefreshDatabase;

    private User $root;

    private User $admin;

    private User $doctor;

    private object $article;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeader('Origin', 'http://localhost:3000');
        $this->travelTo(Carbon::parse('2026-11-05T12:00:00+03:30'));
        config(['recommendations.enabled' => true, 'recommendations.authoring_enabled' => true, 'article_content.enabled' => true, 'patient_health.enabled' => true]);
        $this->root = User::factory()->rootAdmin()->create();
        $this->admin = User::factory()->admin()->create();
        $this->doctor = User::factory()->doctor()->create();
        DoctorProfile::factory()->create(['user_id' => $this->doctor->id, 'verified' => true]);
        $this->article = $this->publishFixture($this->articleFixture($this->admin), $this->admin);
    }

    private function content(): array
    {
        return ['definition' => ['schema_version' => 1, 'health_catalog_version' => HealthCatalog::VERSION,
            'include' => ['field' => 'smoking', 'operator' => 'eq', 'value' => 'yes', 'max_age_days' => 30], 'exclude' => null],
            'translations' => ['en' => ['title' => 'Synthetic matching', 'explanation' => 'Synthetic private explanation.'],
                'fa' => ['title' => 'تطبیق ساختگی', 'explanation' => 'توضیح خصوصی ساختگی.']],
            'population' => ['en' => 'Invented software fixtures only.', 'fa' => 'فقط داده‌های ساختگی آزمون.'],
            'limitations' => ['en' => 'No medical criteria or approval.', 'fa' => 'بدون معیار یا تأیید پزشکی واقعی.'],
            'sources' => [['label' => 'Synthetic reference', 'url' => 'https://example.com/synthetic-test']],
            'targets' => [$this->article->public_id], 'priority' => 10];
    }

    private function board(User $actor): array
    {
        $prefix = $actor->hasAnyRole(['root-admin', 'admin']) ? 'admin' : 'doctor';

        return $this->actingAs($actor)->getJson('/api/'.$prefix.'/recommendation-rules')->assertOk()->json('data');
    }

    private function ruleView(User $actor, string $id): array
    {
        $prefix = $actor->hasAnyRole(['root-admin', 'admin']) ? 'admin' : 'doctor';

        return $this->actingAs($actor)->getJson('/api/'.$prefix.'/recommendation-rules/'.$id)->assertOk()->json('data');
    }

    private function draft(string $slug = 'synthetic-rule'): string
    {
        $revision = $this->board($this->admin)['create_revision'];

        return $this->postJson('/api/admin/recommendation-rules', ['slug' => $slug, 'content' => $this->content(),
            'expected_revision' => $revision, 'action_key' => (string) Str::uuid()])->assertOk()->json('data.id');
    }

    private function action(User $actor, string $id, string $action, array $extra = []): array
    {
        $view = $this->ruleView($actor, $id);
        $prefix = $actor->hasAnyRole(['admin', 'root-admin']) ? 'admin' : 'doctor';
        $body = ['action' => $action, 'expected_revision' => $view['contexts'][$action], 'action_key' => (string) Str::uuid(), ...$extra];
        $this->postJson('/api/'.$prefix.'/recommendation-rules/'.$id.'/actions', $body)->assertOk();

        return $body;
    }

    private function designate(string $until = '2026-12-31T12:00'): string
    {
        $revision = $this->board($this->root)['grant_revision'];

        return $this->withSession(['auth.password_confirmed_at' => time()])->postJson('/api/admin/recommendation-rules/reviewer-grants', [
            'expected_revision' => $revision, 'action_key' => (string) Str::uuid(), 'confirmed' => true,
            'reviewer_id' => $this->doctor->public_id, 'evidence_ref' => 'synthetic-test-reference-only',
            'valid_until_local' => $until,
        ])->assertOk()->json('data.id');
    }

    private function published(): array
    {
        $id = $this->draft();
        $grant = $this->designate();
        $this->action($this->admin, $id, 'submit', ['reviewer_id' => $this->doctor->public_id]);
        $this->action($this->doctor, $id, 'approve', ['assessment' => 'Synthetic source-test assessment, not clinical review.',
            'attested' => true, 'valid_until_local' => '2026-11-20T12:00']);
        $this->action($this->admin, $id, 'publish');

        return [$id, $grant];
    }

    private function patient(bool $answer = true): User
    {
        $patient = User::factory()->patient()->create();
        if ($answer) {
            $health = app(PatientHealthService::class);
            $revision = $health->read($patient)['revision'];
            $request = Request::create('/synthetic', 'PUT');
            $request->setUserResolver(fn () => $patient);
            $health->save($request, $patient, ['expected_revision' => $revision, 'catalog_version' => HealthCatalog::VERSION,
                'confirmed' => true, 'changes' => ['smoking' => 'yes'], 'measurements' => []]);
        }

        return $patient;
    }

    public function test_feature_disabled_never_queries_private_health_and_keeps_general_reading(): void
    {
        $patient = $this->patient(false);
        config(['recommendations.enabled' => false]);
        $this->mock(PatientHealthService::class)->shouldNotReceive('read');
        $this->actingAs($patient)->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson('/api/my/articles')->assertOk();
    }

    public function test_ordinary_synthetic_lifecycle_and_owner_response_exclude_private_staff_data(): void
    {
        [$id] = $this->published();
        $patient = $this->patient();
        $response = $this->actingAs($patient)->getJson('/api/my/recommendations?language=fa')->assertOk()
            ->assertJsonPath('data.state', 'matched')->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.explanation_language', 'fa')
            ->assertJsonPath('data.items.0.article.id', $this->article->public_id);
        $response->assertDontSee('assessment')->assertDontSee('smoking')->assertDontSee('synthetic-test-reference-only');
        $this->assertSame(1, DB::table('recommendation_rule_reviews')->count());
        $this->assertSame(1, DB::table('recommendation_rule_versions')->count());
        $this->assertSame(0, DB::table('jobs')->count());
        $this->actingAs($this->admin)->getJson('/api/my/recommendations')->assertForbidden();
        $this->actingAs($patient)->getJson('/api/my/recommendations?patient_id='.$this->admin->public_id)->assertUnprocessable();
        $this->actingAs($this->patient(false))->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'insufficient_information');
    }

    public function test_no_unreviewed_publish_and_no_reviewer_privilege_from_doctor_or_root_role_alone(): void
    {
        $id = $this->draft();
        $view = $this->ruleView($this->admin, $id);
        $this->postJson('/api/admin/recommendation-rules/'.$id.'/actions', ['action' => 'publish', 'expected_revision' => $view['contexts']['publish'],
            'action_key' => (string) Str::uuid()])->assertConflict();
        $this->actingAs($this->doctor)->getJson('/api/doctor/recommendation-rules/'.$id)->assertForbidden();
        $this->actingAs($this->root)->postJson('/api/doctor/recommendation-rules/'.$id.'/actions', [])->assertForbidden();
        $this->assertDatabaseHas('recommendation_rules', ['public_id' => $id, 'published_version' => null]);
    }

    public function test_new_article_draft_preserves_match_but_new_publication_withdraws_eligibility(): void
    {
        $this->published();
        $patient = $this->patient();
        $new = $this->appendArticleFixture($this->article, $this->admin);
        $this->actingAs($patient)->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'matched');
        $this->publishFixture($new, $this->admin);
        $this->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable')->assertJsonCount(0, 'data.items');
    }

    public function test_clinician_withdrawal_is_append_only_and_immediately_hides_suggestions(): void
    {
        [$id] = $this->published();
        $review = DB::table('recommendation_rule_reviews')->first();
        $this->action($this->doctor, $id, 'withdraw', ['review_id' => $review->public_id, 'assessment' => 'Withdraw synthetic approval.']);
        $this->assertSame(2, DB::table('recommendation_rule_reviews')->count());
        $this->assertDatabaseHas('recommendation_rule_reviews', ['id' => $review->id, 'outcome' => 'approved']);
        $this->actingAs($this->patient())->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable');
    }

    public function test_grant_revocation_prevents_evaluation_without_decrypting_health(): void
    {
        [$id, $grant] = $this->published();
        $patient = $this->patient(false);
        $board = $this->board($this->root);
        $row = collect($board['grants'])->firstWhere('id', $grant);
        $this->withSession(['auth.password_confirmed_at' => time()])->postJson('/api/admin/recommendation-rules/reviewer-grants/'.$grant.'/revoke', [
            'expected_revision' => $row['revoke_revision'], 'action_key' => (string) Str::uuid(), 'confirmed' => true,
        ])->assertOk();
        $this->mock(PatientHealthService::class)->shouldNotReceive('read');
        $this->actingAs($patient)->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable');
    }

    public function test_same_action_key_replays_without_new_rows_and_rejects_payload_substitution(): void
    {
        $body = ['slug' => 'synthetic-rule', 'content' => $this->content(), 'expected_revision' => $this->board($this->admin)['create_revision'],
            'action_key' => (string) Str::uuid()];
        $id = $this->postJson('/api/admin/recommendation-rules', $body)->assertOk()->json('data.id');
        $this->postJson('/api/admin/recommendation-rules', $body)->assertOk()->assertJsonPath('data.id', $id);
        $this->assertSame(1, DB::table('recommendation_rule_versions')->count());
        $this->assertSame(1, DB::table('audit_events')->where('action', 'recommendation.draft_saved')->count());
        $body['slug'] = 'different-rule';
        $this->postJson('/api/admin/recommendation-rules', $body)->assertConflict();
    }

    public function test_late_audit_failure_rolls_back_the_entire_new_rule(): void
    {
        $body = ['slug' => 'synthetic-rule', 'content' => $this->content(), 'expected_revision' => $this->board($this->admin)['create_revision'],
            'action_key' => (string) Str::uuid()];
        $this->mock(AuditLogger::class)->shouldReceive('log')->andThrow(new RuntimeException('Synthetic late failure'));
        $this->postJson('/api/admin/recommendation-rules', $body)->assertStatus(503);
        $this->assertSame(0, DB::table('recommendation_rules')->count());
        $this->assertSame(0, DB::table('recommendation_rule_versions')->count());
        $this->assertSame(0, (int) DB::table('recommendation_catalog_state')->value('revision'));
    }

    public function test_unverified_or_deleted_doctors_cannot_receive_a_designation(): void
    {
        DB::table('doctor_profiles')->where('user_id', $this->doctor->id)->update(['verified' => false]);
        $body = ['expected_revision' => $this->board($this->root)['grant_revision'], 'action_key' => (string) Str::uuid(), 'confirmed' => true,
            'reviewer_id' => $this->doctor->public_id, 'evidence_ref' => 'synthetic-only', 'valid_until_local' => '2026-12-31T12:00'];
        $this->withSession(['auth.password_confirmed_at' => time()])->postJson('/api/admin/recommendation-rules/reviewer-grants', $body)->assertConflict();
        $this->assertSame(0, DB::table('recommendation_reviewer_grants')->count());
    }

    public function test_authoring_can_be_enabled_without_personal_matching_or_a_health_read(): void
    {
        config(['recommendations.enabled' => false]);
        $this->draft();
        $this->mock(PatientHealthService::class)->shouldNotReceive('read');
        $this->actingAs($this->patient(false))->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable');
    }

    public function test_designation_requires_recent_password_and_keeps_evidence_out_of_responses_and_audits(): void
    {
        $revision = $this->board($this->root)['grant_revision'];
        $body = ['expected_revision' => $revision, 'action_key' => (string) Str::uuid(), 'confirmed' => true,
            'reviewer_id' => $this->doctor->public_id, 'evidence_ref' => 'synthetic-private-evidence', 'valid_until_local' => '2026-12-31T12:00'];
        $this->withSession(['auth.password_confirmed_at' => 0])->postJson('/api/admin/recommendation-rules/reviewer-grants', $body)->assertStatus(423);
        $this->assertDatabaseCount('recommendation_reviewer_grants', 0);
        $this->withSession(['auth.password_confirmed_at' => time()])->postJson('/api/admin/recommendation-rules/reviewer-grants', $body)->assertOk()->assertDontSee('synthetic-private-evidence');
        $this->assertCount(1, $this->board($this->root)['designation_candidates']);
        $this->assertSame([], $this->board($this->admin)['designation_candidates']);
        $this->assertStringNotContainsString('synthetic-private-evidence', json_encode(DB::table('audit_events')->get(), JSON_THROW_ON_ERROR));
    }

    public function test_a_doctor_cannot_review_a_version_they_authored_even_with_admin_and_reviewer_access(): void
    {
        $this->doctor->assignRole('admin');
        $this->designate();
        $body = ['slug' => 'self-authored-synthetic', 'content' => $this->content(), 'expected_revision' => $this->board($this->doctor)['create_revision'], 'action_key' => (string) Str::uuid()];
        $id = $this->postJson('/api/admin/recommendation-rules', $body)->assertOk()->json('data.id');
        $view = $this->ruleView($this->doctor, $id);
        $this->postJson('/api/admin/recommendation-rules/'.$id.'/actions', ['action' => 'submit', 'reviewer_id' => $this->doctor->public_id,
            'expected_revision' => $view['contexts']['submit'], 'action_key' => (string) Str::uuid()])->assertConflict();
        $this->assertDatabaseCount('recommendation_rule_reviews', 0);
    }

    public function test_changed_rule_draft_keeps_old_publication_and_blocks_unreviewed_replacement(): void
    {
        [$id] = $this->published();
        $view = $this->ruleView($this->admin, $id);
        $content = $this->content();
        $content['translations']['en']['explanation'] = 'Unreviewed replacement explanation.';
        $this->putJson('/api/admin/recommendation-rules/'.$id, ['slug' => $view['slug'], 'content' => $content,
            'expected_revision' => $view['contexts']['save'], 'action_key' => (string) Str::uuid()])->assertOk();
        $fresh = $this->ruleView($this->admin, $id);
        $this->assertSame(2, $fresh['working']['version']);
        $this->assertSame(1, $fresh['published_version']);
        $this->assertFalse($fresh['can_publish']);
        $this->actingAs($this->patient())->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.items.0.explanation', 'Synthetic private explanation.');
        // A historical reviewer sees their reviewed version, never the new unassigned draft.
        $historical = $this->ruleView($this->doctor, $id);
        $this->assertSame(1, $historical['working']['version']);
        $this->assertSame('Synthetic private explanation.', $historical['working']['translations']['en']['explanation']);
    }

    public function test_profile_revocation_and_review_expiry_prevent_health_decryption(): void
    {
        $this->published();
        $patient = $this->patient(false);
        DB::table('doctor_profiles')->where('user_id', $this->doctor->id)->update(['verified' => false]);
        $this->mock(PatientHealthService::class)->shouldNotReceive('read');
        $this->actingAs($patient)->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable');
        DB::table('doctor_profiles')->where('user_id', $this->doctor->id)->update(['verified' => true]);
        $this->travelTo(Carbon::parse('2026-11-20T12:00:00+03:30'));
        $this->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable');
    }

    public function test_preview_is_exact_and_assigned_only_without_staff_media_inventory_access(): void
    {
        $id = $this->draft();
        $this->designate();
        $this->action($this->admin, $id, 'submit', ['reviewer_id' => $this->doctor->public_id]);
        $original = $this->ruleView($this->doctor, $id)['target_previews'][0];
        $this->appendArticleFixture($this->article, $this->admin, title: 'Unreviewed private replacement');
        $view = $this->ruleView($this->doctor, $id);
        $this->assertSame($original, $view['target_previews'][0]);
        $this->assertSame($this->article->public_id, $original['id']);
        $this->assertSame(1, $original['version']);
        $this->assertSame(['en', 'fa'], $original['languages']);
        $this->actingAs($this->doctor)->getJson('/api/admin/article-media')->assertForbidden();
        $other = User::factory()->doctor()->create();
        $this->actingAs($other)->getJson('/api/doctor/recommendation-rules/'.$id)->assertForbidden();
        $assetId = strtolower((string) Str::ulid());
        $this->getJson('/api/doctor/recommendation-rules/'.$id.'/media/'.$assetId.'?article_id='.$this->article->public_id.'&rule_version=1&language=en')->assertForbidden();
        $this->actingAs($this->doctor)->getJson('/api/doctor/recommendation-rules/'.$id.'/media/'.$assetId.'?article_id='.$this->article->public_id.'&rule_version=1&language=en')->assertNotFound();
    }

    public function test_rule_version_hash_is_independent_of_mysql_object_key_order(): void
    {
        $id = $this->draft();
        $version = DB::table('recommendation_rule_versions')->first();
        foreach (['definition', 'translations', 'population', 'limitations'] as $field) {
            $value = json_decode($version->{$field}, true, flags: JSON_THROW_ON_ERROR);
            DB::table('recommendation_rule_versions')->where('id', $version->id)->update([$field => json_encode(array_reverse($value, true), JSON_THROW_ON_ERROR)]);
        }
        $this->assertSame($version->content_hash, $this->ruleView($this->admin, $id)['working']['content_hash']);
        DB::table('recommendation_rule_versions')->where('id', $version->id)->update(['priority' => 11]);
        $this->actingAs($this->admin)->getJson('/api/admin/recommendation-rules/'.$id)->assertStatus(503);
    }

    public function test_assigned_image_delivery_checks_exact_binding_and_bytes_without_inventory_privilege(): void
    {
        // Validator doubles exercise authorization/integrity mechanics, never real engine acceptance.
        // Editorial evidence deliberately uses the native clock; align this one fixture's
        // application clock instead of making a fixed November5 definition stale after two days.
        $this->travelTo(Carbon::parse(date(DATE_ATOM)));
        config(['article_content.media_enabled' => true, 'article_content.presentation_enabled' => true]);
        $bytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAYAAABOzvzpAAAAXUlEQVR4nO3QQQ0AIRAEwZWPgjOJABI+hwAETMLWo/+dqrnX37lKD6QDkB5IdwHUN54OAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAvAOmBdO0BDsIFXYfazv/IAAAAAElFTkSuQmCC');
        $this->mock(ClamdScanner::class)->shouldReceive('scan')->andReturnUsing(function ($stream) {
            rewind($stream);

            return new MedicalScanVerdict(ReservationFileScanStatus::Clean, hash('sha256', stream_get_contents($stream)), '1.5.4', '28199', now('UTC')->toIso8601String());
        });
        $this->mock(MedicalContentValidator::class)->shouldReceive('validate')->andReturn([
            'content_policy_revision' => MedicalContentPolicy::current()->revision, 'content_validator' => 'gd-2.3.3/medical-v1']);
        $this->actingAs($this->admin);
        $context = $this->getJson('/api/admin/article-media/upload-context')->assertOk()->json('data');
        $image = $this->post('/api/admin/article-media', ['file' => UploadedFile::fake()->createWithContent('synthetic.png', $bytes),
            'upload_id' => $context['upload_id'], 'expires_at' => $context['expires_at'], 'expected_revision' => $context['revision']], ['Accept' => 'application/json'])->assertCreated()->json('data');
        $image = $this->postJson('/api/admin/article-media/'.$image['asset']['id'].'/actions', ['action' => 'validate', 'expected_revision' => $image['revision']])->assertOk()->json('data');
        $assetId = $image['asset']['id'];
        $write = $this->getJson('/api/admin/articles/write-context')->assertOk()->json('data');
        $article = $this->postJson('/api/admin/articles', ['slug' => 'synthetic-reviewed-image', 'expected_revision' => $write['revision'],
            'reason' => 'Synthetic source test', 'confirmed' => true, 'intent' => 'publish', 'editorial_confirmed' => true,
            'translations' => ['en' => ['title' => 'Synthetic reviewed image', 'body_html' => '<p>Synthetic text.</p><figure class="image"><img src="/api/admin/article-media/'.$assetId.'/content" alt="Synthetic"></figure>', 'seo' => []]],
            'presentation' => ['publication' => null, 'thumbnail' => ['id' => $assetId, 'alt' => ['en' => 'Synthetic', 'fa' => '']], 'inline' => [['id' => $assetId, 'language' => 'en']]]])->assertCreated()->json('data');
        $this->article = DB::table('articles')->where('public_id', $article['id'])->first();
        $id = $this->draft();
        $this->designate(now('Asia/Tehran')->addDays(30)->format('Y-m-d\TH:i'));
        $this->action($this->admin, $id, 'submit', ['reviewer_id' => $this->doctor->public_id]);
        $view = $this->ruleView($this->doctor, $id);
        $this->assertContains(['id' => $assetId, 'language' => 'en'], $view['target_previews'][0]['images']);
        $path = '/api/doctor/recommendation-rules/'.$id.'/media/'.$assetId.'?article_id='.$article['id'].'&rule_version=1&language=en';
        $response = $this->get($path)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame($bytes, $response->streamedContent());
        $this->get(str_replace('rule_version=1', 'rule_version=2', $path))->assertForbidden();
        $this->get(str_replace('language=en', 'language=fa', $path))->assertNotFound();
        $row = DB::table('article_media_assets')->where('public_id', $assetId)->first();
        app(ArticleMediaStorage::class)->disk()->put($row->object_key, str_repeat('x', strlen($bytes)));
        $this->get($path)->assertStatus(503);
        $this->postJson('/api/doctor/recommendation-rules/'.$id.'/actions', ['action' => 'approve', 'expected_revision' => $view['contexts']['approve'],
            'action_key' => (string) Str::uuid(), 'assessment' => 'Synthetic assessment', 'attested' => true, 'valid_until_local' => now('Asia/Tehran')->addDays(7)->format('Y-m-d\TH:i')])->assertStatus(503);
        $this->assertDatabaseCount('recommendation_rule_reviews', 0);
        $this->assertDatabaseCount('jobs', 0);
    }

    public function test_synthetic_preview_cannot_query_patient_health_or_an_unassigned_version(): void
    {
        $id = $this->draft();
        $this->mock(PatientHealthService::class)->shouldNotReceive('read');
        $this->actingAs($this->admin)->getJson('/api/admin/recommendation-rules/'.$id.'/preview?case=recent')->assertOk()
            ->assertJsonPath('data.outcome', 'no_match')->assertJsonPath('data.case', 'recent')->assertDontSee('provenance');
        $this->getJson('/api/admin/recommendation-rules/'.$id.'/preview?case=missing')->assertOk()->assertJsonPath('data.outcome', 'insufficient_data');
        $this->getJson('/api/admin/recommendation-rules/'.$id.'/preview?case=recent&patient_id='.$this->admin->public_id)->assertUnprocessable();
        $this->actingAs($this->doctor)->getJson('/api/doctor/recommendation-rules/'.$id.'/preview?case=recent')->assertForbidden();
        $this->designate();
        $this->action($this->admin, $id, 'submit', ['reviewer_id' => $this->doctor->public_id]);
        $this->actingAs($this->doctor)->getJson('/api/doctor/recommendation-rules/'.$id.'/preview?case=stale')->assertOk()->assertJsonPath('data.outcome', 'insufficient_data');
        $this->assertDatabaseCount('recommendation_rule_reviews', 0);
    }

    public function test_withdrawal_only_supersedes_its_exact_approval_without_overriding_another_reviewers_publication(): void
    {
        [$id] = $this->published();
        $first = $this->doctor;
        $firstReview = DB::table('recommendation_rule_reviews')->first();
        $this->doctor = User::factory()->doctor()->create();
        DoctorProfile::factory()->create(['user_id' => $this->doctor->id, 'verified' => true]);
        $this->designate();
        $this->action($this->admin, $id, 'submit', ['reviewer_id' => $this->doctor->public_id]);
        $this->action($this->doctor, $id, 'approve', ['assessment' => 'Second synthetic independent assessment.', 'attested' => true, 'valid_until_local' => '2026-11-20T12:00']);
        $this->action($this->admin, $id, 'publish');
        $secondReview = DB::table('recommendation_rule_reviews')->where('reviewer_user_id', $this->doctor->id)->first();
        $this->action($first, $id, 'withdraw', ['review_id' => $firstReview->public_id, 'assessment' => 'Withdraw only my old approval.']);
        $patient = $this->patient();
        $this->actingAs($patient)->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'matched');
        $this->action($this->doctor, $id, 'withdraw', ['review_id' => $secondReview->public_id, 'assessment' => 'Withdraw my current approval.']);
        $this->actingAs($patient)->getJson('/api/my/recommendations')->assertOk()->assertJsonPath('data.state', 'unavailable');
        $this->assertDatabaseCount('recommendation_rule_reviews', 4);
    }
}
