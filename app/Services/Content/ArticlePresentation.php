<?php

namespace App\Services\Content;

use InvalidArgumentException;

/** Versioned preferences only. A saved time never grants publication authority. */
final class ArticlePresentation
{
    public function __construct(private readonly ArticlePublicationTime $time = new ArticlePublicationTime) {}

    public function prepare(mixed $input, bool $stored = false): array
    {
        if (! is_array($input) || array_is_list($input)
            || array_diff(array_keys($input), ['publication', 'thumbnail', 'inline']) !== []
            || ! array_key_exists('publication', $input)
            || (array_key_exists('inline', $input) && $input['inline'] === null)
            || (! $stored && (($input['thumbnail'] ?? null) !== null || ($input['inline'] ?? []) !== []))) {
            throw new InvalidArgumentException('Invalid article presentation.');
        }

        $thumbnail = $input['thumbnail'] ?? null;
        if ($thumbnail !== null) {
            $this->exact($thumbnail, ['asset', 'alt']);
            $thumbnail = ['asset' => $this->asset($thumbnail['asset']), 'alt' => $this->alt($thumbnail['alt'])];
        }
        $inline = $input['inline'] ?? [];
        if (! is_array($inline) || ! array_is_list($inline) || count($inline) > 30) {
            throw new InvalidArgumentException('Invalid article media manifest.');
        }
        $seen = [];
        foreach ($inline as &$reference) {
            $this->exact($reference, ['asset', 'language']);
            if (! in_array($reference['language'], ['en', 'fa'], true)) {
                throw new InvalidArgumentException('Invalid article media language.');
            }
            $reference['asset'] = $this->asset($reference['asset']);
            $key = $reference['language'].':'.$reference['asset']['id'];
            if (isset($seen[$key])) {
                throw new InvalidArgumentException('Duplicate article media.');
            }
            $seen[$key] = true;
        }
        unset($reference);
        usort($inline, fn ($a, $b) => strcmp($a['language'].$a['asset']['id'], $b['language'].$b['asset']['id']));

        return ['publication' => $stored ? $this->time->read($input['publication']) : $this->time->normalize($input['publication']),
            'thumbnail' => $thumbnail, 'inline' => $inline];
    }

    private function exact(mixed $value, array $keys): void
    {
        if (! is_array($value) || count($value) !== count($keys) || array_diff(array_keys($value), $keys)) {
            throw new InvalidArgumentException('Invalid article media snapshot.');
        }
    }

    public function asset(mixed $value): array
    {
        $this->exact($value, ['id', 'checksum_sha256', 'mime_type', 'size_bytes', 'width', 'height']);
        if (! is_string($value['id']) || ! preg_match('/\A[0-7][0-9a-hjkmnp-tv-z]{25}\z/', $value['id'])
            || ! is_string($value['checksum_sha256']) || ! preg_match('/\A[a-f0-9]{64}\z/', $value['checksum_sha256'])
            || ! in_array($value['mime_type'], ['image/jpeg', 'image/png'], true)) {
            throw new InvalidArgumentException('Invalid article image identity.');
        }
        foreach (['size_bytes' => 33554432, 'width' => 8192, 'height' => 8192] as $field => $max) {
            if (! is_int($value[$field]) || $value[$field] < 1 || $value[$field] > $max) {
                throw new InvalidArgumentException('Invalid article image bounds.');
            }
        }
        if ($value['width'] * $value['height'] > 16000000) {
            throw new InvalidArgumentException('Invalid article image bounds.');
        }

        return array_combine(['id', 'checksum_sha256', 'mime_type', 'size_bytes', 'width', 'height'],
            array_map(fn ($key) => $value[$key], ['id', 'checksum_sha256', 'mime_type', 'size_bytes', 'width', 'height']));
    }

    public function alt(mixed $value): array
    {
        if (! is_array($value) || array_diff(array_keys($value), ['en', 'fa'])) {
            throw new InvalidArgumentException('Invalid image alternative text.');
        }
        $result = [];
        foreach (['en', 'fa'] as $language) {
            $text = $value[$language] ?? '';
            if (! is_string($text) || ! mb_check_encoding($text, 'UTF-8') || mb_strlen($text) > 255 || preg_match('/[\x00-\x1f\x7f]/', $text)) {
                throw new InvalidArgumentException('Invalid image alternative text.');
            }
            $result[$language] = trim($text);
        }

        return $result;
    }
}
