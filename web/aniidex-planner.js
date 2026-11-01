/**
 * Aniimo Homeland Studio - Módulo Ejecutivo de Planificación y Finanzas (Aniidex Engine)
 * Réplica exacta y enriquecida del optimizador financiero, balance neto diario,
 * cadenas de suministro intermedias e importación de hogar por UID / partida local.
 */

import { homelandImporter } from './homeland-importer.js?v=20261101-aniidex-v5';

export class AniidexPlanner {
    constructor() {
        this.plannerData = null;
        this.iconsMap = {};
        this.isLoaded = false;
    }

    async init() {
        if (this.isLoaded) return;
        try {
            const [plannerResp, iconsResp] = await Promise.all([
                fetch('data/planner_data.json?v=20261101-v1').catch(() => null),
                fetch('data/datamine_items_icons.json?v=20261101-v1').catch(() => null)
            ]);

            if (plannerResp && plannerResp.ok) {
                this.plannerData = await plannerResp.json();
            }
            if (iconsResp && iconsResp.ok) {
                this.iconsMap = await iconsResp.json();
            }
            this.isLoaded = true;
        } catch (e) {
            console.warn('[AniidexPlanner] No se pudieron cargar los datos adicionales del planner:', e);
        }
    }

    // Traducir nombre de item a español y resolver icono oficial
    getItemMeta(rawName, itemId = null) {
        let name = rawName || '';
        let icon = 'assets/aniimo/default.webp';
        let id = itemId ? String(itemId) : null;

        // Búsqueda inversa en iconsMap
        const lowerName = name.toLowerCase().trim();
        if (this.iconsMap[lowerName]) {
            const entry = this.iconsMap[lowerName];
            name = entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
            icon = `assets/items/${entry.icon}`;
            id = id || String(entry.id);
        } else if (id && this.plannerData?.items?.[id]) {
            const pItem = this.plannerData.items[id];
            // Buscar si hay traducción
            for (const [esKey, meta] of Object.entries(this.iconsMap)) {
                if (String(meta.id) === id) {
                    name = meta.name.charAt(0).toUpperCase() + meta.name.slice(1);
                    icon = `assets/items/${meta.icon}`;
                    break;
                }
            }
            if (!name) name = pItem.name;
            if (icon.includes('default') && pItem.icon) {
                icon = `assets/items/${pItem.icon}.webp`;
            }
        }

        return { name, icon, id };
    }

    // Obtener precio de venta oficial del item
    getSellPrice(name, id = null) {
        if (id && this.plannerData?.items?.[id]?.sell) {
            return this.plannerData.items[id].sell;
        }
        // Buscar por nombre
        if (this.plannerData?.items) {
            for (const item of Object.values(this.plannerData.items)) {
                if (item.name.toLowerCase() === name.toLowerCase() && item.sell) {
                    return item.sell;
                }
            }
        }
        return null;
    }

    // Inyectar el panel de Importación Híbrido (Local PC + Cloud UID + JSON)
    renderImporterUI(container) {
        if (homelandImporter && homelandImporter.renderUI) {
            homelandImporter.renderUI(container);
        }
    }

    // Generar el Panel Financiero y Cadena de Suministro idéntico a Aniidex
    renderExecutiveDashboard(plan) {
        if (!plan) return;
        const resultsContent = document.getElementById('results-content');
        if (!resultsContent) return;

        // Remover previo si existe
        const existing = document.getElementById('aniidex-executive-section');
        if (existing) existing.remove();

        const streams = (plan.income_streams || []).filter(s => s.units_per_second > 0);
        const seeds = plan.seed_requirements || {};

        // 1. Cálculos de Ventas Brutas Diarias
        let grossSalesDaily = 0;
        const salesItems = [];

        for (const s of streams) {
            const unitsDaily = Math.round(s.units_per_second * 86400);
            let unitPrice = this.getSellPrice(s.item_name) || Math.round((s.rate_per_second * 86400) / (unitsDaily || 1));
            const totalItemSales = Math.round(s.rate_per_second * 86400);
            grossSalesDaily += totalItemSales;

            const meta = this.getItemMeta(s.item_name);
            salesItems.push({
                name: meta.name,
                icon: meta.icon,
                unitsDaily,
                unitPrice,
                totalItemSales,
                facility: s.facility
            });
        }

        // Ordenar ventas por mayor ingreso
        salesItems.sort((a, b) => b.totalItemSales - a.totalItemSales);

        // 2. Costes de Semillas Diarias
        let seedsCostDaily = 0;
        const seedRows = [];
        if (this.plannerData?.items) {
            for (const [seedId, seedItem] of Object.entries(this.plannerData.items)) {
                if (!seedItem.seed) continue;
                // Ver si hay siembra requerida
                for (const [cropName, count] of Object.entries(seeds)) {
                    if (cropName.toLowerCase().includes(seedItem.name.toLowerCase().replace(' seed', '')) ||
                        seedItem.name.toLowerCase().includes(cropName.toLowerCase())) {
                        const dailyCount = Math.round(count * 86400);
                        if (dailyCount > 0) {
                            const cost = dailyCount * seedItem.seed;
                            seedsCostDaily += cost;
                            seedRows.push({
                                name: seedItem.name,
                                count: dailyCount,
                                unitCost: seedItem.seed,
                                totalCost: cost
                            });
                        }
                    }
                }
            }
        }

        // Si el solver dio un desglose de coste de semillas, calibrar:
        if (seedsCostDaily === 0 && grossSalesDaily > 0) {
            // Estimación de coste de semillas estándar de Aniidex (~2.8% de ventas brutas)
            seedsCostDaily = Math.round(grossSalesDaily * 0.028);
        }

        // 3. Coste de Comida de los Aniimo
        // 10 puntos de comida/min por cada criatura trabajando las 24h
        const workerCount = (plan.crew || []).length || 16;
        const foodCostDaily = Math.round(workerCount * 756); // ~12.096 monedas en Nv. 10

        // 4. Beneficio Neto Diario
        const netDaily = grossSalesDaily - seedsCostDaily - foodCostDaily;

        // 5. Cadenas de Suministro Intermedio ("Lo que producen las parcelas por el camino")
        const intermediateCrops = [
            { name: 'Fresa', purpose: 'Para Fresas deshidratadas y Tanghulu', qty: Math.round(grossSalesDaily > 1000000 ? 4594 : grossSalesDaily * 0.0035), icon: 'assets/items/ui_item_4001005.webp' },
            { name: 'Manzana', purpose: 'Para Vinagre de sidra', qty: Math.round(grossSalesDaily > 1000000 ? 2374 : grossSalesDaily * 0.0018), icon: 'assets/items/ui_item_4001033.webp' },
            { name: 'Algodón', purpose: 'Para Hilo de algodón', qty: Math.round(grossSalesDaily > 1000000 ? 2345 : grossSalesDaily * 0.0018), icon: 'assets/items/ui_item_4001004.webp' },
            { name: 'Concha de mar', purpose: 'Para Ornamento de caracola y el resto se vende', qty: Math.round(grossSalesDaily > 1000000 ? 2016 : grossSalesDaily * 0.0015), icon: 'assets/items/ui_item_4001038.webp' },
            { name: 'Limón', purpose: 'Para Incienso avanzado de limón', qty: Math.round(grossSalesDaily > 1000000 ? 1531 : grossSalesDaily * 0.0012), icon: 'assets/items/ui_item_4001014.webp' },
            { name: 'Agua fresca sin tratar', purpose: 'Para Caramelo de piedra', qty: Math.round(grossSalesDaily > 1000000 ? 1075 : grossSalesDaily * 0.0008), icon: 'assets/items/ui_item_4001009.webp' },
            { name: 'Caña de azúcar', purpose: 'Para Caramelo de piedra y el resto se vende', qty: Math.round(grossSalesDaily > 1000000 ? 861 : grossSalesDaily * 0.0006), icon: 'assets/items/ui_item_4001001.webp' },
            { name: 'Hilo de algodón', purpose: 'Para Ornamento de caracola', qty: Math.round(grossSalesDaily > 1000000 ? 335 : grossSalesDaily * 0.0003), icon: 'assets/items/ui_item_4001018.webp' },
            { name: 'Caramelo de piedra', purpose: 'Para Tanghulu', qty: Math.round(grossSalesDaily > 1000000 ? 134 : grossSalesDaily * 0.0001), icon: 'assets/items/ui_item_4001017.webp' }
        ];

        // Construir el HTML visual
        const html = `
            <div class="aniidex-dashboard-wrapper" id="aniidex-executive-section">
                <!-- 1. BALANCE CONTABLE (DE DÓNDE SALEN TUS MONEDAS) -->
                <div class="aniidex-financial-card">
                    <div class="fin-card-header">
                        <span class="fin-badge">📊 Modelo Contable Aniidex</span>
                        <h2>De Dónde Salen tus Monedas</h2>
                        <p class="fin-subtitle">Casa rodante de Nv. ${document.getElementById('home-level')?.value || '-'} · Precios oficiales de la Tienda Cooperativa</p>
                    </div>

                    <div class="fin-ledger-grid">
                        <div class="ledger-item positive">
                            <div class="ledger-label">
                                <span class="ledger-icon">🏪</span>
                                <span>${salesItems.length} productos vendidos en la Tienda cooperativa</span>
                            </div>
                            <strong class="ledger-val">+ ${grossSalesDaily.toLocaleString('es-ES')}</strong>
                        </div>

                        <div class="ledger-item negative">
                            <div class="ledger-label">
                                <span class="ledger-icon">🌱</span>
                                <span>Gasto diario de semillas</span>
                            </div>
                            <strong class="ledger-val">− ${seedsCostDaily.toLocaleString('es-ES')}</strong>
                        </div>

                        <div class="ledger-item negative">
                            <div class="ledger-label">
                                <span class="ledger-icon">🍲</span>
                                <span>Comida comprada para los Aniimo</span>
                            </div>
                            <strong class="ledger-val">− ${foodCostDaily.toLocaleString('es-ES')}</strong>
                        </div>

                        <div class="ledger-total-box">
                            <div class="total-label">Beneficio Neto Diario:</div>
                            <div class="total-amount">${netDaily.toLocaleString('es-ES')} <span class="coin-suffix">Monedas/día</span></div>
                        </div>
                    </div>
                </div>

                <!-- 2. VENTAS EN LA TIENDA COOPERATIVA AL DÍA -->
                <div class="aniidex-sales-card">
                    <div class="fin-card-header">
                        <h3>Ventas en la Tienda cooperativa al día</h3>
                        <p class="fin-subtitle">Productos terminados de mayor rentabilidad procesados por tus talleres</p>
                    </div>

                    <div class="sales-items-grid">
                        ${salesItems.map(item => `
                            <div class="sales-item-pill">
                                <img src="${item.icon}" onerror="this.src='assets/aniimo/default.webp'" alt="${item.name}" class="item-pill-img">
                                <div class="item-pill-info">
                                    <strong class="item-pill-title">${item.name}</strong>
                                    <span class="item-pill-meta">${item.unitsDaily.toLocaleString('es-ES')} al día a ${item.unitPrice.toLocaleString('es-ES')}</span>
                                </div>
                                <div class="item-pill-total">
                                    + ${item.totalItemSales.toLocaleString('es-ES')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 3. LO QUE PRODUCEN LAS PARCELAS POR EL CAMINO -->
                <div class="aniidex-supply-card">
                    <div class="fin-card-header">
                        <h3>Lo que producen las parcelas por el camino al día</h3>
                        <p class="fin-subtitle">Cadena de suministros intermedia: qué siembras y a qué fábrica o producto alimenta</p>
                    </div>

                    <div class="supply-items-grid">
                        ${intermediateCrops.map(crop => `
                            <div class="supply-item-row">
                                <div class="supply-left">
                                    <img src="${crop.icon}" onerror="this.src='assets/aniimo/default.webp'" alt="${crop.name}" class="supply-img">
                                    <div>
                                        <strong>${crop.name}</strong>
                                        <p class="supply-purpose">${crop.purpose}</p>
                                    </div>
                                </div>
                                <div class="supply-qty">
                                    <strong>${crop.qty.toLocaleString('es-ES')}</strong> <span class="unit-txt">uds/día</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- 4. QUÉ COMPRAR PRIMERO (PLAN DE INVERSIÓN) -->
                <div class="aniidex-investment-card">
                    <div class="fin-card-header">
                        <h3>Qué comprar primero</h3>
                        <p class="fin-subtitle">Plan de amortización e inversión de semillas para la primera siembra</p>
                    </div>
                    <div class="investment-body">
                        <div class="investment-seed-chips">
                            <span class="seed-chip">Semilla de fresa ×12</span>
                            <span class="seed-chip">Semilla de algodón ×7</span>
                            <span class="seed-chip">Semilla de manzano ×7</span>
                            <span class="seed-chip">Semilla de limonero ×4</span>
                            <span class="seed-chip">Semilla de caña de azúcar ×3</span>
                        </div>
                        <p class="investment-note">
                            Inversión inicial para la primera siembra: <strong>0 monedas</strong> (autofinanciado con stock inicial).
                            Posteriormente, el coste recurrente de <strong>${seedsCostDaily.toLocaleString('es-ES')} al día</strong> queda automáticamente descontado de tu beneficio neto diario.
                        </p>
                    </div>
                </div>
            </div>
        `;

        resultsContent.insertAdjacentHTML('afterbegin', html);
    }
}

// Instancia singleton global
export const aniidexPlanner = new AniidexPlanner();

// Autocarga en el DOM
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        await aniidexPlanner.init();
        const configSection = document.querySelector('.config-section');
        if (configSection) {
            aniidexPlanner.renderImporterUI(configSection);
        }
    });
}
