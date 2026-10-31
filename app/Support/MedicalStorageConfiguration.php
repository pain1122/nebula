<?php

namespace App\Support;

use DomainException;

final class MedicalStorageConfiguration
{
    /** @param array<string, mixed> $disk */
    public static function validate(array $disk, string $environment): void
    {
        if (! in_array($disk['driver'] ?? null, ['local', 'medical-s3'], true)
            || ($disk['visibility'] ?? null) !== 'private'
            || ($disk['serve'] ?? false) !== false
            || ($disk['throw'] ?? null) !== true
            || ! empty($disk['url'])) {
            throw new DomainException('Medical storage must use the private, non-serving configuration.');
        }
        if ($disk['driver'] === 'local') {
            return;
        }

        foreach (['key', 'secret', 'region', 'bucket'] as $setting) {
            if (! is_string($disk[$setting] ?? null) || trim($disk[$setting]) === '') {
                throw new DomainException('Medical S3 credentials, region and bucket are required.');
            }
        }
        if (in_array(strtolower($disk['key']), ['admin', 'minioadmin'], true)
            || in_array(strtolower($disk['secret']), ['secret', 'minioadmin', 'minioadmin123'], true)) {
            throw new DomainException('Medical S3 must not use example credentials.');
        }
        if (($disk['http']['verify'] ?? null) !== true) {
            throw new DomainException('Medical S3 certificate verification must remain enabled.');
        }
        if (! empty($disk['root'])) {
            throw new DomainException('Medical S3 uses canonical object keys without a local filesystem prefix.');
        }

        // An omitted endpoint selects the SDK's normal AWS regional endpoint.
        $endpoint = $disk['endpoint'] ?? null;
        if ($endpoint === null || $endpoint === '') {
            return;
        }
        $parts = is_string($endpoint) ? parse_url($endpoint) : false;
        if ($parts === false || empty($parts['host'])
            || ! in_array($parts['scheme'] ?? null, ['https', 'http'], true)
            || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment'])
            || ! in_array($parts['path'] ?? '', ['', '/'], true)) {
            throw new DomainException('Medical S3 endpoint must be a plain HTTP or HTTPS service origin.');
        }
        if ($parts['scheme'] === 'http'
            && (! in_array($environment, ['local', 'testing'], true)
                || ($disk['allow_insecure_http'] ?? false) !== true)) {
            throw new DomainException('Medical S3 requires HTTPS outside an explicitly enabled local synthetic evaluation.');
        }
    }
}
