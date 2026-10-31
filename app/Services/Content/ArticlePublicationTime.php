<?php

namespace App\Services\Content;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use InvalidArgumentException;

/** Pure timezone contract; no database, publication, queue or system-clock side effects. */
final class ArticlePublicationTime
{
    public const TIMEZONE = 'Asia/Tehran';

    public const HORIZON_DAYS = 366;

    /** A draft preference may be historical. Arming a schedule separately checks its future window. */
    public function normalize(mixed $input): ?array
    {
        if ($input === null) {
            return null;
        }
        if (! is_array($input) || array_is_list($input)
            || array_diff(array_keys($input), ['local_time', 'timezone']) !== []
            || ($input['timezone'] ?? null) !== self::TIMEZONE || ! is_string($input['local_time'] ?? null)
            || ! preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}\z/', $input['local_time'])) {
            throw new InvalidArgumentException('Invalid article publication time.');
        }
        $local = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $input['local_time'], new DateTimeZone(self::TIMEZONE));
        $errors = DateTimeImmutable::getLastErrors();
        if ($local === false || ($errors !== false && ($errors['warning_count'] || $errors['error_count']))
            || $local->format('Y-m-d\TH:i') !== $input['local_time'] || (int) $local->format('Y') < 2000) {
            throw new InvalidArgumentException('Invalid article publication time.');
        }
        // Historical Tehran DST transitions can repeat a wall-clock minute. Never guess its offset.
        $wall = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $input['local_time'], new DateTimeZone('UTC'));
        $zone = new DateTimeZone(self::TIMEZONE);
        $matches = [];
        foreach ($zone->getTransitions($wall->getTimestamp() - 86400, $wall->getTimestamp() + 86400) as $transition) {
            $candidate = $wall->getTimestamp() - $transition['offset'];
            if ((new DateTimeImmutable('@'.$candidate))->setTimezone($zone)->format('Y-m-d\TH:i') === $input['local_time']) {
                $matches[$candidate] = true;
            }
        }
        if (count($matches) !== 1) {
            throw new InvalidArgumentException('Ambiguous article publication time.');
        }

        return ['local_time' => $input['local_time'], 'timezone' => self::TIMEZONE,
            'publish_at' => $local->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z')];
    }

    /** Never trust a browser-supplied UTC conversion or timezone inferred from its machine. */
    public function read(mixed $stored): ?array
    {
        if ($stored === null) {
            return null;
        }
        if (! is_array($stored) || array_diff(array_keys($stored), ['local_time', 'timezone', 'publish_at']) !== []
            || ! is_string($stored['publish_at'] ?? null)) {
            throw new InvalidArgumentException('Invalid stored publication preference.');
        }
        $normalized = $this->normalize(array_intersect_key($stored, array_flip(['local_time', 'timezone'])));
        if ($normalized['publish_at'] !== $stored['publish_at']) {
            throw new InvalidArgumentException('Invalid stored publication preference.');
        }

        return $normalized;
    }

    public function forSchedule(mixed $input, DateTimeInterface $now): array
    {
        $normalized = $this->normalize($input);
        if ($normalized === null) {
            throw new InvalidArgumentException('A publication time is required.');
        }
        $due = new DateTimeImmutable($normalized['publish_at']);
        $instant = DateTimeImmutable::createFromInterface($now)->setTimezone(new DateTimeZone('UTC'));
        if ($due < $instant->modify('+1 minute') || $due > $instant->modify('+'.self::HORIZON_DAYS.' days')) {
            throw new InvalidArgumentException('Publication must be at least one minute and no more than 366 days ahead.');
        }

        return $normalized;
    }
}
