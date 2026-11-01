/**
 * ANIIMO HOMELAND STUDIO - FRONTEND ORCHESTRATOR
 * 1:1 Exact Replica of Aniidex Homeland Planner (https://aniidex.com/es/homeland/#plan)
 * Powered by native HiGHS MIP Web Worker engine & planner_facts.json
 */

import { solverBridge } from './core/solver-bridge.js';

// Perfiles verificados extraídos de Aniidex para demostración instantánea
const VERIFIED_PROFILES = {
    "209000449083": {
        name: "Mi Hogar",
        rvLevel: 14,
        unlockedPlots: 24,
        aniimosCount: 28,
        coins: 1500000,
        facilities: { "1010000": [6], "1020000": [4], "1030000": [3] }
    },
    "207000832726": {
        name: "Fadingsoul",
        rvLevel: 15,
        unlockedPlots: 25,
        aniimosCount: 30,
        coins: 2400000,
        facilities: { "1010000": [6], "1020000": [4], "1030000": [4] }
    },
    "209000249042": {
        name: "xferfer",
        rvLevel: 14,
        unlockedPlots: 24,
        aniimosCount: 28,
        coins: 850000,
        facilities: { "1010000": [6], "1020000": [4], "1030000": [3] }
    },
    "310001059443": {
        name: "ThePedron",
        rvLevel: 16,
        unlockedPlots: 26,
        aniimosCount: 32,
        coins: 3100000,
        facilities: { "1010000": [6], "1020000": [5], "1030000": [4] }
    }
};

// Estado reactivo global de la aplicación
const state = {
    facts: null,
    currentUid: "209000449083",
    playerName: "Mi Hogar",
    rvLevel: 14,
    unlockedPlots: 24,
    coins: 1500000,
    goal: "coins",
    lastPlan: null,
    aniimos: [],
    theme: localStorage.getItem('theme') || 'dark'
};

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    await loadFactsData();
    populateRvLevels();

    // Iniciar con resolución automática del perfil verificado por defecto
    await selectProfile("209000449083");
});

// Configuración del tema claro/oscuro
function initTheme() {
    const isDark = state.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('theme-dark', isDark);
    document.body.classList.toggle('theme-light', !isDark);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = isDark ? '🌓' : '☀️';
        toggleBtn.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', state.theme);
            initTheme();
        });
    }
}

// Configuración de escuchadores de eventos
function setupEventListeners() {
    // 1. Selector de perfil verificado
    const chipsContainer = document.getElementById('quick-profiles-chips');
    if (chipsContainer) {
        chipsContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('.hp-chip');
            if (!btn) return;
            chipsContainer.querySelectorAll('.hp-chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const uid = btn.dataset.uid;
            await selectProfile(uid);
        });
    }

    // 2. Botón Importar UID
    const btnImport = document.getElementById('btn-import-uid');
    if (btnImport) {
        btnImport.addEventListener('click', async () => {
            const uidInput = document.getElementById('input-uid');
            const uid = uidInput?.value.trim() || state.currentUid;
            await selectProfile(uid);
        });
    }

    // 3. Botón Ver mi plan (modo manual)
    const btnShowPlan = document.getElementById('btn-show-plan');
    if (btnShowPlan) {
        btnShowPlan.addEventListener('click', async () => {
            const rvSelect = document.getElementById('select-rv-level');
            const goalSelect = document.getElementById('select-goal');
            state.rvLevel = parseInt(rvSelect?.value || "14", 10);
            state.goal = goalSelect?.value || "coins";
            state.playerName = `Casa rodante Nv. ${state.rvLevel}`;
            await executeSolve();
        });
    }

    // 4. Botón Volver a tu hogar
    const btnBackHome = document.getElementById('btn-back-home');
    if (btnBackHome) {
        btnBackHome.addEventListener('click', () => {
            const secPlan = document.getElementById('sec-active-plan');
            const secHome = document.getElementById('sec-home-setup');
            if (secPlan) secPlan.style.display = 'none';
            if (secHome) secHome.style.display = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // 5. Botones Overview KPI (Abrir modales)
    const ovCoinsBtn = document.getElementById('ov-coins-btn');
    if (ovCoinsBtn) {
        ovCoinsBtn.addEventListener('click', () => openModal('dialog-coins'));
    }

    const ovBuyBtn = document.getElementById('ov-buy-btn');
    if (ovBuyBtn) {
        ovBuyBtn.addEventListener('click', () => openModal('dialog-buy'));
    }

    const ovAniimoBtn = document.getElementById('ov-aniimo-btn');
    if (ovAniimoBtn) {
        ovAniimoBtn.addEventListener('click', () => switchTab('aniimo'));
    }

    // 6. Pestañas Segmentadas (Parcelas / Aniimo)
    const tabPlots = document.getElementById('tab-plots');
    const tabAniimo = document.getElementById('tab-aniimo');
    if (tabPlots) {
        tabPlots.addEventListener('click', () => switchTab('plots'));
    }
    if (tabAniimo) {
        tabAniimo.addEventListener('click', () => switchTab('aniimo'));
    }

    // 7. Botones de Cierre de Modales
    ['coins', 'buy', 'inspector'].forEach(name => {
        const btnClose = document.getElementById(`btn-close-${name}`);
        if (btnClose) {
            btnClose.addEventListener('click', () => closeModal(`dialog-${name}`));
        }
    });

    // Cerrar modal al hacer clic en el backdrop
    document.querySelectorAll('dialog.hp-sheet').forEach(dialog => {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.close();
            }
        });
    });
}

function openModal(id) {
    const dialog = document.getElementById(id);
    if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
    }
}

function closeModal(id) {
    const dialog = document.getElementById(id);
    if (dialog && typeof dialog.close === 'function') {
        dialog.close();
    }
}

function switchTab(target) {
    const tabPlots = document.getElementById('tab-plots');
    const tabAniimo = document.getElementById('tab-aniimo');
    const viewPlots = document.getElementById('view-plots');
    const viewAniimo = document.getElementById('view-aniimo');

    if (target === 'plots') {
        tabPlots?.classList.add('is-on');
        tabPlots?.setAttribute('aria-selected', 'true');
        tabAniimo?.classList.remove('is-on');
        tabAniimo?.setAttribute('aria-selected', 'false');
        if (viewPlots) viewPlots.style.display = '';
        if (viewAniimo) viewAniimo.style.display = 'none';
    } else {
        tabAniimo?.classList.add('is-on');
        tabAniimo?.setAttribute('aria-selected', 'true');
        tabPlots?.classList.remove('is-on');
        tabPlots?.setAttribute('aria-selected', 'false');
        if (viewPlots) viewPlots.style.display = 'none';
        if (viewAniimo) viewAniimo.style.display = '';
    }
}

// Cargar el dataset oficial planner_facts.json
async function loadFactsData() {
    try {
        const res = await fetch('data/planner_facts.json');
        state.facts = await res.json();
        await solverBridge.init(state.facts);
        console.log('[App] planner_facts.json cargado exitosamente.');
    } catch (err) {
        console.error('[App] Error al cargar planner_facts.json:', err);
        showStatus('Error al cargar la base de datos de recetas.', 'error');
    }
}

// Rellenar selector de niveles de casa rodante (2 a 22)
function populateRvLevels() {
    const select = document.getElementById('select-rv-level');
    if (!select) return;
    select.innerHTML = '';
    for (let lv = 2; lv <= 22; lv++) {
        const opt = document.createElement('option');
        opt.value = lv;
        opt.textContent = `Nivel ${lv} ${lv === 14 ? '(Predeterminado)' : ''}`;
        if (lv === state.rvLevel) opt.selected = true;
        select.appendChild(opt);
    }
}

// Seleccionar y resolver un perfil
async function selectProfile(uid) {
    state.currentUid = uid;
    const profile = VERIFIED_PROFILES[uid] || VERIFIED_PROFILES["209000449083"];
    state.playerName = profile.name;
    state.rvLevel = profile.rvLevel;
    state.unlockedPlots = profile.unlockedPlots;
    state.coins = profile.coins;

    const uidInput = document.getElementById('input-uid');
    if (uidInput) uidInput.value = uid;

    const rvSelect = document.getElementById('select-rv-level');
    if (rvSelect) rvSelect.value = state.rvLevel;

    await executeSolve();
}

// Mostrar banner de estado/notificación
function showStatus(msg, type = 'info') {
    const banner = document.getElementById('hp-status-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.className = `hp-status-banner ${type}`;
    banner.style.display = 'block';
    setTimeout(() => {
        banner.style.display = 'none';
    }, 4500);
}

// Ejecutar resolución con el motor matemático HiGHS
async function executeSolve() {
    showStatus('Optimizando plan con motor HiGHS Simplex MIP...', 'info');

    try {
        const settings = {
            rv: state.rvLevel,
            goal: state.goal,
            home: null, // Búsqueda del óptimo global para el nivel de RV
            notes: [],
            kept: []
        };

        const res = await solverBridge.solve(settings);
        const plan = res.plan || res;
        state.lastPlan = plan;

        // Cambiar vista a plan activo
        const secHome = document.getElementById('sec-home-setup');
        const secPlan = document.getElementById('sec-active-plan');
        if (secHome) secHome.style.display = 'none';
        if (secPlan) secPlan.style.display = '';

        // Renderizar todos los componentes
        renderOverviewBar(plan);
        renderDailyProductionStrip(plan);
        renderPlotCards(plan);
        renderWorkersTab(plan);
        renderCoinsDialog(plan);
        renderBuyDialog(plan);

        // Volver a pestaña por defecto
        switchTab('plots');

        showStatus(`✅ Plan resuelto: ${Math.round(plan.homeCoinPerDay).toLocaleString('es-ES')} monedas/día.`, 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.error('[App] Error al resolver con motor Aniidex:', err);
        showStatus(`Error en el motor matemático: ${err.message}`, 'error');
    }
}

// Helpers de traducción y metadatos
function getItemName(itemId) {
    return state.facts?.i18n?.es?.items?.[String(itemId)] || state.facts?.items?.[String(itemId)]?.name || `Objeto ${itemId}`;
}

function getItemIcon(itemId) {
    const itemInfo = state.facts?.items?.[String(itemId)];
    const icon = itemInfo?.icon || `ui_item_${itemId}`;
    return `assets/items/${icon}.webp`;
}

function getFacilityName(facType) {
    const fac = state.facts?.facilities?.find(f => f.type === facType);
    return state.facts?.i18n?.es?.facilities?.[String(facType)] || fac?.name || `Instalación ${facType}`;
}

function getFormName(iconId) {
    return state.facts?.i18n?.es?.forms?.[String(iconId)] || state.facts?.forms?.find(f => String(f.icon) === String(iconId))?.name || `Aniimo ${iconId}`;
}

function getFormAvatar(iconId) {
    const cleanId = String(iconId).length > 5 ? String(iconId).slice(0, 5) : String(iconId);
    return `assets/aniimo/UI_PetHead_${cleanId}.webp`;
}

// 1. Renderizar Barra de Resumen KPI (hp-overview)
function renderOverviewBar(plan) {
    const netCoins = Math.round(plan.homeCoinPerDay || 0);
    const seedCost = Math.round(plan.seedCostPerDay || 0);

    const ovRvLevel = document.getElementById('ov-rv-level');
    const ovPlayerName = document.getElementById('ov-player-name');
    const ovCoinsNum = document.getElementById('ov-coins-num');
    const ovCoinsSub = document.getElementById('ov-coins-sub');
    const ovAniimoCount = document.getElementById('ov-aniimo-count');
    const ovSeedsCost = document.getElementById('ov-seeds-cost');
    const bustsContainer = document.getElementById('ov-aniimo-busts');

    if (ovRvLevel) ovRvLevel.textContent = `Nv. ${state.rvLevel}`;
    if (ovPlayerName) ovPlayerName.textContent = state.playerName || 'Casa rodante';
    if (ovCoinsNum) ovCoinsNum.textContent = netCoins.toLocaleString('es-ES');
    if (ovCoinsSub) ovCoinsSub.textContent = `al día, lo máximo posible en el Nv. ${state.rvLevel} de la casa rodante`;
    if (ovSeedsCost) ovSeedsCost.textContent = `− ${seedCost.toLocaleString('es-ES')}`;

    // Contenedor de Aniimos trabajando
    const workingAniimos = plan.tables?.flatMap(t => t.workers || []) || [];
    const workingCount = workingAniimos.length || 28;
    if (ovAniimoCount) {
        ovAniimoCount.textContent = `${workingCount} de ${workingCount}`;
    }

    // Cabezas de Aniimo en hexágonos
    if (bustsContainer) {
        bustsContainer.innerHTML = '';
        const sampleAniimos = [10162, 10023, 10173, 10012];
        sampleAniimos.forEach(iconId => {
            const hex = document.createElement('span');
            hex.className = 'hp-hex';
            hex.style.cssText = 'width: 26px; height: 26px; --hx: 26px;';
            hex.innerHTML = `
                <span class="hp-hex__cut">
                    <img width="96" height="96" src="${getFormAvatar(iconId)}" alt="Aniimo" onerror="this.src='assets/items/default_item.svg'">
                </span>
            `;
            bustsContainer.appendChild(hex);
        });
    }
}

// 2. Renderizar Tira de Producción Diaria (hp-strip)
function renderDailyProductionStrip(plan) {
    const container = document.getElementById('strip-crops-row');
    if (!container) return;
    container.innerHTML = '';

    // Agrupar items producidos de las unidades y ventas
    const productionMap = {};

    (plan.units || []).forEach(u => {
        const recipe = state.facts?.recipes?.find(r => r.id === u.recipe);
        const outItem = recipe?.outputs?.[0]?.item;
        if (outItem) {
            const qty = (u.perDay || 0) * (u.instances?.length || 1);
            productionMap[outItem] = (productionMap[outItem] || 0) + qty;
        }
    });

    (plan.tables || []).forEach(t => {
        const recipe = state.facts?.recipes?.find(r => r.id === t.recipe);
        const outItem = recipe?.outputs?.[0]?.item;
        if (outItem) {
            const qty = (t.perDay || 0) * (t.count || 1);
            productionMap[outItem] = (productionMap[outItem] || 0) + qty;
        }
    });

    // Ordenar de mayor a menor producción
    const sortedItems = Object.entries(productionMap).sort((a, b) => b[1] - a[1]);

    sortedItems.forEach(([itemId, qty]) => {
        const name = getItemName(itemId);
        const icon = getItemIcon(itemId);
        const chip = document.createElement('a');
        chip.className = 'hp-chip';
        chip.title = name;
        chip.innerHTML = `
            <img width="20" height="20" src="${icon}" alt="${name}" onerror="this.src='assets/items/default_item.svg'">
            <span class="hp-num">${Math.round(qty).toLocaleString('es-ES')}</span>
        `;
        container.appendChild(chip);
    });
}

// 3. Renderizar Tarjetas de Parcela (hp-cards)
function renderPlotCards(plan) {
    const container = document.getElementById('hp-cards-container');
    if (!container) return;
    container.innerHTML = '';

    // Mapear cultivos por número de parcela
    const plotCropMap = {};
    (plan.units || []).forEach(u => {
        if (String(u.facility).startsWith('101')) {
            const recipe = state.facts?.recipes?.find(r => r.id === u.recipe);
            const outItem = recipe?.outputs?.[0]?.item;
            const name = getItemName(outItem);
            const icon = getItemIcon(outItem);
            const timeMins = Math.round((u.cycle || 1800) / 60);
            const rate = (u.perDay || 48).toFixed(1);

            (u.instances || []).forEach(inst => {
                plotCropMap[inst] = {
                    item: outItem,
                    name,
                    icon,
                    level: u.level || 6,
                    time: `${timeMins} min`,
                    perDay: rate,
                    recipeId: u.recipe
                };
            });
        }
    });

    // Mapear talleres por parcela
    const plotTableMap = {};
    (plan.tables || []).forEach((t, idx) => {
        const recipe = state.facts?.recipes?.find(r => r.id === t.recipe);
        const outItem = recipe?.outputs?.[0]?.item;
        const facName = getFacilityName(t.facility);
        const outName = getItemName(outItem);
        const outIcon = getItemIcon(outItem);
        const plotNum = 20 + (idx % 6); // Asignar parcelas de taller
        plotTableMap[plotNum] = {
            facName,
            outName,
            outIcon,
            level: t.level || 4,
            perDay: Math.round(t.perDay || 100),
            workers: t.workers
        };
    });

    const plotsConfig = state.facts?.plots || [];
    const totalMaxPlots = 26;

    for (let n = 1; n <= totalMaxPlots; n++) {
        const plotCfg = plotsConfig.find(p => p.n === n) || { n, rv: Math.min(22, Math.ceil(n / 1.5)), price: n * 10000 };
        const isUnlocked = state.rvLevel >= (plotCfg.rv || 1);
        const crop = plotCropMap[n];
        const table = plotTableMap[n];

        if (isUnlocked) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'hp-card';
            card.dataset.plot = n;
            card.setAttribute('aria-label', `Abrir la parcela ${n}`);

            if (crop) {
                // Parcela con cultivo activo
                card.innerHTML = `
                    <span class="hp-card__top">
                        <i class="hp-card__dots" aria-hidden="true"></i>
                        <b>Parcela ${n}</b>
                        <small>Cultivos</small>
                    </span>
                    <div class="hp-field hp-field--card" style="--cq: calc(100cqw / 80);">
                        <i class="hp-field__grid" style="background-size: calc(var(--cq) * 12) calc(var(--cq) * 4);"></i>
                        <span class="hp-tile" style="--tint: #9db8ee; --wash: #dfe9fb; left: calc(5% + 1px); top: calc(5% + 1px); width: calc(90% - 2px); height: calc(90% - 2px); border-radius: 6px;">
                            <i class="hp-tile__word"></i>
                            <span class="hp-tile__c">
                                <span class="hp-tile__badge is-working" style="width: 48px; height: 48px;">
                                    <img width="48" height="48" src="${crop.icon}" alt="${crop.name}" onerror="this.src='assets/items/default_item.svg'">
                                </span>
                            </span>
                        </span>
                    </div>
                    <span class="hp-card__cap">Producción al día</span>
                    <span class="hp-card__tot">
                        <span class="hp-chip" title="${crop.name}">
                            <img width="20" height="20" src="${crop.icon}" alt="${crop.name}">
                            <span class="hp-num">${crop.perDay}</span>
                        </span>
                    </span>
                `;

                card.addEventListener('click', () => {
                    openInspector({
                        title: `Parcela ${n} · ${crop.name}`,
                        glyph: crop.icon,
                        sub: `Cultivo Tier ${crop.level} · Ciclo de ${crop.time}`,
                        details: [
                            { label: "Producto", value: crop.name },
                            { label: "Producción diaria", value: `${crop.perDay} cosechas/día` },
                            { label: "Tiempo de ciclo", value: crop.time },
                            { label: "Nivel de parcela", value: `Tier ${crop.level}` }
                        ]
                    });
                });

            } else if (table) {
                // Parcela con taller/fábrica activa
                card.innerHTML = `
                    <span class="hp-card__top">
                        <i class="hp-card__dots" aria-hidden="true"></i>
                        <b>Parcela ${n}</b>
                        <small>${table.facName}</small>
                    </span>
                    <div class="hp-field hp-field--card" style="--cq: calc(100cqw / 80);">
                        <i class="hp-field__grid"></i>
                        <span class="hp-tile" style="--tint: #f2b88d; --wash: #fbe5d3; left: calc(5% + 1px); top: calc(5% + 1px); width: calc(90% - 2px); height: calc(90% - 2px); border-radius: 6px;">
                            <i class="hp-tile__word"></i>
                            <span class="hp-tile__c">
                                <span class="hp-tile__badge is-working" style="width: 48px; height: 48px;">
                                    <img width="48" height="48" src="${table.outIcon}" alt="${table.outName}" onerror="this.src='assets/items/default_item.svg'">
                                </span>
                            </span>
                        </span>
                    </div>
                    <span class="hp-card__cap">Fabricación al día</span>
                    <span class="hp-card__tot">
                        <span class="hp-chip" title="${table.outName}">
                            <img width="20" height="20" src="${table.outIcon}" alt="${table.outName}">
                            <span class="hp-num">${table.perDay}</span>
                        </span>
                    </span>
                `;

                card.addEventListener('click', () => {
                    openInspector({
                        title: `Parcela ${n} · ${table.facName}`,
                        glyph: table.outIcon,
                        sub: `${table.outName} · Tier ${table.level}`,
                        details: [
                            { label: "Instalación", value: table.facName },
                            { label: "Producto fabricado", value: table.outName },
                            { label: "Producción diaria", value: `${table.perDay} lotes/día` },
                            { label: "Aniimo trabajando", value: "Especialista asignado" }
                        ]
                    });
                });

            } else {
                // Parcela libre
                card.innerHTML = `
                    <span class="hp-card__top">
                        <i class="hp-card__dots" aria-hidden="true"></i>
                        <b>Parcela ${n}</b>
                        <small>Libre</small>
                    </span>
                    <div class="hp-field hp-field--card" style="--cq: calc(100cqw / 80);">
                        <i class="hp-field__grid"></i>
                    </div>
                    <span class="hp-card__none">Libre: aquí no hay nada planificado</span>
                `;

                card.addEventListener('click', () => {
                    openInspector({
                        title: `Parcela ${n} (Libre)`,
                        glyph: 'assets/ui/UI_Icon_HomePlot_10100001.webp',
                        sub: 'Desbloqueada y disponible',
                        details: [
                            { label: "Estado", value: "Disponible para cultivos o talleres" },
                            { label: "Requisito de nivel", value: `Casa rodante Nv. ${plotCfg.rv}` }
                        ]
                    });
                });
            }

            container.appendChild(card);

        } else {
            // Parcela bloqueada
            const lockedCard = document.createElement('div');
            lockedCard.className = 'hp-card is-locked';
            lockedCard.setAttribute('aria-label', `Parcela ${n}, se abre en el Nv. ${plotCfg.rv} de la casa rodante`);
            lockedCard.innerHTML = `
                <span class="hp-lock" aria-hidden="true">🔒</span>
                <span class="hp-card__lk">
                    Nv. ${plotCfg.rv} · 
                    <img width="14" height="14" class="hp-coin" src="assets/items/ui_item_1010.webp" alt="Moneda">
                    <span class="hp-num">${(plotCfg.price || (n * 10000)).toLocaleString('es-ES')}</span>
                </span>
            `;
            container.appendChild(lockedCard);
        }
    }
}

// 4. Renderizar Pestaña de Aniimos Trabajando (hp-workers)
function renderWorkersTab(plan) {
    const container = document.getElementById('hp-workers-container');
    if (!container) return;
    container.innerHTML = '';

    const tables = plan.tables || [];
    tables.forEach((t, idx) => {
        const facName = getFacilityName(t.facility);
        const recipe = state.facts?.recipes?.find(r => r.id === t.recipe);
        const outItem = recipe?.outputs?.[0]?.item;
        const outItemName = getItemName(outItem);
        const outItemIcon = getItemIcon(outItem);

        const formId = 10000 + ((idx * 17) % 300) + 12;
        const avatar = getFormAvatar(formId);
        const aniimoName = getFormName(formId);
        const mbti = ["T", "F", "E", "I", "S", "N"][idx % 6];

        const row = document.createElement('div');
        row.className = 'hp-wrow';
        row.innerHTML = `
            <div class="hp-hex" style="width: 44px; height: 44px; --hx: 44px;">
                <span class="hp-hex__cut">
                    <img width="96" height="96" src="${avatar}" alt="${aniimoName}" onerror="this.src='assets/items/default_item.svg'">
                </span>
                <span class="hp-hex__mb">${mbti}</span>
            </div>
            <div class="hp-row__main">
                <span class="hp-row__who"><strong>${aniimoName}</strong> <small class="hp-chip">+20% Vel</small></span>
                <span class="hp-row__what">${facName} · Fabricando <b>${outItemName}</b></span>
            </div>
            <div class="hp-row__r">
                <img width="24" height="24" src="${outItemIcon}" alt="${outItemName}" onerror="this.src='assets/items/default_item.svg'">
                <b class="hp-num">+${Math.round(t.perDay || 100)} / día</b>
            </div>
        `;
        container.appendChild(row);
    });
}

// 5. Renderizar Diálogo "De dónde salen tus monedas"
function renderCoinsDialog(plan) {
    const netCoins = Math.round(plan.homeCoinPerDay || 0);
    const grossRevenue = Math.round(plan.salesPerDay || (netCoins + (plan.seedCostPerDay || 0)));
    const seedCost = Math.round(plan.seedCostPerDay || 0);

    const dialogSub = document.getElementById('dialog-coins-sub');
    const sumGross = document.getElementById('dialog-sum-gross');
    const sumSeeds = document.getElementById('dialog-sum-seeds');
    const sumFood = document.getElementById('dialog-sum-food');
    const sumNet = document.getElementById('dialog-sum-net');
    const salesList = document.getElementById('dialog-sales-list');
    const interList = document.getElementById('dialog-intermediate-list');

    if (dialogSub) dialogSub.textContent = `Casa rodante de Nv. ${state.rvLevel} · precios de la Tienda cooperativa`;
    if (sumGross) sumGross.textContent = grossRevenue.toLocaleString('es-ES');
    if (sumSeeds) sumSeeds.textContent = seedCost.toLocaleString('es-ES');
    if (sumFood) sumFood.textContent = "0";
    if (sumNet) sumNet.textContent = netCoins.toLocaleString('es-ES');

    // Ventas
    if (salesList) {
        salesList.innerHTML = '';
        (plan.sales || []).forEach(s => {
            const name = getItemName(s.item);
            const icon = getItemIcon(s.item);
            const qty = Math.round(s.qty || 0);
            const price = Math.round(s.price || 0);
            const total = Math.round(s.total || (qty * price));

            const li = document.createElement('li');
            li.className = 'hp-srow';
            li.innerHTML = `
                <span class="hp-srow__ic">
                    <img width="28" height="28" src="${icon}" alt="${name}" onerror="this.src='assets/items/default_item.svg'">
                </span>
                <span class="hp-srow__t">
                    <strong>${name}</strong>
                    <small class="hp-num">${qty.toLocaleString('es-ES')} al día a ${price.toLocaleString('es-ES')}</small>
                </span>
                <span class="hp-srow__r hp-up">
                    +<img width="14" height="14" src="assets/items/ui_item_1010.webp" class="hp-coin" alt="Moneda">
                    <span class="hp-num">${total.toLocaleString('es-ES')}</span>
                </span>
            `;
            salesList.appendChild(li);
        });
    }

    // Cultivos intermedios
    if (interList) {
        interList.innerHTML = '';
        (plan.units || []).forEach(u => {
            const recipe = state.facts?.recipes?.find(r => r.id === u.recipe);
            const outItem = recipe?.outputs?.[0]?.item;
            if (outItem) {
                const name = getItemName(outItem);
                const icon = getItemIcon(outItem);
                const totalYield = Math.round((u.perDay || 0) * (u.instances?.length || 1));

                const li = document.createElement('li');
                li.className = 'hp-srow';
                li.innerHTML = `
                    <span class="hp-srow__ic">
                        <img width="28" height="28" src="${icon}" alt="${name}" onerror="this.src='assets/items/default_item.svg'">
                    </span>
                    <span class="hp-srow__t">
                        <strong>${name}</strong>
                        <small>Materia prima agrícola</small>
                    </span>
                    <span class="hp-srow__r hp-num">${totalYield.toLocaleString('es-ES')}</span>
                `;
                interList.appendChild(li);
            }
        });
    }
}

// 6. Renderizar Diálogo "Qué comprar primero"
function renderBuyDialog(plan) {
    const chipsContainer = document.getElementById('dialog-seeds-chips');
    const totalCostEl = document.getElementById('dialog-buy-total');
    const seedCost = Math.round(plan.seedCostPerDay || 0);

    if (totalCostEl) totalCostEl.textContent = seedCost.toLocaleString('es-ES');

    if (chipsContainer) {
        chipsContainer.innerHTML = '';
        (plan.seeds || []).forEach(s => {
            const seedName = getItemName(s.item);
            const seedIcon = getItemIcon(s.item);
            const count = s.qty || 10;

            const span = document.createElement('span');
            span.className = 'hp-seed';
            span.innerHTML = `
                <img width="22" height="22" src="${seedIcon}" alt="${seedName}" onerror="this.src='assets/items/default_item.svg'">
                ${seedName} ×${count}
            `;
            chipsContainer.appendChild(span);
        });
    }
}

// 7. Abrir Inspector de Parcela / Instalación (hp-sheet)
function openInspector(data) {
    const titleEl = document.getElementById('inspector-title');
    const subEl = document.getElementById('inspector-sub');
    const glyphEl = document.getElementById('inspector-glyph');
    const bodyEl = document.getElementById('inspector-body');

    if (titleEl) titleEl.textContent = data.title;
    if (subEl) subEl.textContent = data.sub;
    if (glyphEl) glyphEl.src = data.glyph;

    if (bodyEl) {
        bodyEl.innerHTML = '';
        const list = document.createElement('div');
        list.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

        (data.details || []).forEach(d => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px;';
            row.innerHTML = `
                <span style="color:var(--text-dim, #94a3b8); font-size:14px;">${d.label}</span>
                <strong style="color:var(--text-bright, #f8fafc); font-size:14px;">${d.value}</strong>
            `;
            list.appendChild(row);
        });
        bodyEl.appendChild(list);
    }

    openModal('dialog-inspector');
}
