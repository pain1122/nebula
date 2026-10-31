<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use RuntimeException;

class DemoQuestionnairePanelContractTest extends PublicQuestionnaireContractTest
{
    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_QUESTIONNAIRE_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated questionnaire acceptance only.');
        }
        parent::setUp();
    }

    public function createApplication()
    {
        $environment = '/tmp/checkupino-upload-tests';
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
            || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL') || posix_geteuid() !== 33
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || getenv('LARAVEL_STORAGE_PATH') !== $environment
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Questionnaire tests require isolated SQLite and skip project environment/cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->make(Kernel::class)->bootstrap();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective SQLite guard failed before schema setup.');
        }

        return $app;
    }

    public function test_published_definition_exposes_actual_version_without_scores(): void
    {
        $questionnaire = Questionnaire::create([
            'title' => 'Synthetic version', 'slug' => 'synthetic-version',
            'status' => 'published', 'version' => 7, 'published_at' => now(),
        ]);
        $question = $questionnaire->questions()->create(['text' => 'Synthetic?', 'sort_order' => 1]);
        $question->choices()->create(['text' => 'Yes', 'score' => 2, 'sort_order' => 1]);
        $this->getJson('/api/questionnaires/synthetic-version')->assertOk()
            ->assertJsonPath('version', 7)->assertJsonMissingPath('questions.0.choices.0.score')
            ->assertJsonMissingPath('recommendations');
        $questionnaire->update(['status' => 'draft']);
        $this->getJson('/api/questionnaires/synthetic-version')->assertNotFound();
    }

    public function test_authenticated_submission_retains_ownership_and_has_no_guest_lead(): void
    {
        $user = User::factory()->create();
        $questionnaire = Questionnaire::create([
            'title' => 'Synthetic ownership', 'slug' => 'synthetic-ownership',
            'status' => 'published', 'version' => 7, 'published_at' => now(),
        ]);
        $question = $questionnaire->questions()->create(['text' => 'Synthetic?', 'sort_order' => 1]);
        $choice = $question->choices()->create(['text' => 'Yes', 'score' => 2, 'sort_order' => 1]);
        $this->actingAs($user, 'sanctum');
        $response = $this->postJson('/api/questionnaires/synthetic-ownership/submit', [
            'submitter_name' => 'Synthetic patient', 'submitter_phone' => '09120000000',
            'answers' => [['question_id' => $question->id, 'choice_id' => $choice->id]],
        ])->assertOk()->assertJsonPath('total_score', 2)->assertJsonPath('recommendation', null);
        $submission = QuestionnaireSubmission::where('public_id', $response->json('submission_id'))->sole();
        $this->assertSame($user->id, $submission->user_id);
        $this->assertSame(7, $submission->questionnaire_version);
        $this->assertNull($submission->guest_token_hash);
        $this->assertNull($submission->guest_phone);
        $this->assertDatabaseCount('leads', 0);
    }
}
