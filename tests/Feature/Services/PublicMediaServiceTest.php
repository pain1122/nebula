<?php

namespace Tests\Feature\Services;

use App\Models\MarketplaceHospital;
use App\Models\User;
use App\Services\PublicMediaService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PublicMediaServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('private');
    }

    public function test_image_attachment_uses_only_public_disk_with_guarded_metadata(): void
    {
        $attachment = app(PublicMediaService::class)->attach(
            User::factory()->admin()->create(),
            MarketplaceHospital::factory()->create(),
            $this->png('hospital.png'),
            'hero',
            'Hospital entrance',
            10,
        );

        $this->assertSame('public', $attachment->disk);
        $this->assertSame('image/png', $attachment->mime_type);
        $this->assertSame(64, strlen($attachment->checksum_sha256));
        Storage::disk('public')->assertExists($attachment->path);
        $this->assertSame([], Storage::disk('private')->allFiles());
        $this->assertStringContainsString('/storage/', app(PublicMediaService::class)->url($attachment));
    }

    public function test_non_image_and_archived_media_are_not_publicly_available(): void
    {
        $actor = User::factory()->admin()->create();
        $hospital = MarketplaceHospital::factory()->create();

        try {
            app(PublicMediaService::class)->attach(
                $actor,
                $hospital,
                UploadedFile::fake()->create('document.pdf', 4, 'application/pdf'),
            );
            $this->fail('Non-image public media must be rejected.');
        } catch (ValidationException) {
            $this->assertSame([], Storage::disk('public')->allFiles());
        }

        $attachment = app(PublicMediaService::class)->attach(
            $actor,
            $hospital,
            $this->png('hospital.png'),
        );
        app(PublicMediaService::class)->archive($attachment, $actor, 'Outdated image');

        $this->expectException(DomainException::class);
        app(PublicMediaService::class)->url($attachment->fresh());
    }

    private function png(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            $name,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZCrkAAAAASUVORK5CYII=', true),
        );
    }
}
