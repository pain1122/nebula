<?php

namespace App\Services;

use App\Models\PublicMediaAttachment;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class PublicMediaService
{
    public function attach(
        User $actor,
        Model $attachable,
        UploadedFile $upload,
        string $collection = 'default',
        ?string $altText = null,
        int $sortOrder = 0,
    ): PublicMediaAttachment {
        Validator::make([
            'file' => $upload,
            'collection' => $collection,
            'alt_text' => $altText,
            'sort_order' => $sortOrder,
        ], [
            'file' => ['required', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/webp'],
            'collection' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/'],
            'alt_text' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['integer', 'min:0'],
        ])->validate();

        if (! $attachable->exists) {
            throw new InvalidArgumentException('Public media can only attach to a persisted model.');
        }

        $mimeType = (string) $upload->getMimeType();
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => throw new DomainException('Unsupported public media MIME type.'),
        };
        $publicId = (string) Str::ulid();
        $safeFilename = $publicId.'.'.$extension;
        $typeSegment = Str::slug(class_basename($attachable));
        $path = Storage::disk('public')->putFileAs(
            "media/{$typeSegment}/{$attachable->getKey()}/{$collection}",
            $upload,
            $safeFilename,
        );

        if (! is_string($path) || $path === '') {
            throw new DomainException('Public media storage failed.');
        }

        try {
            return DB::transaction(function () use (
                $actor,
                $attachable,
                $upload,
                $collection,
                $altText,
                $sortOrder,
                $mimeType,
                $extension,
                $publicId,
                $path,
            ): PublicMediaAttachment {
                $attachment = new PublicMediaAttachment;
                $attachment->forceFill([
                    'public_id' => $publicId,
                    'attachable_type' => $attachable->getMorphClass(),
                    'attachable_id' => $attachable->getKey(),
                    'collection' => $collection,
                    'disk' => 'public',
                    'path' => $path,
                    'mime_type' => $mimeType,
                    'extension' => $extension,
                    'size_bytes' => $upload->getSize(),
                    'checksum_sha256' => hash_file('sha256', $upload->getRealPath()),
                    'alt_text' => $altText,
                    'sort_order' => $sortOrder,
                    'created_by' => $actor->getKey(),
                ])->save();

                return $attachment;
            });
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($path);

            throw $exception;
        }
    }

    public function url(PublicMediaAttachment $attachment): string
    {
        if ($attachment->disk !== 'public' || $attachment->archived_at !== null) {
            throw new DomainException('Public media attachment is not available.');
        }

        return Storage::disk('public')->url($attachment->path);
    }

    public function archive(PublicMediaAttachment $attachment, User $actor, string $reason): void
    {
        $reason = trim($reason);

        if ($reason === '') {
            throw new InvalidArgumentException('A public media archive reason is required.');
        }

        $attachment->forceFill([
            'archived_at' => now(),
            'archived_by' => $actor->getKey(),
            'archive_reason' => $reason,
        ])->save();
    }
}
