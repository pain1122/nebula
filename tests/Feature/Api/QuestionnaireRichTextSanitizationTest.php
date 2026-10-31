<?php

namespace Tests\Feature\Api;

use App\Models\Questionnaire;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class QuestionnaireRichTextSanitizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_create_and_update_store_only_allowlisted_rich_html(): void
    {
        $admin = User::factory()->admin()->create();
        $slug = 'sanitized-questionnaire-'.uniqid();

        $this->statefulAdmin($admin)
            ->postJson('/api/admin/questionnaires', $this->payload(
                $slug,
                '<h2 class="hero" onclick="attack()">Heading <em>safe</em></h2>'
                    .'<p style="position:fixed">Read <a href="https://example.com/help" title="Help" target="_blank">this</a>.</p>'
                    .'<script>alert("stored-xss")</script><img src="x" onerror="attack()">',
                '<blockquote><strong>Approved advice</strong></blockquote>'
                    .'<iframe src="https://attacker.test"></iframe>'
                    .'<a href="javascript:alert(1)">Unsafe link</a>',
            ))
            ->assertCreated();

        $questionnaire = Questionnaire::query()->where('slug', $slug)->firstOrFail();
        $this->assertSafeContent($questionnaire->content_html);
        $this->assertSafeRecommendation($questionnaire->recommendations()->sole()->body_html);

        $this->statefulAdmin($admin)
            ->putJson('/api/admin/questionnaires/'.$questionnaire->id, $this->payload(
                $slug,
                '<p onmouseover="attack()">Updated <u>formatting</u></p><form><input autofocus onfocus="attack()"></form>',
                '<ol><li><i>First step</i></li></ol><a href="mailto:care@example.test">Email us</a>',
            ))
            ->assertOk();

        $questionnaire = $questionnaire->fresh('recommendations');
        $this->assertStringContainsString('<p>Updated <u>formatting</u></p>', $questionnaire->content_html);
        $this->assertStringNotContainsString('onmouseover', $questionnaire->content_html);
        $this->assertStringNotContainsString('<form', $questionnaire->content_html);
        $this->assertStringNotContainsString('<input', $questionnaire->content_html);
        $this->assertStringContainsString('<ol><li><i>First step</i></li></ol>', $questionnaire->recommendations->sole()->body_html);
        $this->assertStringContainsString('href="mailto:care&#64;example.test"', $questionnaire->recommendations->sole()->body_html);

        $public = $this->getJson('/api/questionnaires/'.$slug)
            ->assertOk()
            ->json('content_html');
        $this->assertSame($questionnaire->content_html, $public);
    }

    public function test_questionnaire_create_update_and_archive_roll_back_when_audit_fails(): void
    {
        $admin = User::factory()->admin()->create();
        $existing = Questionnaire::factory()->create([
            'title' => 'Existing questionnaire',
            'slug' => 'existing-questionnaire',
            'status' => 'draft',
        ]);

        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')
                ->times(3)
                ->andThrow(new RuntimeException('audit failed'));
        });

        $this->statefulAdmin($admin)
            ->postJson('/api/admin/questionnaires', $this->payload(
                'uncommitted-questionnaire',
                '<p>Uncommitted create</p>',
                '<p>Uncommitted recommendation</p>',
            ))
            ->assertStatus(500);

        $this->statefulAdmin($admin)
            ->putJson('/api/admin/questionnaires/'.$existing->id, $this->payload(
                $existing->slug,
                '<p>Uncommitted update</p>',
                '<p>Uncommitted recommendation</p>',
            ))
            ->assertStatus(500);

        $this->statefulAdmin($admin)
            ->deleteJson('/api/admin/questionnaires/'.$existing->id, [
                'reason' => 'Test archive rollback',
            ])
            ->assertStatus(500);

        $this->assertDatabaseMissing('questionnaires', ['slug' => 'uncommitted-questionnaire']);
        $this->assertDatabaseHas('questionnaires', [
            'id' => $existing->id,
            'title' => 'Existing questionnaire',
            'deleted_at' => null,
        ]);
        $this->assertDatabaseCount('audit_events', 0);
    }

    /** @return array<string, mixed> */
    private function payload(string $slug, string $contentHtml, string $recommendationHtml): array
    {
        return [
            'title' => 'Sanitizer contract',
            'slug' => $slug,
            'status' => 'published',
            'content_html' => $contentHtml,
            'reason' => 'Verify stored rich text safety',
            'questions' => [[
                'text' => 'Question?',
                'sort_order' => 0,
                'choices' => [[
                    'text' => 'Answer',
                    'score' => 1,
                    'sort_order' => 0,
                ]],
            ]],
            'recommendations' => [[
                'min_score' => 1,
                'max_score' => 1,
                'title' => 'Recommendation',
                'body_html' => $recommendationHtml,
                'priority' => 0,
            ]],
        ];
    }

    private function assertSafeContent(?string $html): void
    {
        $this->assertNotNull($html);
        $this->assertStringContainsString('<h2>Heading <em>safe</em></h2>', $html);
        $this->assertStringContainsString('href="https://example.com/help"', $html);
        $this->assertStringContainsString('title="Help"', $html);
        $this->assertStringNotContainsString('class=', $html);
        $this->assertStringNotContainsString('onclick', $html);
        $this->assertStringNotContainsString('style=', $html);
        $this->assertStringNotContainsString('target=', $html);
        $this->assertStringNotContainsString('<script', $html);
        $this->assertStringNotContainsString('stored-xss', $html);
        $this->assertStringNotContainsString('<img', $html);
    }

    private function assertSafeRecommendation(?string $html): void
    {
        $this->assertNotNull($html);
        $this->assertStringContainsString('<blockquote><strong>Approved advice</strong></blockquote>', $html);
        $this->assertStringContainsString('<a>Unsafe link</a>', $html);
        $this->assertStringNotContainsString('<iframe', $html);
        $this->assertStringNotContainsString('javascript:', $html);
    }

    private function statefulAdmin(User $admin): static
    {
        return $this->actingAs($admin)
            ->withHeader('Origin', 'http://localhost:3000')
            ->withHeader('Referer', 'http://localhost:3000')
            ->withSession(['auth.password_confirmed_at' => time()]);
    }
}
