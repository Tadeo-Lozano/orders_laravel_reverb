@extends('layouts.order-app', ['title' => $client['title'].' | Pedidos'])

@section('content')
    <main
        id="order-system"
        class="dashboard-shell"
        data-order-app
        data-role="{{ $client['key'] }}"
        data-index-url="{{ route('orders.index') }}"
        data-store-url="{{ route('orders.store') }}"
        data-status-url-template="{{ route('orders.status.update', ['order' => '__ORDER__']) }}"
        data-name-storage-key="pedidos:{{ $client['key'] }}:nombre"
        data-sound-storage-key="pedidos:almacen:sonido"
    >
        <header class="topbar">
            <a href="{{ route('home') }}" class="brand-mark">pedidos/reverb</a>

            <nav class="topbar-nav">
                @foreach ($clients as $navClient)
                    <a
                        href="{{ route('clients.show', $navClient['key']) }}"
                        class="topbar-link"
                        data-active="{{ $navClient['key'] === $client['key'] ? 'true' : 'false' }}"
                    >
                        {{ $navClient['title'] }}
                    </a>
                @endforeach
            </nav>

            <span id="realtime-indicator" class="realtime-pill realtime-pill--loading">Conectando tiempo real...</span>
        </header>

        <section class="hero-card hero-card--{{ $client['key'] }}">
            <div class="hero-copy">
                <p class="eyebrow">{{ $client['eyebrow'] }}</p>
                <h1>{{ $client['title'] }}</h1>
                <p class="hero-text">{{ $client['description'] }}</p>
            </div>

            <div class="identity-panel">
                <label class="field-label" for="operator-name">Nombre de este cliente</label>
                <div class="identity-panel__row">
                    <input id="operator-name" class="text-input" type="text" placeholder="Ej. Martin, Ana o Caja 1">
                    <button id="save-name" class="button button--primary" type="button">Guardar nombre</button>
                </div>
                <p id="identity-status" class="feedback feedback--neutral"></p>

                @if ($client['key'] === 'almacen')
                    <div class="identity-panel__row identity-panel__row--stack">
                        <button id="sound-toggle" class="button button--secondary" type="button">Silenciar sonido</button>
                        <p id="alarm-status" class="feedback feedback--neutral"></p>
                    </div>
                @endif

                <p id="screen-feedback" class="feedback feedback--neutral"></p>
            </div>
        </section>

        <section id="summary-cards" class="stats-grid"></section>

        @if ($client['key'] === 'vendedor')
            <section class="workspace-grid">
                <article class="panel">
                    <div class="panel-heading">
                        <p class="eyebrow">Nuevo pedido</p>
                        <h2>Captura las piezas solicitadas</h2>
                    </div>

                    <form id="order-form" class="stack-lg">
                        <div id="order-items" class="stack-md"></div>

                        <div class="form-actions">
                            <button id="add-item" class="button button--secondary" type="button">Agregar pieza</button>
                            <button id="submit-order" class="button button--primary" type="submit">Pedir</button>
                        </div>

                        <p id="form-feedback" class="feedback feedback--neutral"></p>
                    </form>
                </article>

                <article class="panel">
                    <div class="panel-heading">
                        <p class="eyebrow">Seguimiento</p>
                        <h2>Mis pedidos recientes</h2>
                    </div>

                    <div id="seller-orders" class="stack-md"></div>
                </article>
            </section>
        @elseif ($client['key'] === 'almacen')
            <section class="workspace-grid">
                <article class="panel">
                    <div class="panel-heading">
                        <p class="eyebrow">Cola activa</p>
                        <h2>Pedidos pendientes por surtir</h2>
                    </div>

                    <div id="warehouse-queue" class="stack-md"></div>
                </article>

                <article class="panel">
                    <div class="panel-heading">
                        <p class="eyebrow">Historial</p>
                        <h2>Pedidos atendidos</h2>
                    </div>

                    <div id="warehouse-history" class="stack-md"></div>
                </article>
            </section>
        @else
            <section class="panel">
                <div class="panel-heading">
                    <p class="eyebrow">Monitoreo total</p>
                    <h2>Todos los pedidos registrados</h2>
                </div>

                <div id="monitor-table"></div>
            </section>
        @endif

        <template id="order-item-template">
            <div class="item-row" data-item-row>
                <div class="field-group">
                    <label class="field-label">Codigo de pieza</label>
                    <input class="text-input" data-field="part_code" type="text" placeholder="Ej. BAL-2040">
                </div>

                <div class="field-group">
                    <label class="field-label">Objeto o descripcion</label>
                    <input class="text-input" data-field="object_name" type="text" placeholder="Balata delantera">
                </div>

                <div class="field-group field-group--qty">
                    <label class="field-label">Cantidad</label>
                    <input class="text-input" data-field="quantity" type="number" min="1" step="1" value="1">
                </div>

                <button class="button button--ghost" data-remove-item type="button">Quitar</button>
            </div>
        </template>
    </main>
@endsection
