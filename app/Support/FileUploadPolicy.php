<?php

namespace App\Support;

use Closure;
use DomainException;
use Illuminate\Http\UploadedFile;

final class FileUploadPolicy
{
    /** @param list<string> $mimeTypes
     * @param  array<string, int>  $limits
     */
    private function __construct(
        private readonly array $mimeTypes,
        private readonly array $limits,
    ) {}

    /**
     * Field rules must come from an authorized server-side form definition.
     * They can narrow the section policy, never increase its size/type authority.
     *
     * @param  array{max_bytes?: int, allowed_mime_types?: list<string>}  $fieldRules
     */
    public static function forSection(string $section, array $fieldRules = [], array $sizeOverrides = []): self
    {
        $definition = config('uploads.sections')[$section] ?? null;
        if (! is_array($definition)
            || array_diff(array_keys($fieldRules), ['max_bytes', 'allowed_mime_types']) !== []
            || array_diff(array_keys($sizeOverrides), ['max_bytes', 'type_limits']) !== []) {
            throw new DomainException('Upload policy configuration is invalid.');
        }
        $definition = array_replace($definition, $sizeOverrides);
        $ceiling = self::capacityMaxBytes();
        $default = self::positiveBytes($definition['max_bytes'] ?? null);
        $allowed = $definition['allowed_mime_types'] ?? null;
        $typeLimits = $definition['type_limits'] ?? [];
        if ($default > $ceiling || ! is_array($allowed) || ! array_is_list($allowed)
            || $allowed === [] || count(array_unique($allowed, SORT_REGULAR)) !== count($allowed)
            || ! is_array($typeLimits)) {
            throw new DomainException('Upload policy configuration is invalid.');
        }
        foreach ($allowed as $mime) {
            if (! is_string($mime) || self::extensionForMime($mime) === null) {
                throw new DomainException('Upload policy configuration is invalid.');
            }
        }
        if (array_diff(array_keys($typeLimits), $allowed) !== []) {
            throw new DomainException('Upload policy configuration is invalid.');
        }
        $limits = [];
        foreach ($allowed as $mime) {
            $limit = self::positiveBytes(array_key_exists($mime, $typeLimits) ? $typeLimits[$mime] : $default);
            if ($limit > $ceiling) {
                throw new DomainException('Upload policy exceeds deployed file capacity.');
            }
            $limits[$mime] = $limit;
        }
        if (array_key_exists('allowed_mime_types', $fieldRules)) {
            $fieldTypes = $fieldRules['allowed_mime_types'];
            if (! is_array($fieldTypes) || ! array_is_list($fieldTypes) || $fieldTypes === []
                || count(array_unique($fieldTypes, SORT_REGULAR)) !== count($fieldTypes)) {
                throw new DomainException('Upload field policy is invalid.');
            }
            foreach ($fieldTypes as $mime) {
                if (! is_string($mime) || ! in_array($mime, $allowed, true)) {
                    throw new DomainException('Upload field exceeds section type authority.');
                }
            }
            $allowed = $fieldTypes;
            $limits = array_intersect_key($limits, array_flip($allowed));
        }
        if (array_key_exists('max_bytes', $fieldRules)) {
            $fieldMax = self::positiveBytes($fieldRules['max_bytes']);
            foreach ($limits as $mime => $limit) {
                if ($fieldMax > $limit) {
                    throw new DomainException('Upload field exceeds section size authority.');
                }
                $limits[$mime] = $fieldMax;
            }
        }

        return new self($allowed, $limits);
    }

    public static function capacityMaxBytes(): int
    {
        return self::positiveBytes(config('uploads.capacity_max_bytes'));
    }

    public static function scannerMaxBytes(): int
    {
        $bytes = self::positiveBytes(config('uploads.scanner_max_bytes'));
        if ($bytes > self::capacityMaxBytes()) {
            throw new DomainException('Scanner policy exceeds deployed file capacity.');
        }

        return $bytes;
    }

    public static function extensionForMime(string $mime): ?string
    {
        $formats = config('uploads.formats');
        if (! is_array($formats)) {
            throw new DomainException('Upload format configuration is invalid.');
        }
        $extension = $formats[$mime] ?? null;
        if ($extension !== null && (! is_string($extension) || ! preg_match('/^[a-z0-9]{1,10}$/D', $extension))) {
            throw new DomainException('Upload format configuration is invalid.');
        }

        return $extension;
    }

    public function maxBytesForMime(string $mime): int
    {
        return $this->limits[$mime] ?? throw new DomainException('Upload format is not allowed in this section.');
    }

    /** @return list<string|Closure> */
    public function fileRules(): array
    {
        return ['required', 'file', 'mimetypes:'.implode(',', $this->mimeTypes),
            function (string $attribute, mixed $value, Closure $fail): void {
                if (! $value instanceof UploadedFile || ! $value->isValid()) {
                    return;
                }
                $mime = $value->getMimeType();
                if (! is_string($mime) || ! isset($this->limits[$mime])) {
                    return; // The MIME rule reports unsupported content.
                }
                $bytes = $value->getSize();
                if (! is_int($bytes) || $bytes < 1 || $bytes > $this->limits[$mime]) {
                    $fail('The file exceeds the upload limit for this type.');
                }
            }];
    }

    /** @return array{allowed_mime_types: list<string>, max_bytes_by_mime: array<string, int>} */
    public function descriptor(): array
    {
        return ['allowed_mime_types' => $this->mimeTypes, 'max_bytes_by_mime' => $this->limits];
    }

    /** Immutable issued limits intersect current authority; they never relax it. */
    public function intersect(array $issuedLimits): self
    {
        $limits = [];
        foreach ($this->limits as $mime => $bytes) {
            if (array_key_exists($mime, $issuedLimits)) {
                $limits[$mime] = min($bytes, self::positiveBytes($issuedLimits[$mime]));
            }
        }
        if ($limits === []) {
            throw new DomainException('No attachment type remains allowed by the current upload policy.');
        }

        return new self(array_keys($limits), $limits);
    }

    private static function positiveBytes(mixed $value): int
    {
        if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value)
            && (string) (int) $value === $value) {
            $value = (int) $value;
        }
        if (! is_int($value) || $value < 1) {
            throw new DomainException('Upload size must be a positive whole number of bytes.');
        }

        return $value;
    }
}
