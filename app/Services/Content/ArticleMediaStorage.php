<?php

namespace App\Services\Content;

use Illuminate\Support\Facades\Storage;
use RuntimeException;

/** Purpose-separated private local/S3 storage. No raw object URL is ever returned. */
final class ArticleMediaStorage
{
    public function disk(): \Illuminate\Contracts\Filesystem\Filesystem
    {
        $config = config('filesystems.disks.article-media');
        if (! is_array($config) || ! in_array($config['driver'] ?? null, ['local', 's3'], true)
            || ($config['visibility'] ?? null) !== 'private' || ($config['serve'] ?? null) !== false) {
            throw new RuntimeException('Editorial storage is unavailable.');
        }
        if ($config['driver'] === 'local' && ($config['root'] ?? null) !== storage_path('app/article-media')) {
            throw new RuntimeException('Editorial storage purpose mismatch.');
        }
        if ($config['driver'] === 's3' && (empty($config['bucket']) || empty($config['key']) || empty($config['secret'])
            || $config['bucket'] === config('filesystems.disks.private.bucket') || $config['bucket'] === config('filesystems.disks.s3.bucket'))) {
            throw new RuntimeException('Editorial storage purpose mismatch.');
        }
        if ($config['driver'] === 's3' && ! empty($config['endpoint'])) {
            $endpoint = parse_url($config['endpoint']);
            if (! is_array($endpoint) || empty($endpoint['host']) || isset($endpoint['user']) || isset($endpoint['pass'])
                || isset($endpoint['query']) || isset($endpoint['fragment'])
                || ! in_array($endpoint['scheme'] ?? '', ($config['allow_insecure_http'] ?? false) === true ? ['https', 'http'] : ['https'], true)) {
                throw new RuntimeException('Editorial storage endpoint is unavailable.');
            }
        }

        return Storage::disk('article-media');
    }

    public function key(string $id, string $mime): string
    {
        abort_unless(preg_match('/\A[0-7][0-9a-hjkmnp-tv-z]{25}\z/', $id) === 1 && in_array($mime, ['image/jpeg', 'image/png'], true), 422);

        return 'editorial/'.$id.($mime === 'image/png' ? '.png' : '.jpg');
    }

    /** A bounded, verified private copy is the only source used for parsing, scanning or serving. */
    public function copy(object $row): mixed
    {
        $source = null;
        $copy = null;
        try {
            if ($row->purpose !== 'article_editorial' || $row->disk !== 'article-media'
                || ! preg_match('~\Aeditorial/[0-7][0-9a-hjkmnp-tv-z]{25}\.(?:png|jpg)\z~', $row->object_key)
                || ! str_ends_with($row->object_key, $row->mime_type === 'image/png' ? '.png' : '.jpg')
                || (int) $row->size_bytes < 1 || (int) $row->size_bytes > 33554432) {
                throw new RuntimeException;
            }
            $source = $this->disk()->readStream($row->object_key);
            $copy = tmpfile();
            if (! is_resource($source) || ! is_resource($copy)
                || stream_copy_to_stream($source, $copy, (int) $row->size_bytes + 1) !== (int) $row->size_bytes
                || fread($source, 1) !== '' || ! feof($source)) {
                throw new RuntimeException;
            }
            rewind($copy);
            $digest = hash_init('sha256');
            hash_update_stream($digest, $copy);
            if (! hash_equals($row->checksum_sha256, hash_final($digest))) {
                throw new RuntimeException;
            }
            rewind($copy);
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer(fread($copy, 65536));
            if ($mime !== $row->mime_type) {
                throw new RuntimeException;
            }
            rewind($copy);

            return $copy;
        } catch (\Throwable) {
            if (is_resource($copy)) {
                fclose($copy);
            }
            throw new RuntimeException('Editorial file integrity is unavailable.');
        } finally {
            if (is_resource($source)) {
                fclose($source);
            }
        }
    }

    /** Read dimensions only after the isolated decoder has accepted these exact bytes. No app-side decoding. */
    public function dimensions(mixed $stream, string $mime): array
    {
        rewind($stream);
        $bytes = stream_get_contents($stream, 33554433);
        rewind($stream);
        $dimensions = null;
        if ($mime === 'image/png' && strlen($bytes) >= 33 && substr($bytes, 0, 8) === "\x89PNG\r\n\x1a\n" && substr($bytes, 12, 4) === 'IHDR') {
            $dimensions = array_values(unpack('Nwidth/Nheight', substr($bytes, 16, 8)));
        } elseif ($mime === 'image/jpeg' && str_starts_with($bytes, "\xff\xd8")) {
            $offset = 2;
            while ($offset + 4 <= strlen($bytes)) {
                if (ord($bytes[$offset++]) !== 255) {
                    break;
                }
                while ($offset < strlen($bytes) && ord($bytes[$offset]) === 255) {
                    $offset++;
                }
                if ($offset + 3 > strlen($bytes)) {
                    break;
                }
                $marker = ord($bytes[$offset++]);
                $length = unpack('n', substr($bytes, $offset, 2))[1];
                if ($length < 2 || $offset + $length > strlen($bytes)) {
                    break;
                }
                if (in_array($marker, [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207], true) && $length >= 8) {
                    $pair = unpack('nheight/nwidth', substr($bytes, $offset + 3, 4));
                    $dimensions = [$pair['width'], $pair['height']];
                    break;
                }
                $offset += $length;
            }
        }
        if ($dimensions === null || min($dimensions) < 1 || max($dimensions) > 8192 || $dimensions[0] * $dimensions[1] > 16000000) {
            throw new RuntimeException('Editorial dimensions are unavailable.');
        }

        return $dimensions;
    }
}
