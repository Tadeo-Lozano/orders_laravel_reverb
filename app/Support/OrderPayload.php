<?php

namespace App\Support;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;

class OrderPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(Order $order): array
    {
        $order->loadMissing('items');

        $status = $order->status;

        if (! $status instanceof OrderStatus) {
            $status = OrderStatus::from((string) $status);
        }

        return [
            'id' => $order->id,
            'folio' => sprintf('PED-%06d', $order->id),
            'requested_by_name' => $order->requested_by_name,
            'handled_by_name' => $order->handled_by_name,
            'status' => $status->value,
            'status_label' => $status->label(),
            'status_tone' => $status->tone(),
            'resolution_notes' => $order->resolution_notes,
            'created_at' => $order->created_at?->toIso8601String(),
            'updated_at' => $order->updated_at?->toIso8601String(),
            'resolved_at' => $order->resolved_at?->toIso8601String(),
            'item_count' => $order->items->count(),
            'total_quantity' => (int) $order->items->sum('quantity'),
            'items' => $order->items
                ->map(static fn (OrderItem $item): array => [
                    'id' => $item->id,
                    'part_code' => $item->part_code,
                    'object_name' => $item->object_name,
                    'quantity' => (int) $item->quantity,
                ])
                ->values()
                ->all(),
        ];
    }
}
