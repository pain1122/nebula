<?php

namespace Tests\Feature\Services;

use App\Support\FileUploadPolicy;
use DomainException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class FileUploadPolicyTest extends TestCase
{
    public function test_type_and_field_limits_are_exact_and_server_owned(): void
    {
        config(['uploads.sections.medical.type_limits.application/pdf' => 1024]);
        $policy = FileUploadPolicy::forSection('medical');
        foreach ([1024 => true, 1025 => false] as $bytes => $accepted) {
            $file = UploadedFile::fake()->createWithContent('synthetic.pdf', str_pad("%PDF-1.4\n", $bytes, ' '));
            $this->assertSame($accepted, Validator::make(['file' => $file], ['file' => $policy->fileRules()])->passes());
        }
        $field = FileUploadPolicy::forSection('medical', ['allowed_mime_types' => ['application/pdf'], 'max_bytes' => 512]);
        $this->assertSame(['application/pdf' => 512], $field->descriptor()['max_bytes_by_mime']);
        $this->assertSame(10 * 1024 * 1024, $policy->maxBytesForMime('image/png'));
    }

    public function test_large_video_and_zip_limits_can_be_resolved_for_registered_sections(): void
    {
        config([
            'uploads.capacity_max_bytes' => 1024 * 1024 * 1024,
            'uploads.sections.site_assets' => [
                'max_bytes' => 256 * 1024 * 1024,
                'allowed_mime_types' => ['video/mp4', 'application/zip'],
                'type_limits' => ['application/zip' => 512 * 1024 * 1024],
            ],
        ]);
        $section = FileUploadPolicy::forSection('site_assets');
        $this->assertSame(256 * 1024 * 1024, $section->maxBytesForMime('video/mp4'));
        $this->assertSame(512 * 1024 * 1024, $section->maxBytesForMime('application/zip'));
        $field = FileUploadPolicy::forSection('site_assets', [
            'allowed_mime_types' => ['video/mp4'], 'max_bytes' => 50 * 1024 * 1024,
        ]);
        $this->assertSame(50 * 1024 * 1024, $field->maxBytesForMime('video/mp4'));
        // Resolution does not activate these formats in the medical section.
        $this->expectException(DomainException::class);
        FileUploadPolicy::forSection('medical')->maxBytesForMime('video/mp4');
    }

    #[DataProvider('invalidSizes')]
    public function test_invalid_capacity_fails_closed(mixed $bytes): void
    {
        config(['uploads.capacity_max_bytes' => $bytes]);
        $this->expectException(DomainException::class);
        FileUploadPolicy::forSection('medical');
    }

    public static function invalidSizes(): array
    {
        return [[0], [-1], [null], [true], [1.5], ['10M'], ['unlimited'], ['9223372036854775808']];
    }

    public function test_environment_integer_bytes_are_supported_without_lossy_casts(): void
    {
        config(['uploads.capacity_max_bytes' => '10485760', 'uploads.sections.medical.max_bytes' => '10485760']);
        $this->assertSame(10485760, FileUploadPolicy::forSection('medical')->maxBytesForMime('application/pdf'));
    }

    #[DataProvider('invalidFieldRules')]
    public function test_field_cannot_broaden_parent_authority(array $rules): void
    {
        $this->expectException(DomainException::class);
        FileUploadPolicy::forSection('medical', $rules);
    }

    public static function invalidFieldRules(): array
    {
        return [
            [['max_bytes' => 10 * 1024 * 1024 + 1]],
            [['allowed_mime_types' => ['video/mp4']]],
            [['allowed_mime_types' => []]],
            [['allowed_mime_types' => ['application/pdf', 'application/pdf']]],
            [['scan_required' => false]],
        ];
    }

    public function test_section_size_above_deployment_capacity_is_rejected(): void
    {
        config(['uploads.sections.medical.type_limits.application/pdf' => 50 * 1024 * 1024]);
        $this->expectException(DomainException::class);
        FileUploadPolicy::forSection('medical');
    }

    public function test_unknown_section_does_not_fall_back_to_a_looser_policy(): void
    {
        $this->expectException(DomainException::class);
        FileUploadPolicy::forSection('unregistered_downloads');
    }
}
