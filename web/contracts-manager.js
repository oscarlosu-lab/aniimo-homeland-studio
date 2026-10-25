/**
 * contracts-manager.js
 * Módulo de Gestión y Optimización de Pedidos Diarios de la Tierra Natal (Home Orders)
 * Basado en la base de datos oficial de los 327 pedidos y los 8 clientes de Astra.
 */

import { translate } from './i18n.js';
import {
    ORDER_CLIENTS,
    HOME_ORDERS_LIB,
    RV_BOARD_CAPACITY,
    QUALITY_TIERS
} from './home-orders-data.js';

const STORAGE_KEY = 'homeland_studio_active_orders_v2';
const SELECTED_CLIENT_KEY = 'homeland_studio_selected_client';

/**
 * Obtiene el nivel actual de la Casa Rodante seleccionado en Homeland Studio.
 */
export function getCurrentHomeLevel() {
    const el = document.getElementById('home-level');
    if (el && el.value) {
        return parseInt(el.value, 10) || 1;
    }
    return 4; // RV 4 por defecto
}

/**
 * Obtiene la capacidad máxima del tablón para el nivel de RV actual.
 */
export function getMaxBoardCapacity(rvLevel = getCurrentHomeLevel()) {
    const lvl = Math.min(20, Math.max(1, rvLevel));
    return RV_BOARD_CAPACITY[lvl] || 7;
}

/**
 * Carga los pedidos activos del jugador desde LocalStorage.
 */
export function getActiveContracts() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('Error al cargar pedidos activos de localStorage:', e);
    }

    return [];
}

/**
 * Guarda los pedidos activos en LocalStorage.
 */
export function saveActiveContracts(orders) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
        console.warn('Error al guardar pedidos activos:', e);
    }
}

/**
 * Formato de duración en horas y minutos.
 */
function formatHoursMins(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
    const totalMinutes = Math.ceil(seconds / 60);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

let currentRecipeIndex = [];

/**
 * Recibe el catálogo dinámico de recetas oficiales del motor WASM.
 */
export function setContractsRecipeIndex(index) {
    if (Array.isArray(index)) {
        currentRecipeIndex = index;
    }
}

/**
 * Consulta dinámicamente en el motor en qué taller se fabrica cualquier ítem del juego.
 */
export function getFacilityForRecipe(itemKey) {
    if (!itemKey) return translate('Taller correspondiente');
    const r = currentRecipeIndex.find(rec => rec.name === itemKey);
    return r && r.facility ? translate(r.facility) : translate('Taller correspondiente');
}

/**
 * Calcula el análisis de cumplimiento de pedidos a partir de un plan de producción.
 */
export function calculateContractsAnalysis(plan, activeOrders = getActiveContracts()) {
    if (!activeOrders || activeOrders.length === 0) {
        return {
            contracts: [],
            totalCoins: 0,
            totalSeasonStamps: 0,
            maxCompletionHours: 0,
            maxCompletionSeconds: 0,
            maxCompletionEtaFormatted: '0m',
            allDone: true,
            contractItems: new Set(),
            contractFacilities: new Set()
        };
    }

    function norm(k) {
        return (k || '').toString().toLowerCase().replace(/[\s_\-]+/g, '');
    }

    // Mapear tasas de producción del plan (unidades/segundo)
    const productionRates = new Map();
    const itemFacilities = new Map();
    const reqSecondsMap = new Map();

    function addRate(name, rate, fac) {
        if (!name) return;
        const nKey = norm(name);
        const curr = productionRates.get(nKey) || 0;
        if (rate > curr) {
            productionRates.set(nKey, rate);
        }
        if (fac && !itemFacilities.has(nKey)) {
            itemFacilities.set(nKey, fac);
        }
    }

    // 0. Si el plan incluye cálculo de subida de nivel / requerimientos exactos de pedidos
    if (plan && plan.level_up && Array.isArray(plan.level_up.requirements)) {
        plan.level_up.requirements.forEach(req => {
            if (req.name) {
                const nKey = norm(req.name);
                if (req.per_second > 0) {
                    addRate(req.name, req.per_second);
                }
                if (req.seconds !== null && req.seconds !== undefined) {
                    reqSecondsMap.set(nKey, req.seconds);
                }
            }
        });
    }

    // 1. Productos finales vendidos
    if (plan && plan.income_streams) {
        plan.income_streams.forEach(stream => {
            addRate(stream.item_name, stream.units_per_second || 0, stream.facility);
        });
    }

    // 2. Pasos de producción en instalaciones (incluye productos intermedios y materias primas)
    if (plan && plan.coin_items) {
        plan.coin_items.forEach(step => {
            if (step.item_name && step.cycle_time && step.cycle_time > 0 && step.facility_count > 0) {
                const units = step.busy_units !== null && step.busy_units !== undefined ? step.busy_units : step.facility_count;
                const rate = units / step.cycle_time;
                addRate(step.item_name, rate, step.facility);
            }
        });
    }

    let totalCoins = 0;
    let totalSeasonStamps = 0;
    let maxCompletionSeconds = 0;
    const allContractItems = new Set();
    const allContractFacilities = new Set();

    const evaluatedOrders = activeOrders.map(order => {
        const mult = order.multiplier || 1.0;
        const rewardCoinsEffective = Math.round((order.coins || 0) * mult);
        const rewardSeasonStamps = order.stamps || 0;

        totalCoins += rewardCoinsEffective;
        totalSeasonStamps += rewardSeasonStamps;

        const itemKey = order.itemKey || '';
        allContractItems.add(itemKey);

        const nKey1 = norm(order.itemKey);
        const nKey2 = norm(order.nameEn);
        const nKey3 = norm(order.name);

        const facility = itemFacilities.get(nKey1) ||
                         itemFacilities.get(nKey2) ||
                         itemFacilities.get(nKey3) ||
                         getFacilityForRecipe(order.itemKey) ||
                         (order.facility ? order.facility : translate('Taller especializado'));
        allContractFacilities.add(facility);

        const required = order.amount || 0;
        const stock = order.stock || 0;
        const pending = Math.max(0, required - stock);

        // Buscar tasa por itemKey, nameEn o name normalizados
        let unitsPerSec = productionRates.get(nKey1) ||
                          productionRates.get(nKey2) ||
                          productionRates.get(nKey3) || 0;
        const unitsPerHour = unitsPerSec * 3600;

        let secondsNeeded = 0;
        let status = 'done'; // done, in_progress, no_production

        const solverSec = reqSecondsMap.has(nKey1) ? reqSecondsMap.get(nKey1) :
                          reqSecondsMap.has(nKey2) ? reqSecondsMap.get(nKey2) :
                          reqSecondsMap.has(nKey3) ? reqSecondsMap.get(nKey3) : null;

        if (pending <= 0) {
            status = 'done';
            secondsNeeded = 0;
        } else if (solverSec !== null && solverSec !== undefined) {
            secondsNeeded = solverSec;
            status = secondsNeeded === 0 ? 'done' : 'in_progress';
        } else if (unitsPerSec > 0) {
            status = 'in_progress';
            secondsNeeded = pending / unitsPerSec;
        } else {
            // Si el taller está ocupado en la fase actual por otro pedido prioritario, calcular tiempo secuencial estimado
            const rec = currentRecipeIndex.find(r => r.name === order.itemKey);
            const cycleSec = rec && rec.production_time ? rec.production_time : 300;
            const runSec = (pending / (rec?.yieldAmount || 1)) * cycleSec;
            secondsNeeded = (Number.isFinite(maxCompletionSeconds) ? maxCompletionSeconds : 0) + runSec;
            status = 'queued';
        }

        if (secondsNeeded > maxCompletionSeconds && Number.isFinite(secondsNeeded)) {
            maxCompletionSeconds = secondsNeeded;
        }

        const isDone = status === 'done';
        const etaText = isDone ? '✅ Listo para entregar' :
                        status === 'in_progress' ? formatHoursMins(secondsNeeded) :
                        status === 'queued' ? `⏳ En cola (${formatHoursMins(secondsNeeded)})` :
                        '⚠️ Sin producción activa';

        return {
            ...order,
            rewardCoinsEffective,
            rewardSeasonStamps,
            facility,
            required,
            stock,
            pending,
            unitsPerHour,
            status,
            secondsNeeded,
            contractAllDone: isDone,
            etaFormatted: etaText
        };
    });

    return {
        contracts: evaluatedOrders,
        totalCoins,
        totalSeasonStamps,
        maxCompletionHours: maxCompletionSeconds / 3600,
        maxCompletionSeconds,
        maxCompletionEtaFormatted: formatHoursMins(maxCompletionSeconds),
        allDone: evaluatedOrders.every(o => o.contractAllDone),
        contractItems: allContractItems,
        contractFacilities: allContractFacilities
    };
}

/**
 * Renderiza el panel de gestión de pedidos en la barra de configuración.
 */
export function renderContractsConfigUI(container, onContractsChanged, onOptimizeForContracts) {
    if (!container) return;

    let selectedClientId = localStorage.getItem(SELECTED_CLIENT_KEY) || '1';
    let searchQuery = '';
    let filterByRv = true;
    let selectedMultiplier = 2.0; // Urgente por defecto

    function update() {
        const activeOrders = getActiveContracts();
        const currentRv = getCurrentHomeLevel();
        const maxCapacity = getMaxBoardCapacity(currentRv);
        const isFull = activeOrders.length >= maxCapacity;

        // Si el cliente seleccionado requiere un nivel de RV superior al actual, auto-seleccionar el primer cliente disponible
        if (filterByRv) {
            const currentSelectedMeta = ORDER_CLIENTS.find(c => c.id === selectedClientId);
            if (currentSelectedMeta && (currentSelectedMeta.minRv || 1) > currentRv) {
                const firstAvailable = ORDER_CLIENTS.find(c => (c.minRv || 1) <= currentRv);
                if (firstAvailable) {
                    selectedClientId = firstAvailable.id;
                }
            }
        }

        // Filtrar pedidos del cliente seleccionado (admite pedidos de temporada cruzados)
        let clientOrders = HOME_ORDERS_LIB.filter(o => {
            if (selectedClientId === 'season') {
                return o.isSeason === true;
            }
            if (o.clientId === selectedClientId) return true;
            if (o.clientIds && o.clientIds.includes(selectedClientId)) return true;
            return false;
        });

        if (filterByRv) {
            clientOrders = clientOrders.filter(o => o.minRv <= currentRv && (!o.maxRv || o.maxRv >= currentRv));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            clientOrders = clientOrders.filter(o =>
                o.name.toLowerCase().includes(q) ||
                (o.nameEn && o.nameEn.toLowerCase().includes(q))
            );
        }

        const selectedClient = ORDER_CLIENTS.find(c => c.id === selectedClientId) || ORDER_CLIENTS[0];

        container.innerHTML = `
            <div class="contracts-header">
                <div class="contracts-title-wrap">
                    <span class="contracts-icon">📜</span>
                    <div>
                        <h4 class="contracts-title">Pedidos del Hogar (Robot de Pedidos)</h4>
                        <span class="contracts-capacity-badge ${isFull ? 'full' : ''}">
                            Tablón: <b>${activeOrders.length} / ${maxCapacity}</b> pedidos (RV ${currentRv})
                        </span>
                    </div>
                </div>
            </div>

            <!-- Fila de Pills de Clientes y Temporada -->
            <div class="client-pills-bar">
                <span class="pills-label">Clientes de Astra & Evento:</span>
                <div class="client-pills-wrapper">
                    ${ORDER_CLIENTS.map(c => {
                        const isLocked = filterByRv && (c.minRv || 1) > currentRv;
                        const isSeasonPill = c.id === 'season' || c.isSeason;
                        return `
                        <button type="button" class="client-pill ${c.id === selectedClientId ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isSeasonPill ? 'season-pill' : ''}" data-client-id="${c.id}" ${isLocked ? 'disabled' : ''} title="${c.category}: ${c.description}${isLocked ? ` · Requiere Casa Rodante RV ${c.minRv}` : ''}">
                            <span class="client-pill-emoji">${c.emoji}</span>
                            <span class="client-pill-name">${c.name}</span>
                            ${isLocked ? `<span class="client-pill-lock">🔒RV${c.minRv}</span>` : ''}
                        </button>
                    `;}).join('')}
                </div>
            </div>

            <!-- Selector Contextual del Pedido -->
            <div class="order-selector-box ${selectedClient.isSeason ? 'season-box' : ''}">
                <div class="order-selector-header">
                    <span class="selected-client-info">
                        ${selectedClient.emoji} <strong>${selectedClient.name}</strong> · <small>${selectedClient.category}</small>
                    </span>
                    <label class="filter-rv-toggle" title="Ocultar pedidos que requieren un nivel de casa rodante mayor al tuyo">
                        <input type="checkbox" id="toggle-filter-rv" ${filterByRv ? 'checked' : ''}> Solo mi RV
                    </label>
                </div>

                <!-- Buscador Rápido de Producto -->
                <div class="order-search-row">
                    <input type="text" id="order-search-input" class="order-search-input" placeholder="🔍 Buscar producto o receta (ej. Bandeja, Olla, Harina, Lavanda...)" value="${searchQuery}">
                </div>

                <div class="order-picker-row">
                    <select id="order-picker-select" class="order-picker-select" ${clientOrders.length === 0 ? 'disabled' : ''}>
                        ${clientOrders.length === 0
                            ? '<option value="">No hay pedidos disponibles con este filtro</option>'
                            : clientOrders.map(o => {
                                const qMeta = QUALITY_TIERS[o.quality] || QUALITY_TIERS[1];
                                const starsStr = '★'.repeat(o.stars);
                                const seasonPrefix = o.isSeason ? '🌸 [Temporada] ' : '';
                                const seasonPointsText = o.isSeason && o.stamps ? ` · 🌸 +${o.stamps} Pts Cosecha` : '';
                                return `<option value="${o.id}">
                                    ${seasonPrefix}[${qMeta.name} ${starsStr}] ${o.amount}x ${o.name} (🪙 ${o.coins.toLocaleString()} monedas${seasonPointsText})
                                </option>`;
                            }).join('')
                        }
                    </select>
                </div>

                <!-- Selector de Multiplicador Oficial -->
                <div class="order-mult-row">
                    <span class="mult-label">Multiplicador:</span>
                    <div class="mult-pills">
                        <button type="button" class="mult-pill ${selectedMultiplier === 1.0 ? 'active' : ''}" data-mult="1.0">Normal (x1.0)</button>
                        <button type="button" class="mult-pill urgent ${selectedMultiplier === 2.0 ? 'active' : ''}" data-mult="2.0">🔥 Urgente (x2.0)</button>
                        <button type="button" class="mult-pill super ${selectedMultiplier === 5.0 ? 'active' : ''}" data-mult="5.0">⚡ Súper (x5.0)</button>
                    </div>
                </div>

                <button type="button" id="btn-add-selected-order" class="btn-add-order ${isFull ? 'disabled' : ''}" ${isFull || clientOrders.length === 0 ? 'disabled' : ''}>
                    ${isFull ? '⚠️ Tablón Lleno para tu Nivel de RV' : '➕ Añadir Pedido al Tablón'}
                </button>
            </div>

            <!-- Tablón de Pedidos Activos del Jugador -->
            <div class="active-orders-section">
                <div class="active-orders-header">
                    <h5>📋 Pedidos en tu Tablón Activo (${activeOrders.length}/${maxCapacity}):</h5>
                </div>
                <div class="active-orders-list">
                    ${activeOrders.length === 0
                        ? `<p class="hint small empty-hint">Tu tablón está vacío. Selecciona un cliente arriba y añade un pedido.</p>`
                        : activeOrders.map((o, idx) => {
                            const qMeta = QUALITY_TIERS[o.quality] || QUALITY_TIERS[1];
                            const cMeta = o.clientMeta || ORDER_CLIENTS.find(c => c.id === o.clientId) || ORDER_CLIENTS[0];
                            const isUrgent = (o.multiplier || 1.0) > 1.0;
                            const totalCoins = Math.round((o.coins || 0) * (o.multiplier || 1.0));
                            const isSeason = o.isSeason || o.type === 'season';
                            return `
                                <div class="active-order-card ${isSeason ? 'season' : ''} ${isUrgent ? 'urgent' : ''}">
                                    <div class="order-card-header">
                                        <span class="order-client-tag">${cMeta.emoji} ${cMeta.name}</span>
                                        ${isSeason ? `<span class="order-season-badge">🌸 Pedido de temporada</span>` : ''}
                                        <span class="order-tier-tag" style="background:${qMeta.bg}; color:${qMeta.color}; border:1px solid ${qMeta.border}">
                                            ${qMeta.name} ${'★'.repeat(o.stars || 2)}
                                        </span>
                                        <span class="order-mult-badge ${o.multiplier === 5.0 ? 'super' : o.multiplier === 2.0 ? 'urgent' : 'normal'}">
                                            ${o.multiplier === 5.0 ? '⚡ x5.0' : o.multiplier === 2.0 ? '🔥 x2.0' : 'x1.0'}
                                        </span>
                                        <button type="button" class="btn-remove-active-order" data-index="${idx}" title="Eliminar pedido">✕</button>
                                    </div>
                                    <div class="order-card-body">
                                        <div class="order-req-line">
                                            <strong>${o.amount}x ${o.name}</strong>
                                            <span class="order-reward-pill">🪙 +${totalCoins.toLocaleString()}</span>
                                            ${o.stamps > 0 ? `<span class="order-stamps-pill ${isSeason ? 'season-pts' : ''}">🌸 +${o.stamps} ${isSeason ? 'Pts Cosecha' : 'Sellos'}</span>` : ''}
                                        </div>
                                        <div class="order-stock-line">
                                            <label>Tengo en almacén:</label>
                                            <input type="number" class="order-stock-input" data-index="${idx}" min="0" max="${o.amount}" value="${o.stock || 0}">
                                            <small class="hint">Faltan: ${Math.max(0, o.amount - (o.stock || 0))}</small>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>

            <!-- Botón de Optimización Central -->
            <div class="contracts-actions-bar">
                <button type="button" id="btn-optimize-contracts" class="optimize-btn contracts-btn">
                    <span class="btn-text">🎯 Optimizar Plan para estos Pedidos</span>
                </button>
            </div>
        `;

        // Listeners de Pills de Clientes
        container.querySelectorAll('.client-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cid = btn.dataset.clientId;
                selectedClientId = cid;
                localStorage.setItem(SELECTED_CLIENT_KEY, cid);
                update();
            });
        });

        // Listener Filtro RV
        const rvCheck = container.querySelector('#toggle-filter-rv');
        if (rvCheck) {
            rvCheck.addEventListener('change', (e) => {
                filterByRv = e.target.checked;
                update();
            });
        }

        // Listener Buscador
        const searchInput = container.querySelector('#order-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                // debounce actualización de lista de opciones
                const select = container.querySelector('#order-picker-select');
                if (select) {
                    let filtered = HOME_ORDERS_LIB.filter(o => {
                        if (selectedClientId === 'season') {
                            return o.isSeason === true;
                        }
                        if (o.clientId === selectedClientId) return true;
                        if (o.clientIds && o.clientIds.includes(selectedClientId)) return true;
                        return false;
                    });
                    if (filterByRv) {
                        filtered = filtered.filter(o => o.minRv <= currentRv && (!o.maxRv || o.maxRv >= currentRv));
                    }
                    if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        filtered = filtered.filter(o =>
                            o.name.toLowerCase().includes(q) ||
                            (o.nameEn && o.nameEn.toLowerCase().includes(q))
                        );
                    }
                    select.innerHTML = filtered.length === 0
                        ? '<option value="">No hay pedidos coincidentes</option>'
                        : filtered.map(o => {
                            const qMeta = QUALITY_TIERS[o.quality] || QUALITY_TIERS[1];
                            const starsStr = '★'.repeat(o.stars);
                            const seasonPrefix = o.isSeason ? '🌸 [Temporada] ' : '';
                            const seasonPointsText = o.isSeason && o.stamps ? ` · 🌸 +${o.stamps} Pts Cosecha` : '';
                            return `<option value="${o.id}">
                                ${seasonPrefix}[${qMeta.name} ${starsStr}] ${o.amount}x ${o.name} (🪙 ${o.coins.toLocaleString()} monedas${seasonPointsText})
                            </option>`;
                        }).join('');
                }
            });
        }

        // Listeners Multiplicador
        container.querySelectorAll('.mult-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedMultiplier = parseFloat(btn.dataset.mult) || 1.0;
                container.querySelectorAll('.mult-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Listener Añadir Pedido
        const btnAdd = container.querySelector('#btn-add-selected-order');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const select = container.querySelector('#order-picker-select');
                const orderId = select ? select.value : null;
                if (!orderId) return;

                const currentOrders = getActiveContracts();
                if (currentOrders.length >= maxCapacity) {
                    alert(`El tablón de tu Casa Rodante (Nivel ${currentRv}) solo puede tener un máximo de ${maxCapacity} pedidos.`);
                    return;
                }

                const libOrder = HOME_ORDERS_LIB.find(o => o.id === orderId);
                if (!libOrder) return;

                const newOrder = {
                    ...libOrder,
                    items: [{ item: libOrder.itemKey, amount: libOrder.amount, name: libOrder.name }],
                    type: libOrder.isSeason ? 'season' : 'daily',
                    multiplier: selectedMultiplier,
                    badge: selectedMultiplier === 5.0 ? '⚡ Súper Urgente x5.0' : selectedMultiplier === 2.0 ? '🔥 Urgente x2.0' : 'Normal x1.0',
                    stock: 0,
                    clientMeta: ORDER_CLIENTS.find(c => c.id === libOrder.clientId)
                };

                currentOrders.push(newOrder);
                saveActiveContracts(currentOrders);
                update();
                if (onContractsChanged) onContractsChanged(currentOrders);
            });
        }

        // Listeners Eliminar Pedido
        container.querySelectorAll('.btn-remove-active-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index, 10);
                const currentOrders = getActiveContracts();
                currentOrders.splice(idx, 1);
                saveActiveContracts(currentOrders);
                update();
                if (onContractsChanged) onContractsChanged(currentOrders);
            });
        });

        // Listeners Actualizar Stock
        container.querySelectorAll('.order-stock-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(input.dataset.index, 10);
                const val = Math.max(0, parseInt(input.value, 10) || 0);
                const currentOrders = getActiveContracts();
                if (currentOrders[idx]) {
                    currentOrders[idx].stock = val;
                    saveActiveContracts(currentOrders);
                    if (onContractsChanged) onContractsChanged(currentOrders);
                }
            });
        });

        // Listener Optimizar Plan
        const btnOptimize = container.querySelector('#btn-optimize-contracts');
        if (btnOptimize) {
            btnOptimize.addEventListener('click', () => {
                if (onOptimizeForContracts) onOptimizeForContracts(activeOrders);
            });
        }
    }

    update();
}

/**
 * Renderiza la tarjeta de Resultados y Auditoría de Pedidos en la columna derecha del plan.
 */
export function renderContractsResultCard(resultContainer, plan, activeOrders = getActiveContracts()) {
    if (!resultContainer) return;
    if (!activeOrders || activeOrders.length === 0) {
        resultContainer.style.display = 'none';
        return;
    }

    const analysis = calculateContractsAnalysis(plan, activeOrders);
    resultContainer.style.display = 'block';

    resultContainer.innerHTML = `
        <div class="card-head">
            <h3>📋 Plan de Cumplimiento: 2 Fases Coordinadas</h3>
            <span class="badge ${analysis.allDone ? 'badge-success' : 'badge-warning'}">
                ${analysis.allDone ? '✅ Fase 1 Lista para Entrega' : `⏳ Fase 1 en Curso · ETA: ${analysis.maxCompletionEtaFormatted}`}
            </span>
        </div>

        <div class="plan-phases-roadmap">
            <div class="phase-step active">
                <div class="phase-step-badge">FASE 1 · PEDIDOS ACTIVOS</div>
                <div class="phase-step-title">Fabricación y Entrega del Tablón</div>
                <div class="phase-step-desc">
                    Producción prioritaria obligatoria de los <b>${analysis.contracts.length} pedidos</b>. 
                    Cobro inmediato de <b class="text-gold">🪙 +${analysis.totalCoins.toLocaleString()} monedas</b>${analysis.totalSeasonStamps > 0 ? ` y <b class="text-season">🌸 +${analysis.totalSeasonStamps.toLocaleString()} sellos</b>` : ''}.
                </div>
                <div class="phase-step-meta">
                    <span>⏱️ ETA Fase 1: <b>${analysis.maxCompletionEtaFormatted}</b></span>
                    <span>📦 Entregas listas: <b>${analysis.contracts.filter(c => c.contractAllDone).length}/${analysis.contracts.length}</b></span>
                </div>
            </div>
            <div class="phase-step-arrow">➔</div>
            <div class="phase-step next">
                <div class="phase-step-badge">FASE 2 · CONTINUA</div>
                <div class="phase-step-title">Subida de Nivel y Dinero Pasivo</div>
                <div class="phase-step-desc">
                    Al entregar los pedidos en <b>${analysis.maxCompletionEtaFormatted}</b>, las máquinas se liberan para cubrir la subida de Casa Rodante y maximizar la ganancia constante de Monedas del Hogar.
                </div>
                <div class="phase-step-meta">
                    <span>💰 Inyección de fondos: <b>+${analysis.totalCoins.toLocaleString()} monedas ganadas</b></span>
                </div>
            </div>
        </div>

        <div class="contracts-kpi-summary">
            <div class="contract-kpi-pill">
                <span class="kpi-label">Recompensa en Monedas</span>
                <span class="kpi-val text-gold">🪙 +${analysis.totalCoins.toLocaleString()}</span>
            </div>
            ${analysis.totalSeasonStamps > 0 ? `
            <div class="contract-kpi-pill">
                <span class="kpi-label">Puntos / Sellos Temporada</span>
                <span class="kpi-val text-season">🌸 +${analysis.totalSeasonStamps.toLocaleString()}</span>
            </div>` : ''}
            <div class="contract-kpi-pill">
                <span class="kpi-label">Pedidos en Tablón</span>
                <span class="kpi-val">${analysis.contracts.length} activos</span>
            </div>
            <div class="contract-kpi-pill">
                <span class="kpi-label">Tiempo de Entrega</span>
                <span class="kpi-val text-amber">${analysis.maxCompletionEtaFormatted}</span>
            </div>
        </div>

        <div class="contract-cards-breakdown">
            ${analysis.contracts.map(o => {
                const qMeta = QUALITY_TIERS[o.quality] || QUALITY_TIERS[1];
                const cMeta = o.clientMeta || ORDER_CLIENTS.find(c => c.id === o.clientId) || ORDER_CLIENTS[0];
                const pct = o.required > 0 ? Math.min(100, Math.round((o.stock / o.required) * 100)) : 100;
                const isUrgent = (o.multiplier || 1.0) > 1.0;
                const isSeason = o.isSeason || o.type === 'season';

                return `
                    <div class="contract-eval-card ${o.contractAllDone ? 'done' : ''} ${isSeason ? 'season' : ''}">
                        <div class="c-eval-header">
                            <span class="order-client-tag">${cMeta.emoji} ${cMeta.name}</span>
                            ${isSeason ? `<span class="order-season-badge">🌸 Pedido de temporada</span>` : ''}
                            <span class="order-tier-tag" style="background:${qMeta.bg}; color:${qMeta.color}; border:1px solid ${qMeta.border}">
                                ${qMeta.name} ${'★'.repeat(o.stars || 2)}
                            </span>
                            <span class="order-mult-badge ${o.multiplier === 5.0 ? 'super' : o.multiplier === 2.0 ? 'urgent' : 'normal'}">
                                ${o.multiplier === 5.0 ? '⚡ Súper x5.0' : o.multiplier === 2.0 ? '🔥 Urgente x2.0' : 'Normal x1.0'}
                            </span>
                            <strong style="margin-left: 0.25rem;">${o.amount}x ${o.name}</strong>
                            <span class="c-eval-eta ${o.contractAllDone ? 'text-green' : 'text-amber'}">${o.etaFormatted}</span>
                        </div>
                        <div class="c-eval-rewards">
                            <span>🪙 Recompensa: <b>+${o.rewardCoinsEffective.toLocaleString()} monedas</b></span>
                            ${o.rewardSeasonStamps > 0 ? `<span>🌸 <b>+${o.rewardSeasonStamps} ${isSeason ? 'Puntos Cosecha' : 'Sellos'}</b></span>` : ''}
                            <span style="margin-left: auto;">🏭 Fabricado en: <b>${o.facility}</b></span>
                        </div>
                        <div class="c-progress-bar-bg" style="margin-top: 0.35rem;">
                            <div class="c-progress-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                        <div class="c-eval-stats">
                            <span>Inventario: ${o.stock} / ${o.required} (Faltan: ${o.pending})</span>
                            <span>Producción activa: ${o.unitsPerHour > 0 ? `+${o.unitsPerHour.toFixed(1)}/h` : '0/h'}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
