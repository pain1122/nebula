<?php

namespace App\Enums;

enum UserRole: string
{
    case RootAdmin = 'root-admin';
    case Admin = 'admin';
    case Doctor = 'doctor';
    case Patient = 'patient';

    public static function values(): array
    {
        return array_map(
            fn(self $role) => $role->value,
            self::cases()
        );
    }
    public static function adminPanelValues(): array
    {
        return [
            self::Admin->value,
            self::RootAdmin->value,
        ];
    }

    public static function adminAssignableValues(): array
    {
        return [
            self::Admin->value,
            self::Doctor->value,
            self::Patient->value,
        ];
    }
}