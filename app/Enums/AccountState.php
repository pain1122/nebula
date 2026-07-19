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

    public function canTransitionTo(self $target): bool
    {
        return match ($this) {
            self::Active => in_array($target, [self::Suspended, self::Closed], true),
            self::Suspended => in_array($target, [self::Active, self::Closed], true),
            self::Closed => false,
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
