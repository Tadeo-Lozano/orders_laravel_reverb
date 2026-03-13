<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Events\OrderCreated;
use App\Events\OrderUpdated;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class OrderFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_dashboard_routes_are_available(): void
    {
        $this->get('/')->assertOk();
        $this->get('/vendedor')->assertOk();
        $this->get('/almacen')->assertOk();
        $this->get('/monitor')->assertOk();
    }

    public function test_a_seller_can_create_an_order_with_multiple_items(): void
    {
        Event::fake([OrderCreated::class]);

        $response = $this->postJson('/pedidos', [
            'requested_by_name' => 'Ana',
            'items' => [
                [
                    'part_code' => 'BAL-2040',
                    'object_name' => 'Balata delantera',
                    'quantity' => 2,
                ],
                [
                    'part_code' => 'FIL-100',
                    'object_name' => 'Filtro de aceite',
                    'quantity' => 1,
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.requested_by_name', 'Ana')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonCount(2, 'data.items');

        $this->assertDatabaseHas('orders', [
            'requested_by_name' => 'Ana',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('order_items', [
            'part_code' => 'BAL-2040',
            'object_name' => 'Balata delantera',
            'quantity' => 2,
        ]);

        Event::assertDispatched(OrderCreated::class);
    }

    public function test_warehouse_can_update_order_status(): void
    {
        Event::fake([OrderUpdated::class]);

        $order = Order::create([
            'requested_by_name' => 'Martin',
            'status' => OrderStatus::Pending,
        ]);

        $order->items()->create([
            'part_code' => 'AMP-44',
            'object_name' => 'Amortiguador',
            'quantity' => 1,
        ]);

        $response = $this->patchJson("/pedidos/{$order->id}/estatus", [
            'handled_by_name' => 'Luis',
            'status' => OrderStatus::Delivered->value,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.handled_by_name', 'Luis')
            ->assertJsonPath('data.status', 'delivered');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'handled_by_name' => 'Luis',
            'status' => 'delivered',
        ]);

        Event::assertDispatched(OrderUpdated::class);
    }

    public function test_index_can_filter_orders_by_requester_name(): void
    {
        $anaOrder = Order::create([
            'requested_by_name' => 'Ana',
            'status' => OrderStatus::Pending,
        ]);

        $anaOrder->items()->create([
            'part_code' => 'BAL-10',
            'object_name' => 'Balata',
            'quantity' => 1,
        ]);

        $joseOrder = Order::create([
            'requested_by_name' => 'Jose',
            'status' => OrderStatus::Pending,
        ]);

        $joseOrder->items()->create([
            'part_code' => 'ACE-20',
            'object_name' => 'Aceite',
            'quantity' => 1,
        ]);

        $response = $this->getJson('/pedidos?mine_only=1&requested_by_name=Ana');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.requested_by_name', 'Ana');
    }
}
