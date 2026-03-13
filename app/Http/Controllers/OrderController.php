<?php

namespace App\Http\Controllers;

use App\Enums\OrderStatus;
use App\Events\OrderCreated;
use App\Models\Order;
use App\Support\OrderPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->integer('limit', 100), 250));

        $query = Order::query()
            ->with('items')
            ->latest('id');

        if ($request->boolean('mine_only')) {
            $requesterName = trim((string) $request->input('requested_by_name', ''));

            if ($requesterName === '') {
                return response()->json(['data' => []]);
            }

            $query->where('requested_by_name', $requesterName);
        }

        $orders = $query
            ->limit($limit)
            ->get()
            ->map(static fn (Order $order): array => OrderPayload::from($order))
            ->values();

        return response()->json([
            'data' => $orders,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'requested_by_name' => ['required', 'string', 'max:100'],
            'items' => ['required', 'array', 'min:1', 'max:12'],
            'items.*.part_code' => ['required', 'string', 'max:60'],
            'items.*.object_name' => ['required', 'string', 'max:120'],
            'items.*.quantity' => ['required', 'integer', 'between:1,999'],
        ]);

        $order = DB::transaction(function () use ($validated): Order {
            $order = Order::create([
                'requested_by_name' => trim($validated['requested_by_name']),
                'status' => OrderStatus::Pending,
            ]);

            $items = collect($validated['items'])
                ->map(static fn (array $item): array => [
                    'part_code' => Str::upper(trim($item['part_code'])),
                    'object_name' => trim($item['object_name']),
                    'quantity' => (int) $item['quantity'],
                ])
                ->all();

            $order->items()->createMany($items);

            return $order->load('items');
        });

        $broadcasted = true;

        try {
            OrderCreated::dispatch($order);
        } catch (Throwable $exception) {
            $broadcasted = false;

            Log::warning('No se pudo emitir el evento de pedido creado.', [
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
                    : 'Pedido guardado, pero Reverb no esta disponible. La pantalla seguira sincronizando automaticamente.',
            ],
        ], 201);
    }
}
