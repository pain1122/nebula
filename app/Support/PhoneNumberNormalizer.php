<?php

namespace App\Support;

class PhoneNumberNormalizer
{
    public function normalize(?string $phone): string
    {
        $ascii = strtr(trim((string) $phone), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        $digits = preg_replace('/[^0-9]+/', '', $ascii) ?? '';

        if (str_starts_with($digits, '0098')) {
            return '0'.substr($digits, 4);
        }

        if (str_starts_with($digits, '98')) {
            return '0'.substr($digits, 2);
        }

        if (strlen($digits) === 10 && str_starts_with($digits, '9')) {
            return '0'.$digits;
        }

        return $digits;
    }
}
