<?php

namespace App\Services\Content;

use App\Services\UploadPolicySettings;
use App\Support\FileUploadPolicy;
use App\Support\MedicalContentPolicy;

final class ArticleMediaEligibility
{
    public function policy(bool $lock = false): array
    {
        $captured = app(UploadPolicySettings::class)->capture('public_media', lock: $lock);
        $descriptor = $captured['policy']->descriptor();
        $limits = array_intersect_key($descriptor['max_bytes_by_mime'], array_flip(['image/jpeg', 'image/png']));
        foreach ($limits as &$limit) {
            $limit = min($limit, FileUploadPolicy::scannerMaxBytes(), 33554432);
        }
        unset($limit);

        return ['revision' => hash('sha256', $captured['revision'].json_encode($limits, JSON_THROW_ON_ERROR)), 'limits' => $limits];
    }

    public function blocker(object $row, ?array $policy = null): ?string
    {
        try {
            $policy ??= $this->policy();
            if ($row->purpose !== 'article_editorial' || $row->disk !== 'article-media' || $row->status !== 'released' || $row->archived_at !== null) {
                return 'not_released';
            }
            if (! isset($policy['limits'][$row->mime_type]) || (int) $row->size_bytes < 1 || (int) $row->size_bytes > $policy['limits'][$row->mime_type]
                || $row->upload_policy_revision !== $policy['revision']) {
                return 'policy_changed';
            }
            $evidence = json_decode($row->validation_evidence ?? '', true, 12, JSON_THROW_ON_ERROR);
            $updated = strtotime($evidence['scanner_database_updated_at'] ?? '');
            $validated = strtotime($row->validated_at ?? '');
            if (($evidence['scanner_engine'] ?? null) !== 'clamav' || ($evidence['scanner_version'] ?? null) !== '1.5.4'
                || ! preg_match('/\A[0-9]+\z/', $evidence['scanner_database_version'] ?? '')
                || ($evidence['scan_checksum_sha256'] ?? null) !== $row->checksum_sha256
                || ($evidence['content_policy_revision'] ?? null) !== MedicalContentPolicy::current()->revision
                || ! preg_match('~\Agd-(?:[0-9]+\.[0-9]+\.[0-9]+|bundled/php-[0-9]+\.[0-9]+\.[0-9]+)/medical-v1\z~', $evidence['content_validator'] ?? '')
                || ! $updated || ! $validated || $updated > time() + 300 || $updated < time() - 172800
                || $validated > time() + 300 || $validated < $updated - 300 || $row->released_at === null
                || (int) $row->width < 1 || (int) $row->height < 1 || (int) $row->width > 8192 || (int) $row->height > 8192
                || (int) $row->width * (int) $row->height > 16000000) {
                return 'validation_required';
            }

            return null;
        } catch (\Throwable) {
            return 'validation_unavailable';
        }
    }

    public function snapshot(object $row): array
    {
        return ['id' => strtolower($row->public_id), 'checksum_sha256' => $row->checksum_sha256, 'mime_type' => $row->mime_type,
            'size_bytes' => (int) $row->size_bytes, 'width' => (int) $row->width, 'height' => (int) $row->height];
    }
}
