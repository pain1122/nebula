<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class NotCommonPassword implements ValidationRule
{
    /** @var list<string> */
    private const COMMON_PASSWORDS = [
        '111111111111111',
        '123456789012345',
        'adminadminadmin',
        'administrator',
        'changemechangeme',
        'checkupinocheckupino',
        'iloveyouiloveyou',
        'letmeinletmein',
        'passwordpassword',
        'password123456',
        'qwertyqwertyqwerty',
        'qwertyuiop12345',
        'welcome123456789',
    ];

    /** @param list<string|null> $contextValues */
    public function __construct(private readonly array $contextValues = []) {}

    /** @param \Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString $fail */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        $normalized = $this->normalize($value);
        $blocked = array_merge(
            self::COMMON_PASSWORDS,
            array_values(array_filter(array_map(
                fn (?string $candidate): string => $this->normalize((string) $candidate),
                $this->contextValues,
            ))),
        );

        if (in_array($normalized, $blocked, true)) {
            $fail('The :attribute is too common or is based only on account information.');
        }
    }

    private function normalize(string $value): string
    {
        $lowercase = mb_strtolower(trim($value), 'UTF-8');

        return (string) preg_replace('/[\s\-_!@#$%^&*.,]+/u', '', $lowercase);
    }
}
