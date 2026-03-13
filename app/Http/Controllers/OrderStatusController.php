<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Events\OrderUpdated;
use App\Models\Order;
use App\Support\OrderPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Throwable;

class OrderStatusController extends Controller
{
    public function update(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'handled_by_name' => ['required', 'string', 'max:100'],
            'status' => ['required', 'string', Rule::in(OrderStatus::terminalValues())],
            'resolution_notes' => ['nullable', 'string', 'max:255'],
        ]);

        $order->fill([
            'handled_by_name' => trim($validated['handled_by_name']),
            'status' => $validated['status'],
            'resolution_notes' => filled($validated['resolution_notes'] ?? null)
                ? trim($validated['resolution_notes'])
                : null,
            'resolved_at' => now(),
        ])->save();

        $order->load('items');

        $broadcasted = true;

        try {
            OrderUpdated::dispatch($order);
        } catch (Throwable $exception) {
            $broadcasted = false;

            Log::warning('No se pudo emitir el evento de actualizacion de pedido.', [
                'order_id' => $order->id,
                'message' => $exception->getMessage(),
            ]);
        }

        return response()->json([
            'data' => OrderPayload::from($order),
            'meta' => [
                'broadcasted' => $broadcasted,
                'realtime_message' => $broadcasted
                    ? null
                    : 'Estatus guardado, pero Reverb no esta disponible. La pantalla seguira sincronizando automaticamente.',
            ],
        ]);
    }
}
