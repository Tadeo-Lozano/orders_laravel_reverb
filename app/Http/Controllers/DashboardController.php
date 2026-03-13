<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

class DashboardController extends Controller
{
    private const CLIENTS = [
        'vendedor' => [
            'key' => 'vendedor',
            'eyebrow' => 'Punto de solicitud',
            'title' => 'Cabina de ventas',
            'description' => 'Captura una o varias piezas, identifica el pedido por nombre y envialo al almacen sin recargar la pagina.',
        ],
        'almacen' => [
            'key' => 'almacen',
            'eyebrow' => 'Punto de surtido',
            'title' => 'Mesa de almacen',
            'description' => 'Recibe pedidos en tiempo real, escucha la alerta sonora y responde si fue entregado o si no hay existencia.',
        ],
        'monitor' => [
            'key' => 'monitor',
            'eyebrow' => 'Vista operativa',
            'title' => 'Panel intermediario',
            'description' => 'Monitorea todos los pedidos, su estado actual, quien lo solicito y quien lo atendio.',
        ],
    ];

    public function landing(): View
    {
        return view('welcome', [
            'clients' => array_values(self::CLIENTS),
        ]);
    }

    public function show(string $client): View
    {
        abort_unless(array_key_exists($client, self::CLIENTS), 404);

        return view('dashboard', [
            'client' => self::CLIENTS[$client],
            'clients' => array_values(self::CLIENTS),
        ]);
    }
}
