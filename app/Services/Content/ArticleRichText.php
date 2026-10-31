<?php

namespace App\Services\Content;

use App\Services\QuestionnaireRichTextSanitizer;
use DOMDocument;
use InvalidArgumentException;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

/** Article-only images, bound to a version manifest. Questionnaire sanitization stays unchanged. */
final class ArticleRichText
{
    public function sanitize(string $html, array $ids): string
    {
        if ($ids === []) {
            if (preg_match('~<img\b[^>]*\bsrc\s*=\s*["\']/api/admin/article-media/~i', $html)) {
                throw new InvalidArgumentException('Unowned article media.');
            }

            return (new QuestionnaireRichTextSanitizer)->sanitize($html) ?? '';
        }
        $config = new HtmlSanitizerConfig;
        foreach (['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'figcaption'] as $tag) {
            $config = $config->allowElement($tag);
        }
        $sanitizer = new HtmlSanitizer($config->allowElement('a', ['href', 'title'])->allowLinkSchemes(['http', 'https', 'mailto', 'tel'])
            ->allowRelativeLinks(false)->allowElement('figure', ['class'])->allowElement('img', ['src', 'alt'])
            ->allowRelativeMedias()->allowMediaSchemes(['http', 'https'])->withMaxInputLength(100000));
        $safe = $sanitizer->sanitize($html);
        $document = new DOMDocument('1.0', 'UTF-8');
        $document->loadHTML('<?xml encoding="UTF-8"><div>'.$safe.'</div>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        $root = $document->getElementsByTagName('div')->item(0);
        foreach (iterator_to_array($document->getElementsByTagName('img')) as $image) {
            if (! preg_match('~\A/api/admin/article-media/([0-7][0-9a-hjkmnp-tv-z]{25})/content\z~', $image->getAttribute('src'), $match)) {
                $image->parentNode->removeChild($image);

                continue;
            }
            if (! in_array($match[1], $ids, true)) {
                throw new InvalidArgumentException('Unowned article media.');
            }
            if (mb_strlen($image->getAttribute('alt')) > 255 || preg_match('/[\x00-\x1f\x7f]/', $image->getAttribute('alt'))) {
                throw new InvalidArgumentException('Invalid article alternative text.');
            }
        }
        foreach ($document->getElementsByTagName('figure') as $figure) {
            $figure->setAttribute('class', 'image');
        }
        $result = '';
        foreach ($root->childNodes as $child) {
            $result .= $document->saveHTML($child);
        }
        $used = $this->ids($result);
        sort($ids);
        sort($used);
        if ($used !== $ids) {
            throw new InvalidArgumentException('Article media manifest mismatch.');
        }

        return trim($result);
    }

    public function ids(string $html): array
    {
        preg_match_all('~<img\b[^>]*\bsrc="/api/admin/article-media/([0-7][0-9a-hjkmnp-tv-z]{25})/content"~', $html, $matches);

        return array_values(array_unique($matches[1]));
    }
}
