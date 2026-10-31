<?php

namespace Tests\Unit;

use App\Support\MedicalStorageConfiguration;
use DomainException;
use PHPUnit\Framework\TestCase;

class MedicalStorageConfigurationTest extends TestCase
{
    public function test_https_self_hosted_and_default_aws_endpoints_are_supported(): void
    {
        foreach (['https://storage.example.test', 'https://storage.example.test:8333/', null] as $endpoint) {
            MedicalStorageConfiguration::validate(array_replace($this->disk(), ['endpoint' => $endpoint]), 'production');
            $this->addToAssertionCount(1);
        }
    }

    public function test_public_serving_missing_credentials_and_insecure_sdk_settings_are_rejected(): void
    {
        foreach ([
            ['driver' => 's3'], ['visibility' => 'public'], ['serve' => true], ['throw' => false],
            ['url' => 'https://public.example.test'], ['key' => ''], ['secret' => null], ['region' => ''],
            ['bucket' => ''], ['key' => 'minioadmin'], ['secret' => 'secret'], ['http' => ['verify' => false]],
            ['root' => '/var/www/storage/app/private'],
        ] as $change) {
            $this->assertRejected(array_replace($this->disk(), $change), 'production');
        }
    }

    public function test_credentials_query_strings_and_paths_are_not_allowed_in_service_endpoints(): void
    {
        foreach ([
            'ftp://storage.example.test', 'https://key:secret@storage.example.test',
            'https://key@storage.example.test', 'https://storage.example.test?token=secret',
            'https://storage.example.test#secret', 'https://storage.example.test/bucket', 'storage.example.test',
        ] as $endpoint) {
            $this->assertRejected(array_replace($this->disk(), ['endpoint' => $endpoint]), 'production');
        }
    }

    public function test_plain_http_requires_local_environment_and_explicit_synthetic_opt_in(): void
    {
        $disk = array_replace($this->disk(), ['endpoint' => 'http://seaweedfs:8333']);
        $this->assertRejected($disk, 'local');
        $disk['allow_insecure_http'] = true;
        $this->assertRejected($disk, 'production');
        $this->assertRejected($disk, 'staging');
        MedicalStorageConfiguration::validate($disk, 'local');
        MedicalStorageConfiguration::validate($disk, 'testing');
        $this->addToAssertionCount(2);
    }

    /** @return array<string, mixed> */
    private function disk(): array
    {
        return [
            'driver' => 'medical-s3', 'visibility' => 'private', 'serve' => false, 'throw' => true,
            'key' => 'synthetic-key', 'secret' => 'synthetic-secret', 'region' => 'us-east-1',
            'bucket' => 'synthetic-medical', 'endpoint' => 'https://storage.example.test',
            'http' => ['verify' => true],
        ];
    }

    /** @param array<string, mixed> $disk */
    private function assertRejected(array $disk, string $environment): void
    {
        try {
            MedicalStorageConfiguration::validate($disk, $environment);
            $this->fail('Unsafe medical storage configuration must be rejected.');
        } catch (DomainException $exception) {
            $this->assertStringNotContainsString('synthetic-secret', $exception->getMessage());
        }
    }
}
