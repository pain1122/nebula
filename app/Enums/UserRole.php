<?php

namespace App\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case Doctor = 'doctor';
    case Patient = 'patient';

    public static function values(): array
    {
        return array_map(
            fn (self $role) => $role->value,
            self::cases()
        );
    }
}