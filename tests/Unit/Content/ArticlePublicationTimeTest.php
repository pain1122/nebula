<?php

namespace Tests\Unit\Content;

use App\Services\Content\ArticlePublicationTime;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ArticlePublicationTimeTest extends TestCase
{
    public function test_tehran_conversion_is_explicit_and_rolls_across_utc_day_boundaries(): void
    {
        $time = new ArticlePublicationTime;
        $expected = ['local_time' => '2026-10-24T01:15', 'timezone' => 'Asia/Tehran', 'publish_at' => '2026-10-23T21:45:00Z'];
        $this->assertSame($expected, $time->normalize(['local_time' => '2026-10-24T01:15', 'timezone' => 'Asia/Tehran']));
        $this->assertSame($expected, $time->read($expected));
        $this->assertNull($time->normalize(null));
        $this->assertNull($time->read(null));
        $this->assertSame('2028-02-29T08:30:00Z', $time->normalize(['local_time' => '2028-02-29T12:00', 'timezone' => 'Asia/Tehran'])['publish_at']);
    }

    public function test_scheduling_uses_an_injected_instant_and_inclusive_future_bounds(): void
    {
        $time = new ArticlePublicationTime;
        $now = new DateTimeImmutable('2026-10-23T08:30:00Z');
        $this->assertSame('2026-10-23T08:31:00Z', $time->forSchedule(['local_time' => '2026-10-23T12:01', 'timezone' => 'Asia/Tehran'], $now)['publish_at']);
        $this->assertSame('2027-10-24T08:30:00Z', $time->forSchedule(['local_time' => '2027-10-24T12:00', 'timezone' => 'Asia/Tehran'], $now)['publish_at']);
        // Stored preferences remain readable after their date; reading history never arms publication.
        $old = $time->normalize(['local_time' => '2025-01-01T10:00', 'timezone' => 'Asia/Tehran']);
        $this->assertSame($old, $time->read($old));
    }

    public static function invalidPreferences(): array
    {
        return [
            'wrong shape' => ['2026-10-24T12:00'], 'missing timezone' => [['local_time' => '2026-10-24T12:00']],
            'browser timezone' => [['local_time' => '2026-10-24T12:00', 'timezone' => 'Europe/Berlin']],
            'invalid leap day' => [['local_time' => '2026-02-29T12:00', 'timezone' => 'Asia/Tehran']],
            'overflow hour' => [['local_time' => '2026-10-24T24:00', 'timezone' => 'Asia/Tehran']],
            'extra seconds' => [['local_time' => '2026-10-24T12:00:00', 'timezone' => 'Asia/Tehran']],
            'relative expression' => [['local_time' => 'tomorrow', 'timezone' => 'Asia/Tehran']],
            'historical missing DST minute' => [['local_time' => '2021-03-22T00:30', 'timezone' => 'Asia/Tehran']],
            'historical repeated DST minute' => [['local_time' => '2021-09-21T23:30', 'timezone' => 'Asia/Tehran']],
            'forged UTC' => [['local_time' => '2026-10-24T12:00', 'timezone' => 'Asia/Tehran', 'publish_at' => '2026-10-24T00:00:00Z']],
            'trailing bytes' => [['local_time' => "2026-10-24T12:00\0", 'timezone' => 'Asia/Tehran']],
        ];
    }

    #[DataProvider('invalidPreferences')]
    public function test_invalid_or_ambiguous_preferences_are_refused(mixed $input): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ArticlePublicationTime)->normalize($input);
    }

    public static function invalidScheduleWindows(): array
    {
        return [[null], [['local_time' => '2026-10-23T12:00', 'timezone' => 'Asia/Tehran']],
            [['local_time' => '2026-10-22T12:00', 'timezone' => 'Asia/Tehran']],
            [['local_time' => '2027-10-24T12:01', 'timezone' => 'Asia/Tehran']]];
    }

    #[DataProvider('invalidScheduleWindows')]
    public function test_missing_past_or_over_horizon_dates_cannot_arm_publication(mixed $input): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ArticlePublicationTime)->forSchedule($input, new DateTimeImmutable('2026-10-23T08:30:00Z'));
    }

    public function test_tampered_stored_utc_instant_is_refused(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ArticlePublicationTime)->read(['local_time' => '2026-10-24T12:00', 'timezone' => 'Asia/Tehran', 'publish_at' => '2026-10-24T12:00:00Z']);
    }
}
