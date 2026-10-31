<?php

namespace App\Services\Health;

use DateTimeImmutable;
use Illuminate\Validation\ValidationException;

/** Canonical, bounded data; never accepts free text, derived results or client provenance. */
final class HealthInput
{
    public static function fail(): never
    {
        // Do not echo any private submitted value in exceptions or audit/log messages.
        throw ValidationException::withMessages(['health' => 'Invalid health information. Review the selected options, values and dates.']);
    }

    public static function keys(array $value, array $allowed): void
    {
        if (array_diff(array_keys($value), $allowed)) {
            self::fail();
        }
    }

    public static function digits(string $value): string
    {
        return strtr($value, array_combine(preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789')));
    }

    public static function date(mixed $value): string
    {
        if (! is_string($value)) {
            self::fail();
        }
        $value = self::digits($value);
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (! $parsed || $parsed->format('Y-m-d') !== $value || $value < '1900-01-01' || $value > now('Asia/Tehran')->toDateString()) {
            self::fail();
        }

        return $value;
    }

    public static function facts(array $changes): array
    {
        self::keys($changes, ['birth_date', 'gender', 'conditions', 'allergies', ...HealthCatalog::LIFESTYLE]);
        foreach ($changes as $code => &$value) {
            if ($value === null) {
                continue;
            }
            if ($code === 'birth_date') {
                $value = self::date($value);
            } elseif ($code === 'gender') {
                if (! in_array($value, ['male', 'female'], true)) {
                    self::fail();
                }
            } elseif (in_array($code, ['conditions', 'allergies'], true)) {
                if (! is_array($value)) {
                    self::fail();
                }
                self::keys($value, ['status', 'codes']);
                $status = $value['status'] ?? null;
                $codes = $value['codes'] ?? null;
                if (! in_array($status, HealthCatalog::STATUSES, true) || ! is_array($codes) || ! array_is_list($codes) || count($codes) > 30
                    || array_filter($codes, fn ($id) => ! is_string($id)) || count(array_unique($codes)) !== count($codes)
                    || ($status !== 'yes' && $codes !== [])) {
                    self::fail();
                }
                $kind = $code === 'conditions' ? 'condition' : 'allergy';
                $allowed = array_column(array_filter(HealthCatalog::terms(), fn ($term) => $term['kind'] === $kind && $term['active']), 'id');
                if (array_diff($codes, $allowed)) {
                    self::fail();
                }
                sort($codes, SORT_STRING);
                $value = ['status' => $status, 'codes' => $codes];
            } elseif (! in_array($value, HealthCatalog::STATUSES, true)) {
                self::fail();
            }
        }
        unset($value);

        return $changes;
    }

    public static function measurements(array $input): array
    {
        self::keys($input, ['weight', 'height']);
        foreach ($input as $metric => &$value) {
            if ($value === null) {
                continue;
            }
            if (! is_array($value)) {
                self::fail();
            }
            self::keys($value, ['value', 'measured_on', 'correction_of']);
            $quantity = $value['value'] ?? null;
            if (! is_string($quantity) || ! preg_match('/\A([0-9]{1,4})(?:\.([0-9]{1,2}))?\z/', self::digits($quantity), $parts)) {
                self::fail();
            }
            $hundredths = ((int) $parts[1]) * 100 + (int) str_pad($parts[2] ?? '', 2, '0');
            // Broad technical representation bounds, not clinical eligibility thresholds.
            if ($hundredths < 1 || $hundredths > ($metric === 'weight' ? 100000 : 30000)) {
                self::fail();
            }
            $correction = $value['correction_of'] ?? null;
            if ($correction !== null && (! is_string($correction) || ! preg_match('/\A[0-9a-hjkmnp-tv-z]{26}\z/i', $correction))) {
                self::fail();
            }
            $value = ['hundredths' => $hundredths, 'unit' => $metric === 'weight' ? 'kg' : 'cm', 'measured_on' => self::date($value['measured_on'] ?? null), 'correction_of' => $correction === null ? null : strtolower($correction)];
        }
        unset($value);

        return $input;
    }
}
