<?php

namespace Tests\Feature\Api;

use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class PatientQuestionnaireHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $environment = getenv('LARAVEL_STORAGE_PATH');
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
            || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL') || posix_geteuid() !== 33
            || ! is_string($environment) || ! str_starts_with($environment, '/tmp/checkupino-questionnaire-history-')
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')
            || ! is_file($environment.'/empty.environment') || filesize($environment.'/empty.environment') !== 0) {
            throw new RuntimeException('History tests require explicit isolated SQLite, UID33 and no project environment/cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->loadEnvironmentFrom('empty.environment');
        $app->make(Kernel::class)->bootstrap();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective SQLite guard failed before schema setup.');
        }

        return $app;
    }

    private function actor(string $role = 'patient'): User
    {
        $user = User::factory()->create();
        $user->syncRoles([$role]);

        return $user;
    }

    public function test_only_owned_history_is_listed_with_bounded_pagination_and_no_private_fields(): void
    {
        $owner = $this->actor();
        $own = QuestionnaireSubmission::factory()->count(13)->create(['user_id' => $owner->id]);
        $other = QuestionnaireSubmission::factory()->create();
        $guest = QuestionnaireSubmission::factory()->create(['user_id' => null]);
        $this->actingAs($owner, 'sanctum');
        $response = $this->getJson('/api/my/questionnaire-submissions?user_id='.$other->user_id.'&per_page=1000')
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.owner_id', $owner->id)->assertJsonCount(12, 'data.items')
            ->assertJsonPath('meta.pagination.total', 13)->assertJsonPath('meta.pagination.last_page', 2);
        $this->assertSame($own->last()->public_id, $response->json('data.items.0.public_id'));
        $this->assertSame(['public_id', 'questionnaire_title', 'questionnaire_version', 'submitted_at', 'total_score', 'result_title'], array_keys($response->json('data.items.0')));
        $this->getJson('/api/my/questionnaire-submissions?page=2')->assertOk()->assertJsonCount(1, 'data.items');
        $this->getJson('/api/my/questionnaire-submissions?page=0')->assertUnprocessable();
        $this->getJson('/api/my/questionnaire-submissions/'.$other->public_id)->assertNotFound();
        $this->getJson('/api/my/questionnaire-submissions/'.$guest->public_id)->assertNotFound();
        $this->getJson('/api/my/questionnaire-submissions/'.$own->first()->id)->assertNotFound();
    }

    public function test_saved_snapshot_survives_definition_changes_and_archive_without_exposing_internal_fields(): void
    {
        $owner = $this->actor();
        $submission = QuestionnaireSubmission::factory()->create([
            'user_id' => $owner->id, 'questionnaire_title' => 'Original title', 'questionnaire_version' => 7,
            'answers_json' => [['question_id' => 1, 'choice_id' => 2, 'score' => 5, 'question_text' => 'Original question?', 'choice_text' => 'Original answer']],
            'result_body_html' => '<p>Original recommendation</p>', 'submitter_phone' => 'PRIVATE',
        ]);
        $submission->questionnaire->update(['title' => 'Revised title', 'version' => 8]);
        $submission->questionnaire->delete();
        $response = $this->actingAs($owner, 'sanctum')->getJson('/api/my/questionnaire-submissions/'.$submission->public_id)
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.questionnaire_title', 'Original title')
            ->assertJsonPath('data.questionnaire_version', 7)->assertJsonPath('data.answers_available', true)
            ->assertJsonPath('data.answers.0.question_text', 'Original question?')
            ->assertJsonPath('data.answers.0.choice_text', 'Original answer')
            ->assertJsonPath('data.result_body_html', '<p>Original recommendation</p>');
        foreach (['submitter_phone', 'guest_phone', 'submitter_name', 'guest_token_hash', 'meta', 'user_id', 'answers_json'] as $field) {
            $response->assertJsonMissingPath('data.'.$field);
        }
        $response->assertJsonMissingPath('data.answers.0.score');
        $submission->forceFill(['retention_until' => now()->subSecond()])->save();
        $this->getJson('/api/my/questionnaire-submissions/'.$submission->public_id)->assertOk()
            ->assertJsonPath('data.answers_available', false)->assertJsonPath('data.answers', [])
            ->assertJsonPath('data.result_body_html', null);
        $submission->delete();
        $this->getJson('/api/my/questionnaire-submissions/'.$submission->public_id)->assertNotFound();
    }

    public function test_guests_staff_doctors_and_inactive_or_revoked_patients_cannot_read_history(): void
    {
        $submission = QuestionnaireSubmission::factory()->create();
        $paths = ['/api/my/questionnaire-submissions', '/api/my/questionnaire-submissions/'.$submission->public_id];
        foreach ($paths as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        foreach (['doctor', 'admin', 'root-admin'] as $role) {
            $this->actingAs($this->actor($role), 'sanctum');
            foreach ($paths as $path) {
                $this->getJson($path)->assertForbidden();
            }
        }
        $owner = $submission->user_id;
        $patient = User::findOrFail($owner);
        $this->actingAs($patient, 'sanctum');
        $patient->syncRoles(['doctor']);
        foreach ($paths as $path) {
            $this->getJson($path)->assertForbidden();
        }
        $patient->syncRoles(['patient']);
        User::findOrFail($patient->id)->forceFill(['account_state' => 'suspended'])->save();
        foreach ($paths as $path) {
            $this->getJson($path)->assertForbidden();
        }
    }
}
