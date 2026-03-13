@extends('layouts.order-app', ['title' => 'Pedidos en tiempo real'])

@section('content')
    <div class="landing-shell">
        <header class="hero-card hero-card--landing">
            <div class="hero-copy">
                <p class="eyebrow">Laravel Reverb + Echo + MySQL</p>
                <h1>Pedidos de refacciones en tiempo real para ventas, almacen y monitoreo.</h1>
                <p class="hero-text">
                    El vendedor captura una o varias piezas, el almacen recibe la alerta sonora al instante y el monitor
                    ve todo el historial sin recargar la pagina.
                </p>
            </div>

            <div class="hero-checklist">
                <p class="eyebrow">Flujo operativo</p>
                <ul class="bullet-list">
                    <li>El vendedor identifica el cliente por nombre y envia el pedido.</li>
                    <li>Almacen escucha el aviso y marca si entrego, si no hay existencia o si falta inventario.</li>
                    <li>El intermediario revisa quien solicito, quien atendio y el estatus final de cada orden.</li>
                </ul>
            </div>
        </header>

        <section class="client-grid">
            @foreach ($clients as $client)
                <a href="{{ route('clients.show', $client['key']) }}" class="client-card client-card--{{ $client['key'] }}">
                    <p class="eyebrow">{{ $client['eyebrow'] }}</p>
                    <h2>{{ $client['title'] }}</h2>
                    <p>{{ $client['description'] }}</p>
                    <span class="client-card__cta">Abrir cliente</span>
                </a>
            @endforeach
        </section>
    </div>
@endsection
