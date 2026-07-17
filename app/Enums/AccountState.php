<?php

namespace App\Enums;

enum AccountState: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Closed = 'closed';

    public function permitsAuthentication(): bool
    {
        return $this === self::Active;
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
