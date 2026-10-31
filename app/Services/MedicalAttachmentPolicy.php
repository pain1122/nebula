<?php

namespace App\Services;

use App\Enums\ReservationMedicalRequestStatus;
use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use DomainException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;

final class MedicalAttachmentPolicy
{
    public function __construct(private readonly UploadPolicySettings $settings) {}

    /** Only categories supported by both current operator policy and content validators. */
    public function categories(): array
    {
        $allowed = $this->settings->capture('medical')['policy']->descriptor()['allowed_mime_types'];

        return array_map(static function (string $key, array $types) use ($allowed): array {
            $types = array_values(array_intersect($types, $allowed));

            return ['key' => $key, 'available' => $types !== [], 'allowed_mime_types' => $types];
        }, ['document', 'media', 'archive', 'multimedia'], [
            ['application/pdf'], ['image/jpeg', 'image/png'], [], [],
        ]);
    }

    public function rulesForCategories(array $categories): array
    {
        $options = array_column($this->categories(), null, 'key');
        if ($categories === [] || count($categories) !== count(array_unique($categories))) {
            throw new DomainException('Choose available attachment categories.');
        }
        $types = [];
        foreach ($categories as $category) {
            if (! is_string($category) || ! ($options[$category]['available'] ?? false)) {
                throw new DomainException('This attachment category is not currently available.');
            }
            $types = [...$types, ...$options[$category]['allowed_mime_types']];
        }

        return ['allowed_mime_types' => array_values(array_unique($types))];
    }

    public function assertSchemaReady(): void
    {
        if (! Schema::hasColumns('reservation_medical_requests', ['attachment_policy', 'attachment_policy_revision'])) {
            throw new DomainException('Medical attachment policy persistence is not ready.');
        }
    }

    /** Assigned-doctor authorization and the reservation lock belong to the creating service. */
    public function issue(array $rules = []): array
    {
        if (array_key_exists('max_bytes', $rules) && ! is_int($rules['max_bytes'])) {
            throw new DomainException('Attachment size must be an integer number of bytes.');
        }
        $capture = $this->settings->capture('medical', $rules, lock: true);
        $descriptor = $capture['policy']->descriptor();
        sort($descriptor['allowed_mime_types'], SORT_STRING);
        ksort($descriptor['max_bytes_by_mime'], SORT_STRING);
        $snapshot = [
            'version' => 1,
            'field' => 'file',
            'section' => 'medical',
            'section_revision' => $capture['revision'],
            ...$descriptor,
        ];

        return ['snapshot' => $snapshot, 'revision' => self::digest($snapshot)];
    }

    /** Resolve canonical records before validation/storage, also for direct service callers. */
    public function forUpload(
        User $actor,
        ReservationMedicalRequest $medicalRequest,
        ?Reservation $reservation = null,
        bool $lock = false,
    ): array {
        $query = ReservationMedicalRequest::query()->with('reservation');
        $canonical = ($lock ? $query->lockForUpdate() : $query)->findOrFail($medicalRequest->getKey());
        Gate::forUser($actor)->authorize('upload', $canonical);
        if ($reservation !== null && $canonical->reservation_id !== $reservation->getKey()) {
            throw new DomainException('Medical request reservation is invalid.');
        }
        if ($canonical->status !== ReservationMedicalRequestStatus::Open
            || $canonical->retention_until === null || $canonical->retention_until->isPast()) {
            throw new DomainException('Only an open retained medical request accepts files.');
        }

        return $this->resolve($canonical, $lock);
    }

    /** Safe authorized response; missing legacy policies are explicit and never manufactured. */
    public function describe(User $actor, ReservationMedicalRequest $medicalRequest): array
    {
        // Resource callers may project reservation to id/public_id; authorize full canonical ownership.
        $medicalRequest = ReservationMedicalRequest::query()->with('reservation')->findOrFail($medicalRequest->getKey());
        Gate::forUser($actor)->authorize('view', $medicalRequest);
        try {
            $resolved = $this->resolve($medicalRequest);

            return [
                'state' => 'available',
                'field' => 'file',
                'revision' => $resolved['revision'],
                'issued_revision' => $resolved['issued_revision'],
                ...$resolved['policy']->descriptor(),
            ];
        } catch (DomainException|\Illuminate\Validation\ValidationException) {
            return ['state' => 'unavailable', 'field' => 'file'];
        }
    }

    private function resolve(ReservationMedicalRequest $medicalRequest, bool $lock = false): array
    {
        $snapshot = $medicalRequest->attachment_policy;
        $revision = $medicalRequest->attachment_policy_revision;
        self::validateSnapshot($snapshot, $revision);
        $current = $this->settings->capture('medical', lock: $lock);
        $policy = $current['policy']->intersect($snapshot['max_bytes_by_mime']);

        return [
            'policy' => $policy,
            'issued_revision' => $revision,
            'revision' => self::digest([
                'issued_revision' => $revision,
                'section_revision' => $current['revision'],
                ...$policy->descriptor(),
            ]),
        ];
    }

    public static function validateSnapshot(mixed $snapshot, mixed $revision): void
    {
        $keys = ['version', 'field', 'section', 'section_revision', 'allowed_mime_types', 'max_bytes_by_mime'];
        if (! is_array($snapshot) || count($snapshot) !== count($keys)
            || array_diff(array_keys($snapshot), $keys) !== []
            || ($snapshot['version'] ?? null) !== 1 || ($snapshot['field'] ?? null) !== 'file'
            || ($snapshot['section'] ?? null) !== 'medical'
            || ! self::isRevision($snapshot['section_revision'] ?? null)
            || ! self::isRevision($revision)) {
            throw new DomainException('Medical attachment policy is missing or invalid.');
        }
        $types = $snapshot['allowed_mime_types'];
        $limits = $snapshot['max_bytes_by_mime'];
        if (! is_array($types) || ! array_is_list($types) || $types === []
            || ! is_array($limits) || count($limits) !== count($types)) {
            throw new DomainException('Medical attachment policy is invalid.');
        }
        $seen = [];
        foreach ($types as $type) {
            if (! is_string($type) || ! preg_match('~^[a-z0-9.+-]+/[a-z0-9.+-]+$~D', $type)
                || isset($seen[$type]) || ! isset($limits[$type])
                || ! is_int($limits[$type]) || $limits[$type] < 1) {
                throw new DomainException('Medical attachment policy is invalid.');
            }
            $seen[$type] = true;
        }
        if (! hash_equals(self::digest($snapshot), $revision)) {
            throw new DomainException('Medical attachment policy integrity check failed.');
        }
    }

    private static function isRevision(mixed $revision): bool
    {
        return is_string($revision) && preg_match('/^[a-f0-9]{64}$/D', $revision) === 1;
    }

    private static function digest(array $value): string
    {
        $canonicalize = function (array $items) use (&$canonicalize): array {
            if (! array_is_list($items)) {
                ksort($items, SORT_STRING);
            }
            foreach ($items as &$item) {
                if (is_array($item)) {
                    $item = $canonicalize($item);
                }
            }

            return $items;
        };

        return hash('sha256', json_encode($canonicalize($value), JSON_THROW_ON_ERROR));
    }
}
