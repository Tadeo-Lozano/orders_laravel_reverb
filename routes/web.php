<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderStatusController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DashboardController::class, 'landing'])->name('home');

Route::get('/pedidos', [OrderController::class, 'index'])->name('orders.index');
Route::post('/pedidos', [OrderController::class, 'store'])->name('orders.store');
Route::patch('/pedidos/{order}/estatus', [OrderStatusController::class, 'update'])->name('orders.status.update');

Route::get('/{client}', [DashboardController::class, 'show'])
    ->whereIn('client', ['vendedor', 'almacen', 'monitor'])
    ->name('clients.show');
