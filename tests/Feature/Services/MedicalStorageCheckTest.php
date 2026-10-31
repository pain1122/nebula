<?php

namespace Tests\Feature\Services;

use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class MedicalStorageCheckTest extends TestCase
{
    public function test_isolated_worker_framework_storage_does_not_redirect_explicit_private_file_root(): void
    {
        $originalPath = app()->storagePath();
        $environment = \Illuminate\Support\Env::getRepository();
        $originalRoot = $environment->get('MEDICAL_LOCAL_STORAGE_ROOT');
        try {
            app()->useStoragePath('/tmp/checkupino-worker-framework-only');
            $environment->set('MEDICAL_LOCAL_STORAGE_ROOT', '/var/www/storage/app/private');
            $configuration = require base_path('config/filesystems.php');
            $this->assertSame('/var/www/storage/app/private', $configuration['disks']['private']['root']);
            $this->assertSame('/tmp/checkupino-worker-framework-only/app/private', $configuration['disks']['local']['root']);
        } finally {
            app()->useStoragePath($originalPath);
            if ($originalRoot === null) {
                $environment->clear('MEDICAL_LOCAL_STORAGE_ROOT');
            } else {
                $environment->set('MEDICAL_LOCAL_STORAGE_ROOT', $originalRoot);
            }
        }
    }

    public function test_real_s3_adapter_constructs_for_seaweedfs_without_local_path_prefix_or_network_access(): void
    {
        config(['filesystems.disks.private' => array_replace(config('filesystems.disks.private'), [
            'driver' => 'medical-s3', 'root' => '', 'key' => 'synthetic-key', 'secret' => 'synthetic-secret',
            'region' => 'us-east-1', 'bucket' => 'synthetic-medical', 'endpoint' => 'https://storage.example.test',
            'use_path_style_endpoint' => true,
        ])]);
        Storage::forgetDisk('private');
        $disk = Storage::disk('private');
        $this->assertInstanceOf(AwsS3V3Adapter::class, $disk);
        $this->assertSame('reservation-files/quarantine/synthetic.pdf', $disk->path('reservation-files/quarantine/synthetic.pdf'));
        $this->assertTrue($disk->getClient()->getConfig('use_path_style_endpoint'));
        $command = $disk->getClient()->getCommand('GetObject', ['Bucket' => 'synthetic-medical', 'Key' => 'synthetic.pdf']);
        $this->assertTrue($command['@http']['verify']);
        $this->assertSame(3, $command['@http']['connect_timeout']);
        $this->assertSame(30, $command['@http']['timeout']);
    }

    public function test_same_adapter_supports_aws_endpoint_resolution_and_virtual_host_style(): void
    {
        config(['filesystems.disks.private' => array_replace(config('filesystems.disks.private'), [
            'driver' => 'medical-s3', 'root' => '', 'key' => 'synthetic-key', 'secret' => 'synthetic-secret',
            'region' => 'us-east-1', 'bucket' => 'synthetic-medical', 'endpoint' => null,
            'use_path_style_endpoint' => false,
        ])]);
        Storage::forgetDisk('private');
        $disk = Storage::disk('private');
        $this->assertInstanceOf(AwsS3V3Adapter::class, $disk);
        $this->assertFalse($disk->getClient()->getConfig('use_path_style_endpoint'));
    }

    public function test_unsafe_s3_configuration_fails_when_the_actual_disk_is_resolved(): void
    {
        config(['filesystems.disks.private.driver' => 'medical-s3', 'filesystems.disks.private.key' => '']);
        Storage::forgetDisk('private');
        $this->expectException(\DomainException::class);
        Storage::disk('private');
    }

    public function test_default_check_validates_configuration_without_contacting_storage(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->artisan('medical:storage-check')
            ->expectsOutput('Medical storage configuration is valid; connectivity was not probed.')
            ->assertSuccessful();
    }

    public function test_opt_in_probe_verifies_synthetic_bytes_and_removes_its_object(): void
    {
        Storage::fake('private');
        $this->artisan('medical:storage-check', ['--probe' => true])
            ->expectsOutput('Synthetic private write/read/integrity/delete check passed. No medical records were accessed.')
            ->assertSuccessful();
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_corrupt_reads_fail_and_still_remove_the_synthetic_object(): void
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, 'different synthetic content');
        rewind($stream);
        $disk->shouldReceive('put')->once()->andReturn(true);
        $disk->shouldReceive('readStream')->once()->andReturn($stream);
        $disk->shouldReceive('delete')->once()->andReturn(true);
        $disk->shouldReceive('exists')->once()->andReturn(false);
        Storage::shouldReceive('disk')->once()->with('private')->andReturn($disk);
        $this->artisan('medical:storage-check', ['--probe' => true])
            ->expectsOutput('Medical storage check failed. Inspect protected configuration and storage availability.')
            ->assertFailed();
        $this->assertFalse(is_resource($stream));
    }

    public function test_cleanup_failure_cannot_report_a_passing_probe_or_leak_sdk_details(): void
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('put')->once()->andThrow(new RuntimeException('https://key:private-secret@storage.example.test/private-object'));
        $disk->shouldReceive('delete')->once()->andReturn(false);
        Storage::shouldReceive('disk')->once()->with('private')->andReturn($disk);
        $this->artisan('medical:storage-check', ['--probe' => true])
            ->expectsOutput('Medical storage check failed. Inspect protected configuration and storage availability.')
            ->expectsOutput('Synthetic object cleanup failed; inspect the restricted storage-checks prefix.')
            ->doesntExpectOutputToContain('private-secret')
            ->doesntExpectOutputToContain('private-object')
            ->assertFailed();
    }
}
