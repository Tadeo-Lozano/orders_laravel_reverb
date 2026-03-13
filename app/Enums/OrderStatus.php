<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Delivered = 'delivered';
    case Unavailable = 'unavailable';
    case InsufficientStock = 'insufficient_stock';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendiente',
            self::Delivered => 'Entregado',
            self::Unavailable => 'Sin existencia',
            self::InsufficientStock => 'Existencia insuficiente',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Pending => 'amber',
            self::Delivered => 'emerald',
            self::Unavailable => 'rose',
            self::InsufficientStock => 'orange',
        };
    }

    /**
     * @return array<int, string>
     */
    public static function terminalValues(): array
    {
        return [
            self::Delivered->value,
            self::Unavailable->value,
            self::InsufficientStock->value,
        ];
    }
}
