class OrderSystem {
    constructor(rootElement) {
        this.root = rootElement;
        this.role = this.root.dataset.role;
        this.urls = {
            index: this.root.dataset.indexUrl,
            store: this.root.dataset.storeUrl,
            statusTemplate: this.root.dataset.statusUrlTemplate,
        };

        this.nameStorageKey = this.root.dataset.nameStorageKey;
        this.soundStorageKey = this.root.dataset.soundStorageKey;
        this.formatter = new Intl.DateTimeFormat('es-MX', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });

        this.state = {
            orders: [],
            operatorName: safeReadStorage(this.nameStorageKey) ?? '',
            soundMuted: safeReadStorage(this.soundStorageKey) === '1',
            alarmActive: false,
        };

        this.audioContext = null;
        this.audioReady = false;
        this.alarmTimer = null;
        this.pollingTimer = null;
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        this.hydrateIdentity();
        this.render();
        this.armAudioUnlock();
        this.setupEcho();

        if (this.role !== 'vendedor' || this.state.operatorName) {
            await this.fetchOrders();
        } else {
            this.renderRolePanels();
        }
    }

    cacheElements() {
        this.elements = {
            realtimeIndicator: document.getElementById('realtime-indicator'),
            operatorNameInput: document.getElementById('operator-name'),
            saveNameButton: document.getElementById('save-name'),
            identityStatus: document.getElementById('identity-status'),
            screenFeedback: document.getElementById('screen-feedback'),
            summaryCards: document.getElementById('summary-cards'),
            orderForm: document.getElementById('order-form'),
            orderItems: document.getElementById('order-items'),
            addItemButton: document.getElementById('add-item'),
            submitOrderButton: document.getElementById('submit-order'),
            formFeedback: document.getElementById('form-feedback'),
            sellerOrders: document.getElementById('seller-orders'),
            warehouseQueue: document.getElementById('warehouse-queue'),
            warehouseHistory: document.getElementById('warehouse-history'),
            monitorTable: document.getElementById('monitor-table'),
            soundToggle: document.getElementById('sound-toggle'),
            alarmStatus: document.getElementById('alarm-status'),
            itemTemplate: document.getElementById('order-item-template'),
        };
    }

    bindEvents() {
        this.elements.saveNameButton?.addEventListener('click', () => {
            void this.saveOperatorName();
        });

        this.elements.operatorNameInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void this.saveOperatorName();
            }
        });

        this.elements.orderForm?.addEventListener('submit', (event) => {
            void this.submitOrder(event);
        });

        this.elements.addItemButton?.addEventListener('click', () => {
            this.appendItemRow();
        });

        this.elements.soundToggle?.addEventListener('click', () => {
            this.toggleSound();
        });

        this.root.addEventListener('click', (event) => {
            const removeButton = event.target.closest('[data-remove-item]');

            if (removeButton) {
                this.removeItemRow(removeButton.closest('[data-item-row]'));
                return;
            }

            const actionButton = event.target.closest('[data-status-action]');

            if (actionButton) {
                void this.updateOrderStatus(
                    actionButton.dataset.orderId,
                    actionButton.dataset.status,
                );
            }
        });
    }

    hydrateIdentity() {
        if (this.elements.operatorNameInput) {
            this.elements.operatorNameInput.value = this.state.operatorName;
        }

        if (this.state.operatorName) {
            this.setIdentityStatus(`Cliente identificado como ${this.state.operatorName}.`, 'success');
        } else {
            this.setIdentityStatus('Guarda el nombre que va a identificar este cliente.', 'neutral');
        }

        if (this.role === 'vendedor') {
            this.ensureOneItemRow();
        }

        this.renderSoundState();
    }

    armAudioUnlock() {
        if (this.role !== 'almacen') {
            return;
        }

        const unlock = () => {
            if (this.audioReady) {
                return;
            }

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;

            if (!AudioContextClass) {
                this.setAlarmStatus('Este navegador no soporta audio para la alerta.', 'error');
                return;
            }

            try {
                this.audioContext = new AudioContextClass();
                this.audioReady = true;
                this.renderSoundState();
            } catch (error) {
                console.error(error);
                this.setAlarmStatus('No se pudo activar el sonido en este navegador.', 'error');
            }
        };

        document.addEventListener('pointerdown', unlock, { once: true, capture: true });
        document.addEventListener('keydown', unlock, { once: true, capture: true });
    }

    setupEcho() {
        if (!window.Echo) {
            this.setRealtimeStatus('Tiempo real no disponible', 'error');
            this.startPollingFallback();
            return;
        }

        this.setRealtimeStatus('Conectando tiempo real...', 'loading');
        this.startPollingFallback();

        const connection = window.Echo.connector?.pusher?.connection;

        connection?.bind('connected', () => {
            this.setRealtimeStatus('Tiempo real activo', 'online');
            this.stopPollingFallback();
        });

        connection?.bind('disconnected', () => {
            this.setRealtimeStatus('Tiempo real desconectado, activando respaldo', 'error');
            this.startPollingFallback();
        });

        connection?.bind('error', () => {
            this.setRealtimeStatus('Tiempo real con error, activando respaldo', 'error');
            this.startPollingFallback();
        });

        window.Echo.channel('orders')
            .listen('.order.created', ({ order }) => {
                this.handleIncomingOrder(order, true);
            })
            .listen('.order.updated', ({ order }) => {
                this.handleIncomingOrder(order, false);
            });
    }

    async fetchOrders(options = {}) {
        const silent = options.silent === true;

        try {
            const params = {
                limit: 120,
            };

            if (this.role === 'vendedor') {
                params.mine_only = true;
                params.requested_by_name = this.state.operatorName;
            }

            const response = await window.axios.get(this.urls.index, { params });

            this.state.orders = Array.isArray(response.data?.data)
                ? response.data.data
                : [];

            this.sortOrdersDescending();
            this.render();

            if (!silent) {
                this.setSystemFeedback('Sincronizado con la base de datos.', 'success');
            }
        } catch (error) {
            console.error(error);

            if (!silent) {
                this.setSystemFeedback(extractErrorMessage(error), 'error');
            }
        }
    }

    async saveOperatorName() {
        const nextName = this.elements.operatorNameInput?.value.trim() ?? '';

        if (!nextName) {
            this.setIdentityStatus('Captura un nombre antes de continuar.', 'error');
            return;
        }

        this.state.operatorName = nextName;
        safeWriteStorage(this.nameStorageKey, nextName);
        this.elements.operatorNameInput.value = nextName;
        this.setIdentityStatus(`Cliente identificado como ${nextName}.`, 'success');

        if (this.role === 'vendedor') {
            await this.fetchOrders();
        }
    }

    appendItemRow(seed = {}) {
        if (!this.elements.itemTemplate || !this.elements.orderItems) {
            return;
        }

        const fragment = this.elements.itemTemplate.content.cloneNode(true);
        const row = fragment.querySelector('[data-item-row]');

        row.querySelector('[data-field="part_code"]').value = seed.part_code ?? '';
        row.querySelector('[data-field="object_name"]').value = seed.object_name ?? '';
        row.querySelector('[data-field="quantity"]').value = seed.quantity ?? 1;

        this.elements.orderItems.appendChild(fragment);
    }

    ensureOneItemRow() {
        if (!this.elements.orderItems || this.elements.orderItems.children.length > 0) {
            return;
        }

        this.appendItemRow();
    }

    removeItemRow(row) {
        if (!row || !this.elements.orderItems) {
            return;
        }

        row.remove();
        this.ensureOneItemRow();
    }

    async submitOrder(event) {
        event.preventDefault();

        if (!this.state.operatorName) {
            this.setFormFeedback('Primero guarda el nombre del vendedor que esta capturando el pedido.', 'error');
            return;
        }

        const items = this.collectItemsFromForm();

        if (!items.length) {
            this.setFormFeedback('Agrega al menos una pieza valida antes de enviar.', 'error');
            return;
        }

        this.setFormFeedback('Enviando pedido...', 'neutral');
        this.elements.submitOrderButton?.setAttribute('disabled', 'disabled');

        try {
            const response = await window.axios.post(this.urls.store, {
                requested_by_name: this.state.operatorName,
                items,
            });

            this.upsertOrder(response.data.data);
            this.resetOrderForm();
            this.render();
            this.setFormFeedback('Pedido enviado al almacen.', 'success');
            this.setSystemFeedback(
                response.data?.meta?.realtime_message ?? 'Pedido registrado y emitido por Reverb.',
                response.data?.meta?.broadcasted === false ? 'warning' : 'success',
            );
        } catch (error) {
            console.error(error);
            this.setFormFeedback(extractErrorMessage(error), 'error');
        } finally {
            this.elements.submitOrderButton?.removeAttribute('disabled');
        }
    }

    collectItemsFromForm() {
        const rows = Array.from(this.root.querySelectorAll('[data-item-row]'));
        const items = [];

        for (const row of rows) {
            const partCode = row.querySelector('[data-field="part_code"]').value.trim();
            const objectName = row.querySelector('[data-field="object_name"]').value.trim();
            const quantityValue = row.querySelector('[data-field="quantity"]').value.trim();
            const quantity = Number.parseInt(quantityValue, 10);

            const rowIsEmpty = !partCode && !objectName && !quantityValue;

            if (rowIsEmpty) {
                continue;
            }

            if (!partCode || !objectName || Number.isNaN(quantity) || quantity < 1) {
                this.setFormFeedback('Cada renglon debe incluir codigo, objeto y una cantidad mayor a cero.', 'error');
                return [];
            }

            items.push({
                part_code: partCode,
                object_name: objectName,
                quantity,
            });
        }

        return items;
    }

    resetOrderForm() {
        if (!this.elements.orderItems) {
            return;
        }

        this.elements.orderItems.innerHTML = '';
        this.appendItemRow();
    }

    async updateOrderStatus(orderId, status) {
        if (!orderId || !status) {
            return;
        }

        if (!this.state.operatorName) {
            this.setIdentityStatus('Guarda el nombre de quien atiende en almacen antes de responder.', 'error');
            return;
        }

        const actionLabels = {
            delivered: 'marcar como entregado',
            unavailable: 'marcar como sin existencia',
            insufficient_stock: 'marcar como existencia insuficiente',
        };

        const confirmed = window.confirm(`Confirma que quieres ${actionLabels[status]} este pedido.`);

        if (!confirmed) {
            return;
        }

        this.setSystemFeedback('Actualizando estatus del pedido...', 'neutral');

        try {
            const response = await window.axios.patch(this.buildStatusUrl(orderId), {
                handled_by_name: this.state.operatorName,
                status,
            });

            this.upsertOrder(response.data.data);
            this.render();
            this.setSystemFeedback(
                response.data?.meta?.realtime_message ?? 'Estatus actualizado y publicado en tiempo real.',
                response.data?.meta?.broadcasted === false ? 'warning' : 'success',
            );

            if (!this.pendingOrders().length) {
                this.clearAlarm();
            }
        } catch (error) {
            console.error(error);
            this.setSystemFeedback(extractErrorMessage(error), 'error');
        }
    }

    handleIncomingOrder(order, isNewOrder) {
        if (!this.shouldTrackOrder(order)) {
            return;
        }

        this.upsertOrder(order);
        this.render();

        if (this.role === 'almacen' && isNewOrder) {
            this.activateAlarm();
        }

        if (this.role === 'almacen' && !this.pendingOrders().length) {
            this.clearAlarm();
        }
    }

    shouldTrackOrder(order) {
        if (this.role !== 'vendedor') {
            return true;
        }

        if (!this.state.operatorName) {
            return false;
        }

        return order.requested_by_name === this.state.operatorName;
    }

    upsertOrder(order) {
        const index = this.state.orders.findIndex((currentOrder) => currentOrder.id === order.id);

        if (index === -1) {
            this.state.orders.unshift(order);
        } else {
            this.state.orders.splice(index, 1, order);
        }

        this.sortOrdersDescending();
    }

    sortOrdersDescending() {
        this.state.orders.sort((left, right) => {
            const leftTime = new Date(left.created_at).getTime();
            const rightTime = new Date(right.created_at).getTime();

            return rightTime - leftTime;
        });
    }

    render() {
        this.renderSummaryCards();
        this.renderRolePanels();
        this.renderSoundState();
    }

    renderSummaryCards() {
        if (!this.elements.summaryCards) {
            return;
        }

        const orders = this.state.orders;
        const totalQuantity = orders.reduce((sum, order) => sum + Number(order.total_quantity ?? 0), 0);
        const delivered = orders.filter((order) => order.status === 'delivered').length;
        const pending = orders.filter((order) => order.status === 'pending').length;
        const unavailable = orders.filter((order) => order.status === 'unavailable').length;
        const insufficient = orders.filter((order) => order.status === 'insufficient_stock').length;

        const cards = [
            { label: 'Pendientes', value: pending, tone: 'amber' },
            { label: 'Entregados', value: delivered, tone: 'emerald' },
            { label: 'Sin existencia', value: unavailable, tone: 'rose' },
            { label: 'Existencia insuficiente', value: insufficient, tone: 'orange' },
            { label: 'Piezas solicitadas', value: totalQuantity, tone: 'slate' },
        ];

        this.elements.summaryCards.innerHTML = cards
            .map(
                (card) => `
                    <article class="summary-card summary-card--${card.tone}">
                        <p>${escapeHtml(card.label)}</p>
                        <strong>${card.value}</strong>
                    </article>
                `,
            )
            .join('');
    }

    renderRolePanels() {
        if (this.role === 'vendedor') {
            this.renderSellerOrders();
            return;
        }

        if (this.role === 'almacen') {
            this.renderWarehouseQueue();
            this.renderWarehouseHistory();
            return;
        }

        this.renderMonitorTable();
    }

    renderSellerOrders() {
        if (!this.elements.sellerOrders) {
            return;
        }

        if (!this.state.operatorName) {
            this.elements.sellerOrders.innerHTML = this.emptyState(
                'Guarda el nombre del vendedor para ver sus pedidos recientes.',
            );
            return;
        }

        if (!this.state.orders.length) {
            this.elements.sellerOrders.innerHTML = this.emptyState(
                'Todavia no hay pedidos registrados para este vendedor.',
            );
            return;
        }

        this.elements.sellerOrders.innerHTML = this.state.orders
            .map((order) => this.renderOrderCard(order, { showRequester: false, showActions: false }))
            .join('');
    }

    renderWarehouseQueue() {
        if (!this.elements.warehouseQueue) {
            return;
        }

        const queue = [...this.pendingOrders()].sort((left, right) => {
            const leftTime = new Date(left.created_at).getTime();
            const rightTime = new Date(right.created_at).getTime();

            return leftTime - rightTime;
        });

        if (!queue.length) {
            this.elements.warehouseQueue.innerHTML = this.emptyState(
                'No hay pedidos pendientes en este momento.',
            );
            return;
        }

        this.elements.warehouseQueue.innerHTML = queue
            .map((order) => this.renderOrderCard(order, { showRequester: true, showActions: true }))
            .join('');
    }

    renderWarehouseHistory() {
        if (!this.elements.warehouseHistory) {
            return;
        }

        const history = this.state.orders.filter((order) => order.status !== 'pending');

        if (!history.length) {
            this.elements.warehouseHistory.innerHTML = this.emptyState(
                'Todavia no hay pedidos atendidos.',
            );
            return;
        }

        this.elements.warehouseHistory.innerHTML = history
            .slice(0, 15)
            .map((order) => this.renderOrderCard(order, { showRequester: true, showActions: false }))
            .join('');
    }

    renderMonitorTable() {
        if (!this.elements.monitorTable) {
            return;
        }

        if (!this.state.orders.length) {
            this.elements.monitorTable.innerHTML = this.emptyState(
                'Todavia no hay pedidos registrados en la base.',
            );
            return;
        }

        const rows = this.state.orders
            .map((order) => {
                const items = order.items
                    .map(
                        (item) => `
                            <div class="table-item">
                                <strong>${escapeHtml(item.part_code)}</strong>
                                <span>${escapeHtml(item.object_name)} x${item.quantity}</span>
                            </div>
                        `,
                    )
                    .join('');

                return `
                    <tr>
                        <td>${escapeHtml(order.folio)}</td>
                        <td><span class="status-badge status-badge--${order.status_tone}">${escapeHtml(order.status_label)}</span></td>
                        <td>${escapeHtml(order.requested_by_name)}</td>
                        <td>${escapeHtml(order.handled_by_name ?? 'Pendiente')}</td>
                        <td><div class="table-items">${items}</div></td>
                        <td>${this.formatDate(order.created_at)}</td>
                        <td>${this.formatDate(order.resolved_at)}</td>
                    </tr>
                `;
            })
            .join('');

        this.elements.monitorTable.innerHTML = `
            <div class="table-wrap">
                <table class="monitor-table">
                    <thead>
                        <tr>
                            <th>Folio</th>
                            <th>Estatus</th>
                            <th>Solicito</th>
                            <th>Atendio</th>
                            <th>Piezas</th>
                            <th>Creado</th>
                            <th>Resuelto</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    renderOrderCard(order, options) {
        const meta = [];

        if (options.showRequester) {
            meta.push(`<span>Solicito: ${escapeHtml(order.requested_by_name)}</span>`);
        }

        meta.push(`<span>Creado: ${this.formatDate(order.created_at)}</span>`);
        meta.push(`<span>Piezas: ${order.total_quantity}</span>`);

        if (order.handled_by_name) {
            meta.push(`<span>Atendio: ${escapeHtml(order.handled_by_name)}</span>`);
        }

        if (order.resolved_at) {
            meta.push(`<span>Resuelto: ${this.formatDate(order.resolved_at)}</span>`);
        }

        const actions = options.showActions
            ? `
                <div class="action-row">
                    <button class="button button--success" data-status-action data-order-id="${order.id}" data-status="delivered" type="button">
                        Entregado
                    </button>
                    <button class="button button--danger" data-status-action data-order-id="${order.id}" data-status="unavailable" type="button">
                        Sin existencia
                    </button>
                    <button class="button button--warning" data-status-action data-order-id="${order.id}" data-status="insufficient_stock" type="button">
                        Existencia insuficiente
                    </button>
                </div>
            `
            : '';

        const items = order.items
            .map(
                (item) => `
                    <li class="item-chip">
                        <strong>${escapeHtml(item.part_code)}</strong>
                        <span>${escapeHtml(item.object_name)}</span>
                        <em>x${item.quantity}</em>
                    </li>
                `,
            )
            .join('');

        return `
            <article class="order-card order-card--${order.status_tone}">
                <div class="order-card__header">
                    <div>
                        <p class="order-card__folio">${escapeHtml(order.folio)}</p>
                        <h3>${escapeHtml(order.status === 'pending' ? 'Pedido en espera' : 'Pedido atendido')}</h3>
                    </div>
                    <span class="status-badge status-badge--${order.status_tone}">${escapeHtml(order.status_label)}</span>
                </div>

                <div class="meta-row">${meta.join('')}</div>
                <ul class="item-list">${items}</ul>
                ${actions}
            </article>
        `;
    }

    toggleSound() {
        this.state.soundMuted = !this.state.soundMuted;
        safeWriteStorage(this.soundStorageKey, this.state.soundMuted ? '1' : '0');

        if (this.state.soundMuted) {
            this.clearAlarm();
        }

        this.renderSoundState();
    }

    activateAlarm() {
        this.state.alarmActive = true;

        if (this.state.soundMuted) {
            this.setAlarmStatus('Nuevo pedido recibido. El sonido esta silenciado.', 'warning');
            return;
        }

        if (!this.audioReady) {
            this.setAlarmStatus('Nuevo pedido recibido. Haz click en la pagina para habilitar el sonido.', 'warning');
            return;
        }

        this.startAlarmLoop();
        this.setAlarmStatus('Nuevo pedido entrante. Alarma activa.', 'success');
    }

    startAlarmLoop() {
        if (this.alarmTimer || !this.audioContext) {
            return;
        }

        this.playAlarmTone();
        this.alarmTimer = window.setInterval(() => this.playAlarmTone(), 1400);
    }

    playAlarmTone() {
        if (!this.audioContext) {
            return;
        }

        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(620, now + 0.22);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.36);
    }

    clearAlarm() {
        this.state.alarmActive = false;

        if (this.alarmTimer) {
            window.clearInterval(this.alarmTimer);
            this.alarmTimer = null;
        }

        this.renderSoundState();
    }

    startPollingFallback() {
        if (this.pollingTimer) {
            return;
        }

        this.pollingTimer = window.setInterval(() => {
            if (this.role === 'vendedor' && !this.state.operatorName) {
                return;
            }

            void this.fetchOrders({ silent: true });
        }, 4000);
    }

    stopPollingFallback() {
        if (!this.pollingTimer) {
            return;
        }

        window.clearInterval(this.pollingTimer);
        this.pollingTimer = null;
    }

    pendingOrders() {
        return this.state.orders.filter((order) => order.status === 'pending');
    }

    renderSoundState() {
        if (this.role !== 'almacen' || !this.elements.soundToggle) {
            return;
        }

        this.elements.soundToggle.textContent = this.state.soundMuted
            ? 'Activar sonido'
            : 'Silenciar sonido';

        if (this.state.soundMuted) {
            this.setAlarmStatus('El sonido esta silenciado para nuevos pedidos.', 'neutral');
            return;
        }

        if (!this.audioReady) {
            this.setAlarmStatus('El sonido se habilita al primer click o tecla dentro de la pagina.', 'neutral');
            return;
        }

        if (this.state.alarmActive) {
            this.setAlarmStatus('Alarma lista y escuchando nuevos pedidos.', 'success');
            return;
        }

        this.setAlarmStatus('Sonido activo. Esperando nuevos pedidos.', 'success');
    }

    buildStatusUrl(orderId) {
        return this.urls.statusTemplate.replace('__ORDER__', orderId);
    }

    formatDate(value) {
        if (!value) {
            return 'Pendiente';
        }

        return this.formatter.format(new Date(value));
    }

    setRealtimeStatus(text, tone) {
        if (!this.elements.realtimeIndicator) {
            return;
        }

        this.elements.realtimeIndicator.textContent = text;
        this.elements.realtimeIndicator.className = `realtime-pill realtime-pill--${tone}`;
    }

    setIdentityStatus(text, tone) {
        if (!this.elements.identityStatus) {
            return;
        }

        this.elements.identityStatus.textContent = text;
        this.elements.identityStatus.className = `feedback feedback--${tone}`;
    }

    setSystemFeedback(text, tone) {
        if (!this.elements.screenFeedback) {
            return;
        }

        this.elements.screenFeedback.textContent = text;
        this.elements.screenFeedback.className = `feedback feedback--${tone}`;
    }

    setFormFeedback(text, tone) {
        if (!this.elements.formFeedback) {
            return;
        }

        this.elements.formFeedback.textContent = text;
        this.elements.formFeedback.className = `feedback feedback--${tone}`;
    }

    setAlarmStatus(text, tone) {
        if (!this.elements.alarmStatus) {
            return;
        }

        this.elements.alarmStatus.textContent = text;
        this.elements.alarmStatus.className = `feedback feedback--${tone}`;
    }

    emptyState(message) {
        return `<div class="empty-state">${escapeHtml(message)}</div>`;
    }
}

function safeReadStorage(key) {
    if (!key) {
        return null;
    }

    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeWriteStorage(key, value) {
    if (!key) {
        return;
    }

    try {
        window.localStorage.setItem(key, value);
    } catch {
        // ignore storage failures
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function extractErrorMessage(error) {
    const errors = error?.response?.data?.errors;

    if (errors) {
        const firstMessage = Object.values(errors).flat()[0];

        if (firstMessage) {
            return firstMessage;
        }
    }

    return error?.response?.data?.message ?? 'No se pudo completar la operacion.';
}

const root = document.querySelector('[data-order-app]');

if (root) {
    const app = new OrderSystem(root);

    app.init().catch((error) => {
        console.error(error);
        app.setSystemFeedback('No se pudo inicializar la interfaz de pedidos.', 'error');
        app.setRealtimeStatus('Tiempo real con error', 'error');
    });
}
