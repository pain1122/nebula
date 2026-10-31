<?php

namespace Tests\Unit\Content;

use App\Services\Content\ArticleContent;
use App\Services\QuestionnaireRichTextSanitizer;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleContentTest extends TestCase
{
    use IsolatedArticleApplication;

    private function content(): ArticleContent
    {
        return new ArticleContent(new QuestionnaireRichTextSanitizer);
    }

    private function input(string $body = '<p>Educational article.</p>'): array
    {
        return ['translations' => ['en' => ['title' => 'Article', 'summary' => 'Summary', 'body_html' => $body]]];
    }

    public function test_stored_content_removes_active_markup_but_preserves_bilingual_editor_formatting(): void
    {
        $input = $this->input('<h2 onclick="attack()">Safe heading</h2><p style="position:fixed">Text <strong>bold</strong></p>'
            .'<script>attack()</script><img src="https://attacker.test/track"><iframe src="https://attacker.test"></iframe>'
            .'<a href="javascript:attack()">bad</a><a href="https://example.test/help" target="_blank">safe link</a>');
        $input['translations']['fa'] = ['title' => 'سلامت قلب', 'summary' => 'مطلب آموزشی', 'body_html' => '<p>متن فارسی <em>آموزشی</em></p>'];
        $result = $this->content()->prepare($input);
        $body = $result['translations']['en']['body_html'];
        foreach (['onclick', 'style=', '<script', 'attack()', '<img', '<iframe', 'javascript:', 'target='] as $unsafe) {
            $this->assertStringNotContainsString($unsafe, $body);
        }
        $this->assertStringContainsString('<h2>Safe heading</h2>', $body);
        $this->assertStringContainsString('<strong>bold</strong>', $body);
        $this->assertStringContainsString('href="https://example.test/help"', $body);
        $this->assertSame('<p>متن فارسی <em>آموزشی</em></p>', $result['translations']['fa']['body_html']);
        $this->assertSame(['en', 'fa'], $this->content()->publishableLanguages($result));
    }

    public function test_complete_translation_is_required_without_mixing_incomplete_languages(): void
    {
        $input = ['translations' => ['en' => ['title' => 'English title'], 'fa' => ['summary' => 'خلاصه', 'body_html' => '<p>متن</p>']]];
        $prepared = $this->content()->prepare($input);
        $this->assertSame([], $this->content()->publishableLanguages($prepared));
        $input['translations']['fa']['title'] = 'عنوان';
        $this->assertSame(['fa'], $this->content()->publishableLanguages($this->content()->prepare($input)));
        foreach (['<script>fake text</script>', '<p>&nbsp; &#8203;</p>', '<p><br></p>'] as $body) {
            $this->assertSame([], $this->content()->publishableLanguages($this->content()->prepare($this->input($body))));
        }
        foreach (['title', 'summary'] as $field) {
            $blank = $this->input();
            $blank['translations']['en'][$field] = "\u{00a0}\u{200b}";
            $this->assertSame([], $this->content()->publishableLanguages($this->content()->prepare($blank)));
        }
        $this->assertSame([], $this->content()->publishableLanguages($this->content()->prepare([])));
    }

    public function test_medical_references_are_sorted_server_snapshots_without_reading_patient_facts(): void
    {
        $prepared = $this->content()->prepare($this->input() + ['health_references' => ['condition.diabetes', 'allergy.latex']]);
        $this->assertSame(['allergy.latex', 'condition.diabetes'], array_column($prepared['health_references'], 'id'));
        $this->assertSame(['allergy', 'condition'], array_column($prepared['health_references'], 'kind'));
        $this->assertSame('health-2026-10-22.1', $prepared['health_catalog_version']);
        $this->assertSame(['en', 'fa'], array_keys($prepared['health_references'][0]['labels']));
        $this->assertArrayNotHasKey('patient_id', $prepared);
    }

    public function test_hash_ignores_json_object_order_but_binds_language_term_version_and_source_order(): void
    {
        $service = $this->content();
        $first = $service->prepare($this->input());
        $reordered = array_reverse($first, true);
        $reordered['translations']['en'] = array_reverse($reordered['translations']['en'], true);
        $this->assertSame($service->hash($first), $service->hash($reordered));
        $this->assertNotSame($service->hash($first, [['id' => 'topic', 'version' => 1]]), $service->hash($first, [['id' => 'topic', 'version' => 2]]));
        $reordered['translations']['en']['body_html'] = '<p>Changed</p>';
        $this->assertNotSame($service->hash($first), $service->hash($reordered));
        $withSources = $service->prepare($this->input() + ['source_links' => [['url' => 'https://example.test/a', 'label' => 'A'], ['url' => 'https://example.test/b', 'label' => 'B']]]);
        $reverseSources = $withSources;
        $reverseSources['source_links'] = array_reverse($reverseSources['source_links']);
        $this->assertNotSame($service->hash($withSources), $service->hash($reverseSources));
    }

    public function test_html_bound_matches_javascript_utf16_units_including_surrogate_pairs(): void
    {
        $body = '<p>'.str_repeat('😀', 9996).'x</p>'; // Exactly20,000 UTF-16 code units.
        $this->assertSame($body, $this->content()->prepare($this->input($body))['translations']['en']['body_html']);
        $this->expectException(ValidationException::class);
        $this->content()->prepare($this->input(str_replace('x', 'xx', $body)));
    }

    public static function invalidInputs(): array
    {
        return [
            'forged patient fields' => [['patient_id' => 'private']],
            'unsupported language' => [['translations' => ['de' => ['title' => 'Title']]]],
            'wrong translation shape' => [['translations' => ['en' => null]]],
            'null translation object' => [['translations' => null]],
            'null title' => [['translations' => ['en' => ['title' => null]]]],
            'null medical references' => [['health_references' => null]],
            'null source list' => [['source_links' => null]],
            'forged medical label' => [['health_references' => [['id' => 'condition.diabetes', 'labels' => ['en' => 'forged']]]]],
            'unknown medical term' => [['health_references' => ['condition.unknown']]],
            'duplicate medical term' => [['health_references' => ['condition.diabetes', 'condition.diabetes']]],
            'nonlist medical terms' => [['health_references' => ['term' => 'condition.diabetes']]],
            'wrong source protocol' => [['source_links' => [['url' => 'javascript:alert(1)', 'label' => 'Source']]]],
            'source credentials' => [['source_links' => [['url' => 'https://user:secret@example.test', 'label' => 'Source']]]],
            'relative source' => [['source_links' => [['url' => '/source', 'label' => 'Source']]]],
            'duplicate source' => [['source_links' => [['url' => 'https://example.test', 'label' => 'A'], ['url' => 'https://example.test', 'label' => 'B']]]],
            'extra source keys' => [['source_links' => [['url' => 'https://example.test', 'label' => 'A', 'patient' => 'private']]]],
            'invalid utf8' => [['translations' => ['en' => ['body_html' => "\xc3\x28"]]]],
            'null byte' => [['translations' => ['en' => ['body_html' => "<p>bad\0value</p>"]]]],
            'oversize body' => [['translations' => ['en' => ['body_html' => str_repeat('a', 20001)]]]],
            'sanitized output expansion' => [['translations' => ['en' => ['body_html' => str_repeat('&', 5000)]]]],
            'oversize title' => [['translations' => ['en' => ['title' => str_repeat('a', 201)]]]],
            'nonstring summary' => [['translations' => ['en' => ['summary' => ['bad']]]]],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_content_refuses_without_echoing_input(array $input): void
    {
        try {
            $this->content()->prepare($input);
            $this->fail('Invalid article input must refuse.');
        } catch (ValidationException $exception) {
            $this->assertSame(['article' => ['Invalid article content.']], $exception->errors());
        }
    }
}
