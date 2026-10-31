<?php

namespace App\Console\Commands;

use App\Support\MedicalStorageConfiguration;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class CheckMedicalStorage extends Command
{
    protected $signature = 'medical:storage-check {--probe : Write, verify and delete one synthetic object}';

    protected $description = 'Validate medical storage without exposing configuration secrets or medical records';

    public function handle(): int
    {
        $disk = null;
        $path = null;
        $passed = false;
        $cleanupPassed = true;
        try {
            $config = config('filesystems.disks.private', []);
            MedicalStorageConfiguration::validate($config, app()->environment());
            if ($config['driver'] === 'medical-s3'
                && ! class_exists(\League\Flysystem\AwsS3V3\AwsS3V3Adapter::class)) {
                $this->error('Medical S3 adapter is not installed. Install league/flysystem-aws-s3-v3 first.');

                return self::FAILURE;
            }
            if (! $this->option('probe')) {
                $this->info('Medical storage configuration is valid; connectivity was not probed.');

                return self::SUCCESS;
            }

            $disk = Storage::disk('private');
            $path = 'storage-checks/'.Str::ulid().'.bin';
            $content = "Checkupino synthetic storage check\n".str_repeat('0123456789abcdef', 1024);
            if (! $disk->put($path, $content, ['visibility' => 'private'])) {
                throw new \DomainException('Synthetic write failed.');
            }
            $stream = $disk->readStream($path);
            if (! is_resource($stream)) {
                throw new \DomainException('Synthetic read failed.');
            }
            try {
                // Bound reads even if the provider returns unexpectedly large content.
                $received = stream_get_contents($stream, strlen($content) + 1);
                if ($received === false || strlen($received) !== strlen($content)
                    || ! hash_equals(hash('sha256', $content), hash('sha256', $received))) {
                    throw new \DomainException('Synthetic integrity check failed.');
                }
            } finally {
                fclose($stream);
            }
            $passed = true;
        } catch (Throwable) {
            // SDK exception text may contain signed URLs, credentials or object keys.
            $this->error('Medical storage check failed. Inspect protected configuration and storage availability.');
        } finally {
            if ($disk !== null && $path !== null) {
                try {
                    $cleanupPassed = $disk->delete($path) && ! $disk->exists($path);
                } catch (Throwable) {
                    $cleanupPassed = false;
                }
                if (! $cleanupPassed) {
                    $this->error('Synthetic object cleanup failed; inspect the restricted storage-checks prefix.');
                }
            }
        }

        if ($passed && $cleanupPassed) {
            $this->info('Synthetic private write/read/integrity/delete check passed. No medical records were accessed.');

            return self::SUCCESS;
        }

        return self::FAILURE;
    }
}
