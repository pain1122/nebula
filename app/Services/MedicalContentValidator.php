<?php

namespace App\Services;

use App\Support\FileUploadPolicy;
use App\Support\MedicalContentPolicy;
use App\Support\MedicalContentProtocol;
use DomainException;
use Symfony\Component\Process\Process;
use Throwable;

class MedicalContentValidator
{
    /** Validate the verified copy, never a storage path or user-supplied filename.
     * @param  resource  $stream
     * @return array{content_policy_revision: string, content_validator: string}
     */
    public function validate($stream, string $mime): array
    {
        // Inline execution is confined to isolated source tests or the parser server.
        // Application/worker deployments never fall back to local native parsing.
        if ($this->inlineAllowed()) {
            return $this->validateLocally($stream, $mime);
        }
        try {
            return (new MedicalContentProtocol)->validateRemotely($stream, $mime, $this->policy(), $this->capacity(), config('medical_parser.socket'));
        } catch (Throwable) {
            throw new DomainException('Medical content validation did not pass; file access remains blocked.');
        }
    }

    protected function inlineAllowed(): bool
    {
        return app()->environment('testing') && config('medical_parser.test_inline') === true;
    }

    protected function policy(): MedicalContentPolicy
    {
        return MedicalContentPolicy::current();
    }

    protected function capacity(): int
    {
        return FileUploadPolicy::capacityMaxBytes();
    }

    protected function imageHelper(): string
    {
        return base_path('scripts/media/validate-medical-image.php');
    }

    private function validateLocally($stream, string $mime): array
    {
        $path = null;
        $temporary = null;
        try {
            $policy = $this->policy();
            if (! is_resource($stream) || ! in_array($mime, ['application/pdf', 'image/jpeg', 'image/png'], true)) {
                throw new DomainException;
            }
            $path = tempnam(sys_get_temp_dir(), 'checkupino-content-');
            if (! is_string($path) || ! chmod($path, 0600)) {
                throw new DomainException;
            }
            $temporary = fopen($path, 'w+b');
            if (! is_resource($temporary)) {
                throw new DomainException;
            }
            if (! rewind($stream)) {
                throw new DomainException;
            }
            $bytes = stream_copy_to_stream($stream, $temporary, $this->capacity() + 1);
            // php://temp spilled to disk need not set EOF after copy: explicitly probe it.
            if (! is_int($bytes) || $bytes < 1 || $bytes > $this->capacity()
                || fread($stream, 1) !== '' || ! feof($stream)) {
                throw new DomainException;
            }
            fflush($temporary);
            if ((new \finfo(FILEINFO_MIME_TYPE))->file($path) !== $mime) {
                throw new DomainException;
            }
            $deadline = microtime(true) + $policy->rules['resources']['timeout_seconds'];
            $validator = $mime === 'application/pdf'
                ? $this->pdf($path, $policy, $deadline)
                : $this->image($path, $mime, $policy, $deadline);
            if (! hash_equals($policy->revision, $this->policy()->revision)) {
                throw new DomainException;
            }

            return ['content_policy_revision' => $policy->revision, 'content_validator' => $validator];
        } catch (Throwable) {
            // Never expose parser output, metadata, paths or embedded document text.
            throw new DomainException('Medical content validation did not pass; file access remains blocked.');
        } finally {
            if (is_resource($temporary)) {
                fclose($temporary);
            }
            if (is_string($path) && is_file($path) && ! unlink($path)) {
                // A private spool cleanup failure cannot produce an accepted verdict.
                throw new DomainException('Medical content validation did not pass; file access remains blocked.');
            }
        }
    }

    private function pdf(string $path, MedicalContentPolicy $policy, float $deadline): string
    {
        $version = $this->run(['/usr/local/bin/qpdf', '--version'], $policy, $deadline);
        if ($version['exit'] !== 0 || ! preg_match('/^qpdf version (12\.4\.2)\s/', $version['out'], $match)) {
            throw new DomainException;
        }
        // qpdf reports encryption even for empty-password and unreadable encrypted files.
        $encryption = $this->run(['/usr/local/bin/qpdf', '--is-encrypted', $path], $policy, $deadline);
        if ($encryption['exit'] !== 2) {
            throw new DomainException;
        }
        $check = $this->run(['/usr/local/bin/qpdf', '--check', $path], $policy, $deadline);
        if ($check['exit'] !== 0) {
            throw new DomainException; // Includes repaired/warning-only PDFs (exit 3).
        }
        $result = $this->run([
            '/usr/local/bin/qpdf', '--json=2', '--json-key=qpdf', '--json-key=pages',
            '--json-stream-data=none', $path,
        ], $policy, $deadline);
        if ($result['exit'] !== 0) {
            throw new DomainException;
        }
        $json = json_decode($result['out'], true, 64, JSON_THROW_ON_ERROR);
        $objects = $json['qpdf'][1] ?? null;
        $pages = $json['pages'] ?? null;
        if (($json['version'] ?? null) !== 2 || ($json['qpdf'][0]['jsonversion'] ?? null) !== 2
            || ! is_array($objects) || ! isset($objects['trailer']['value']['/Root'])
            || count($objects) > $policy->rules['pdf']['max_objects']
            || ! is_array($pages) || ! array_is_list($pages) || count($pages) < 1
            || count($pages) > $policy->rules['pdf']['max_pages']) {
            throw new DomainException;
        }
        $forbidden = array_fill_keys([...$policy->rules['pdf']['forbidden_names'], '/Encrypt'], true);
        $walk = function (mixed $value) use (&$walk, $forbidden): void {
            if (is_string($value) && isset($forbidden[$value])) {
                throw new DomainException;
            }
            if (is_array($value)) {
                foreach ($value as $key => $item) {
                    if (is_string($key) && (isset($forbidden[$key]) || str_starts_with($key, 'n:'))) {
                        throw new DomainException;
                    }
                    if (is_string($item) && str_starts_with($item, 'n:')) {
                        throw new DomainException; // Unsupported binary PDF names fail closed.
                    }
                    $walk($item);
                }
            }
        };
        $walk($objects);

        return 'qpdf-'.$match[1].'/medical-v1';
    }

    private function image(string $path, string $mime, MedicalContentPolicy $policy, float $deadline): string
    {
        $helper = $this->imageHelper();
        $result = $this->run([
            PHP_BINARY, '-n', '-d', 'extension=gd', '-d', 'memory_limit=128M',
            '-d', 'gd.jpeg_ignore_warning=0',
            '-d', 'allow_url_fopen=0', '-d', 'display_errors=0', '-d', 'log_errors=0',
            '-d', 'open_basedir='.$path.PATH_SEPARATOR.$helper,
            $helper, $path, $mime,
            (string) $policy->rules['image']['max_width'],
            (string) $policy->rules['image']['max_height'],
            (string) $policy->rules['image']['max_pixels'],
        ], $policy, $deadline);
        if ($result['exit'] !== 0 || ! preg_match('/^gd-(?:[0-9]+\.[0-9]+\.[0-9]+|bundled\/php-[0-9]+\.[0-9]+\.[0-9]+)\/medical-v1$/D', trim($result['out']))) {
            throw new DomainException;
        }

        return trim($result['out']);
    }

    /** Shell-free, bounded subprocess; output is never logged or returned to clients.
     * @return array{exit: int, out: string}
     */
    protected function run(array $command, MedicalContentPolicy $policy, float $deadline): array
    {
        $limits = $policy->rules['resources'];
        $remaining = $deadline - microtime(true);
        if ($remaining <= 0) {
            throw new DomainException;
        }
        $process = new Process([
            '/usr/bin/prlimit', '--as='.$limits['address_space_bytes'],
            '--cpu='.$limits['cpu_seconds'], '--fsize=0', '--core=0', '--', ...$command,
        ], sys_get_temp_dir(), $this->environment(), timeout: $remaining);
        $output = '';
        $seen = 0;
        try {
            $exit = $process->run(function (string $type, string $chunk) use ($process, &$output, &$seen, $limits): void {
                $seen += strlen($chunk);
                if ($seen > $limits['max_output_bytes']) {
                    $process->stop(0);
                    throw new DomainException;
                }
                if ($type === Process::OUT) {
                    $output .= $chunk;
                }
                // Symfony also buffers output; clear it after each bounded chunk.
                $process->clearOutput();
                $process->clearErrorOutput();
            });
        } finally {
            if ($process->isRunning()) {
                $process->stop(0);
            }
        }

        return ['exit' => $exit, 'out' => $output];
    }

    private function environment(): array
    {
        $environment = array_fill_keys(array_unique([
            ...array_keys(getenv()), ...array_keys($_ENV), ...array_keys($_SERVER),
        ]), false);

        return array_replace($environment, ['PATH' => '/usr/local/bin:/usr/bin:/bin', 'LANG' => 'C', 'LC_ALL' => 'C']);
    }
}
