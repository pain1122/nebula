<?php

namespace Tests\Unit\Content;

use App\Services\Content\ArticleContent;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class ArticleSeoTest extends TestCase
{
    use IsolatedArticleApplication;

    public function test_v2_seo_is_bilingual_hash_bound_and_does_not_require_a_summary(): void
    {
        $service = app(ArticleContent::class);
        $input = ['translations' => ['en' => ['title' => 'Educational title', 'body_html' => '<p>Education.</p>',
            'seo' => ['title' => str_repeat('a', 70), 'description' => str_repeat('b', 200),
                'schema_json' => '{"@context":"https://schema.org","@type":"BlogPosting","headline":"Education"}',
                'canonical_url' => 'https://example.com/en/article']]]];
        $prepared = $service->prepare($input);
        $this->assertSame(2, $prepared['schema_version']);
        $this->assertSame('', $prepared['translations']['en']['summary']);
        $this->assertSame(['en'], $service->publishableLanguages($prepared));
        $this->assertSame($prepared, $service->prepare($input, 2));
        $changed = $input;
        $changed['translations']['en']['seo']['title'] .= 'x';
        $this->assertNotSame($service->hash($prepared), $service->hash($service->prepare($changed)));
        $input['translations']['fa'] = $input['translations']['en'];
        $input['translations']['fa']['seo']['canonical_url'] = 'https://example.com/fa/article';
        $this->assertSame(['en', 'fa'], $service->publishableLanguages($service->prepare($input)));
        unset($input['translations']['en']['seo']);
        $legacy = $service->prepare(['translations' => ['en' => $input['translations']['en']]], 1);
        $this->assertSame(1, $legacy['schema_version']);
        $this->assertArrayNotHasKey('seo', $legacy['translations']['en']);
        $this->assertSame([], $service->publishableLanguages($legacy));
    }

    public static function invalidSeo(): array
    {
        return [
            'null' => [null], 'unknown field' => [['script' => 'alert(1)']],
            'title bound' => [['title' => str_repeat('x', 201)]],
            'description bound' => [['description' => str_repeat('x', 1001)]],
            'keywords bound' => [['keywords' => str_repeat('x', 1001)]],
            'canonical relative' => [['canonical_url' => '/article']],
            'canonical script' => [['canonical_url' => 'javascript:alert(1)']],
            'canonical userinfo' => [['canonical_url' => 'https://user:secret@example.com/article']],
            'canonical fragment' => [['canonical_url' => 'https://example.com/article#fragment']],
            'canonical slash' => [['canonical_url' => 'https://example.com/\\article']],
            'malformed json' => [['schema_json' => '{broken']],
            'script wrapper' => [['schema_json' => '<script type="application/ld+json">{}</script>']],
            'script end' => [['schema_json' => '{"@context":"https://schema.org","@type":"BlogPosting","headline":"</script>"}']],
            'scalar json' => [['schema_json' => '42']],
            'empty array' => [['schema_json' => '[]']],
            'foreign context' => [['schema_json' => '{"@context":"https://tracker.test","@type":"BlogPosting"}']],
            'prototype' => [['schema_json' => '{"@context":"https://schema.org","@type":"BlogPosting","__proto__":{}}']],
            'control bytes' => [['keywords' => "safe\0unsafe"]],
        ];
    }

    #[DataProvider('invalidSeo')]
    public function test_invalid_seo_is_refused_without_execution_or_url_fetch(mixed $seo): void
    {
        $this->expectException(ValidationException::class);
        app(ArticleContent::class)->prepare(['translations' => ['en' => ['seo' => $seo]]]);
    }
}
