<?php

namespace App\Services\Health;

/** Versioned product vocabulary, not diagnostic criteria or a clinical coding standard. */
final class HealthCatalog
{
    public const VERSION = 'health-2026-10-22.1';

    public const STATUSES = ['yes', 'no', 'unknown', 'declined'];

    public const LIFESTYLE = ['smoking', 'alcohol', 'low_activity', 'stress', 'family_history'];

    /** Stable IDs are never translated/reused. Retired entries remain resolvable. */
    public static function terms(): array
    {
        return [
            self::term('condition.hypertension', 'condition', 'High blood pressure', 'فشار خون بالا'),
            self::term('condition.diabetes', 'condition', 'Diabetes', 'دیابت'),
            self::term('condition.hyperlipidemia', 'condition', 'High blood lipids', 'چربی خون بالا'),
            self::term('condition.asthma', 'condition', 'Asthma', 'آسم'),
            self::term('condition.heart_disease', 'condition', 'Heart disease', 'بیماری قلبی'),
            self::term('condition.kidney_disease', 'condition', 'Kidney disease', 'بیماری کلیوی'),
            self::term('condition.thyroid_disorder', 'condition', 'Thyroid disorder', 'اختلال تیروئید'),
            self::term('allergy.penicillin', 'allergy', 'Penicillin', 'پنی‌سیلین'),
            self::term('allergy.latex', 'allergy', 'Latex', 'لاتکس'),
            self::term('allergy.peanut', 'allergy', 'Peanut', 'بادام زمینی'),
            self::term('allergy.tree_nut', 'allergy', 'Tree nuts', 'مغزهای درختی'),
            self::term('allergy.milk', 'allergy', 'Milk', 'شیر'),
            self::term('allergy.egg', 'allergy', 'Egg', 'تخم‌مرغ'),
            self::term('allergy.seafood', 'allergy', 'Seafood', 'غذاهای دریایی'),
        ];
    }

    private static function term(string $id, string $kind, string $en, string $fa): array
    {
        return ['id' => $id, 'kind' => $kind, 'active' => true, 'labels' => ['en' => $en, 'fa' => $fa]];
    }

    public static function response(): array
    {
        return ['version' => self::VERSION, 'terms' => self::terms()];
    }
}
