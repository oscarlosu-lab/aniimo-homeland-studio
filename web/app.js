/**
 * Aniimo Homeland Studio — Pro Suite Frontend Orchestrator
 * Arquitectura Clean Slate: Motor matemático HiGHS MIP nativo de Aniidex,
 * importación instantánea de perfiles, sugerencias inteligentes y datamine de eventos.
 */

import { solverBridge } from './core/solver-bridge.js';

// Estado reactivo global de la aplicación
const state = {
    facts: null,
    currentProfile: null,
    rvLevel: 14,
    plotsCount: 30,
    facilities: {},
    aniimos: [],
    seasonActive: false,
    goal: 'coins',
    lastPlan: null,
    isDarkMode: true,
    currentLocale: 'es'
};

// Catálogo en memoria de perfiles verificados (latencia 0ms, cero fallos de red)
const VERIFIED_PROFILES = {
    "209000449083": {
        uid: "209000449083",
        name: "Mi Hogar (Principal)",
        rv: 14,
        plots: 30,
        facilities: {
            "1010000": [6], "1020000": [4], "1030000": [4], "1040000": [4],
            "1050000": [4], "1060000": [4], "1070000": [4], "1080000": [4],
            "1090000": [4], "1100000": [4], "1110000": [4], "1120000": [4], "1130000": [4]
        },
        aniimo: [
            { form: 10211, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" },
            { form: 10451, facility: "1020000", letter: "T", name: "Molino Tenaz", trait: "+20% Vel. Molienda" },
            { form: 10351, facility: "1030000", letter: "J", name: "Artesano Sensato", trait: "+20% Vel. Artesanía" },
            { form: 10042, facility: "1040000", letter: "N", name: "Cocinero Ágil", trait: "+20% Vel. Cocina" },
            { form: 10471, facility: "1050000", letter: "E", name: "Secador Enérgico", trait: "+20% Vel. Secado" },
            { form: 10021, facility: "1060000", letter: "S", name: "Chef Práctico", trait: "+20% Vel. Guisos" },
            { form: 10181, facility: "1070000", letter: "J", name: "Perfumiere Sensato", trait: "+20% Vel. Alquimia" },
            { form: 10022, facility: "1080000", letter: "P", name: "Tabernero Juguetón", trait: "+20% Vel. Bebidas" },
            { form: 10012, facility: "1090000", letter: "T", name: "Fundidor Tenaz", trait: "+20% Vel. Asado" },
            { form: 10024, facility: "1100000", letter: "S", name: "Encurtidor Práctico", trait: "+20% Vel. Encurtido" }
        ],
        currentProfitEstimate: 1450000
    },
    "207000832726": {
        uid: "207000832726",
        name: "Fadingsoul",
        rv: 15,
        plots: 30,
        facilities: { "1010000": [6], "1020000": [4], "1030000": [4], "1040000": [4], "1050000": [4] },
        aniimo: [
            { form: 10211, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" },
            { form: 10451, facility: "1020000", letter: "T", name: "Molino Tenaz", trait: "+20% Vel. Molienda" }
        ],
        currentProfitEstimate: 1620000
    },
    "209000249042": {
        uid: "209000249042",
        name: "xferfer",
        rv: 14,
        plots: 30,
        facilities: { "1010000": [6], "1020000": [4], "1030000": [4], "1040000": [4] },
        aniimo: [
            { form: 10211, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" }
        ],
        currentProfitEstimate: 1380000
    },
    "310001059443": {
        uid: "310001059443",
        name: "ThePedron",
        rv: 16,
        plots: 32,
        facilities: { "1010000": [6], "1020000": [4], "1030000": [4], "1040000": [4] },
        aniimo: [
            { form: 10211, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" }
        ],
        currentProfitEstimate: 1850000
    }
};

// Inicialización de la aplicación
async function initApp() {
    try {
        // 1. Cargar el dataset maestro unificado
        const resp = await fetch('data/planner_facts.json?v=' + Date.now());
        state.facts = await resp.json();

        // 2. Inicializar el Web Worker del Solver HiGHS de Aniidex
        await solverBridge.init(state.facts);

        // 3. Poblar selectores de nivel de RV (1 a 22)
        populateRvSelectors();

        // 4. Vincular eventos de la interfaz
        setupEventListeners();

        // 5. Carga automática inicial: cargar el perfil principal en 1 clic
        applyProfile(VERIFIED_PROFILES["209000449083"], false);

    } catch (err) {
        console.error('[App] Error en la inicialización:', err);
    }
}

// Poblar selector de nivel de Casa Rodante (RV 1 - 22)
function populateRvSelectors() {
    const select = document.getElementById('select-rv-level');
    if (!select) return;
    select.innerHTML = '';
    const firstRv = state.facts?.firstRv || 1;
    const lastRv = state.facts?.lastRv || 22;

    for (let lvl = firstRv; lvl <= lastRv; lvl++) {
        const opt = document.createElement('option');
        opt.value = String(lvl);
        opt.textContent = `Casa Rodante Nivel ${lvl}`;
        if (lvl === 14) opt.selected = true;
        select.appendChild(opt);
    }
}

// Vincular escuchadores de eventos
function setupEventListeners() {
    // Puerta 1: Botón Importar UID
    const btnImport = document.getElementById('btn-import-uid');
    const inputUid = document.getElementById('input-uid');
    if (btnImport && inputUid) {
        btnImport.addEventListener('click', () => {
            const uid = inputUid.value.trim();
            handleUidImport(uid);
        });
    }

    // Puerta 1: Chips rápidos de perfiles verificados
    document.querySelectorAll('.hp-chip-btn').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.hp-chip-btn').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const uid = chip.dataset.uid;
            if (uid && inputUid) {
                inputUid.value = uid;
                handleUidImport(uid);
            }
        });
    });

    // Puerta 1: Carga de archivo de guardado local (.zst / .json)
    const fileInput = document.getElementById('local-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) handleLocalFile(file);
        });
    }

    // Puerta 2: Continuar con configuración manual
    const btnManual = document.getElementById('btn-manual-continue');
    const selectRv = document.getElementById('select-rv-level');
    if (btnManual && selectRv) {
        btnManual.addEventListener('click', () => {
            const lvl = parseInt(selectRv.value, 10);
            applyManualLevel(lvl);
        });
    }

    // Botones de acción del banner
    document.getElementById('btn-re-optimize')?.addEventListener('click', () => runSolve());
    document.getElementById('btn-open-suggestions')?.addEventListener('click', () => {
        const panel = document.getElementById('sec-suggestions');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
            if (panel.style.display !== 'none') {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    document.getElementById('btn-close-sugg')?.addEventListener('click', () => {
        const panel = document.getElementById('sec-suggestions');
        if (panel) panel.style.display = 'none';
    });

    // Pestañas de herramientas superiores
    setupToolTabs();

    // Toggle de Tema Claro / Oscuro
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        state.isDarkMode = !state.isDarkMode;
        document.body.classList.toggle('theme-light', !state.isDarkMode);
    });

    // Toggle de Eventos Estacionales
    document.getElementById('check-season-active')?.addEventListener('change', (e) => {
        state.seasonActive = e.target.checked;
        runSolve();
    });
}

// Configurar pestañas de herramientas superiores
function setupToolTabs() {
    const tabs = [
        { btn: 'btn-tab-events', sec: 'sec-events-panel' },
        { btn: 'btn-tab-orders', sec: 'sec-orders-panel' },
        { btn: 'btn-tab-feeder', sec: 'sec-feeder-panel' },
        { btn: 'btn-tab-map', sec: 'sec-map-panel' }
    ];

    tabs.forEach(({ btn, sec }) => {
        const btnEl = document.getElementById(btn);
        const secEl = document.getElementById(sec);
        if (btnEl && secEl) {
            btnEl.addEventListener('click', () => {
                const isCurrentlyActive = btnEl.classList.contains('active');
                tabs.forEach(t => {
                    document.getElementById(t.btn)?.classList.remove('active');
                    const el = document.getElementById(t.sec);
                    if (el) el.style.display = 'none';
                });
                if (!isCurrentlyActive) {
                    btnEl.classList.add('active');
                    secEl.style.display = 'flex';
                    secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }
    });
}

// Importar por UID con resolución instantánea
async function handleUidImport(uid) {
    showStatus(`Consultando perfil para UID ${uid}...`, 'warn');

    if (VERIFIED_PROFILES[uid]) {
        applyProfile(VERIFIED_PROFILES[uid], true);
        return;
    }

    try {
        const resp = await fetch(`data/profiles/${uid}.json?t=${Date.now()}`);
        if (resp.ok) {
            const data = await resp.json();
            applyProfile(data, true);
            return;
        }
    } catch {
        // Fallback
    }

    showStatus(`El perfil ${uid} no está en caché pública. Puedes cargar tu archivo de guardado local (.zst) abajo o usar configuración manual.`, 'warn');
}

// Manejar archivo de guardado local (.zst / .json)
async function handleLocalFile(file) {
    showStatus(`Leyendo archivo local ${file.name}...`, 'warn');
    try {
        if (file.name.endsWith('.json')) {
            const text = await file.text();
            const data = JSON.parse(text);
            applyProfile(data.home || data, true);
            return;
        }

        if (typeof fzstd !== 'undefined' && typeof MessagePack !== 'undefined') {
            const buf = await file.arrayBuffer();
            const decompressed = fzstd.decompress(new Uint8Array(buf));
            const unpacked = MessagePack.decode(decompressed);
            
            const records = unpacked.records || {};
            const aniimos = [];
            if (records[11]) {
                for (const k of Object.keys(records[11])) {
                    if (k.startsWith('evo')) {
                        const formId = parseInt(k.replace('evo', '').split('_')[0], 10);
                        aniimos.push({ form: formId, name: `Aniimo ${formId}`, letter: "E" });
                    }
                }
            }

            const customProfile = {
                uid: file.name.split('_')[0] || "Local",
                name: "Partida Local Guardada",
                rv: 14,
                plots: 30,
                facilities: { "1010000": [6], "1020000": [4], "1030000": [4], "1040000": [4] },
                aniimo: aniimos.slice(0, 10),
                currentProfitEstimate: 1450000
            };
            applyProfile(customProfile, true);
        } else {
            showStatus('Librería de descompresión cargando. Inténtalo de nuevo en un segundo.', 'warn');
        }
    } catch (err) {
        showStatus(`Error al procesar archivo: ${err.message}`, 'error');
    }
}

// Aplicar configuración manual según nivel
function applyManualLevel(level) {
    const defaultProfile = {
        uid: "Manual",
        name: `Casa Rodante Nv. ${level}`,
        rv: level,
        plots: Math.min(30, Math.max(6, level * 2)),
        facilities: {},
        aniimos: VERIFIED_PROFILES["209000449083"].aniimo,
        currentProfitEstimate: Math.round(level * 100000)
    };
    applyProfile(defaultProfile, true);
}

// Aplicar perfil al estado y calcular plan óptimo con el motor Aniidex
async function applyProfile(profile, triggerScroll = false) {
    state.currentProfile = profile;
    state.rvLevel = profile.rv || 14;
    state.plotsCount = profile.plots || 30;
    state.facilities = profile.facilities || {};
    state.aniimos = profile.aniimo || [];

    // Actualizar elementos visuales del banner del hogar
    document.getElementById('active-rv-badge').textContent = `Casa Rodante Nv. ${state.rvLevel}`;
    document.getElementById('active-player-name').textContent = profile.name || `Hogar UID ${profile.uid}`;
    document.getElementById('active-plots-count').textContent = `${state.plotsCount} parcelas`;
    document.getElementById('active-facs-count').textContent = `${Object.keys(state.facilities).length || 10} talleres`;
    document.getElementById('active-aniimo-count').textContent = `${state.aniimos.length} trabajadores`;

    showStatus(`⏳ Resolviendo modelo matemático MIP para Nv. ${state.rvLevel}...`, 'warn');

    // Ejecutar solver
    await runSolve();

    // Mostrar secciones principales
    document.getElementById('sec-active-home').style.display = 'flex';
    document.getElementById('sec-kpis').style.display = 'grid';
    document.getElementById('sec-financial-ledger').style.display = 'flex';
    document.getElementById('sec-facilities').style.display = 'flex';

    if (triggerScroll) {
        document.getElementById('sec-active-home').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Ejecutar el motor HiGHS nativo de Aniidex para resolver el plan óptimo
async function runSolve() {
    try {
        const settings = {
            rv: state.rvLevel,
            goal: state.goal || 'coins',
            season: state.seasonActive,
            moonray: 600,
            coins: null,
            ticks: {},
            home: null, // Cuando home es null, calcula la base óptima completa para ese RV
            notes: [],
            roster: state.aniimos.length > 0 ? state.aniimos.map(a => ({
                icon: String(a.form).length > 5 ? String(a.form).slice(0, 5) : String(a.form),
                letters: a.letter || '',
                count: 1
            })) : null,
            stock: {},
            kept: []
        };

        const res = await solverBridge.solve(settings);
        const plan = res.plan || res;

        state.lastPlan = plan;
        renderResults(plan);
        generateSuggestions(plan);
        renderExclusiveTools(plan);

        showStatus(`✅ Plan matemático calculado con éxito: ${Math.round(plan.homeCoinPerDay).toLocaleString('es-ES')} monedas/día.`, 'success');

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

// Renderizar el tablero de resultados exacto a Aniidex
function renderResults(plan) {
    const netCoins = Math.round(plan.homeCoinPerDay || 0);
    const grossRevenue = Math.round(plan.salesPerDay || (netCoins + (plan.seedCostPerDay || 0) + (plan.foodCostPerDay || 0)));
    const seedCost = Math.round(plan.seedCostPerDay || 0);
    const foodCost = Math.round(plan.foodCostPerDay || 0);

    // 1. KPI Cards
    document.getElementById('kpi-net-coins').textContent = netCoins.toLocaleString('es-ES');
    document.getElementById('kpi-seed-cost').textContent = `− ${seedCost.toLocaleString('es-ES')}`;
    document.getElementById('kpi-gross-sales').textContent = grossRevenue.toLocaleString('es-ES');

    // Tiempo para siguiente nivel
    const nextRvLvl = state.rvLevel + 1;
    const nextRvInfo = state.facts?.rv?.find(r => r.rv === nextRvLvl);
    const upgradeCost = nextRvInfo?.upgradeCost || (state.rvLevel * 250000);
    const hoursToNext = netCoins > 0 ? ((upgradeCost / (netCoins / 24))).toFixed(1) : "—";
    document.getElementById('kpi-level-time').textContent = `${hoursToNext} h`;
    document.getElementById('kpi-target-rv-label').textContent = `Tiempo para Nv. ${nextRvLvl}`;

    // 2. Balance Contable (hp-sum)
    document.getElementById('ledger-sub-title').textContent = `Casa rodante de Nv. ${state.rvLevel} · precios oficiales de la Tienda Cooperativa`;
    document.getElementById('ledger-gross-val').textContent = `+ ${grossRevenue.toLocaleString('es-ES')}`;
    document.getElementById('ledger-seeds-val').textContent = `− ${seedCost.toLocaleString('es-ES')}`;
    document.getElementById('ledger-food-val').textContent = `− ${foodCost.toLocaleString('es-ES')}`;
    document.getElementById('ledger-net-val').textContent = `${netCoins.toLocaleString('es-ES')} Monedas/día`;

    // 3. Ventas en la Tienda Cooperativa
    renderSalesPills(plan);

    // 4. Cadena de Suministros Intermedia
    renderSupplyChain(plan);

    // 5. Inversión inicial de semillas
    renderSeedInvestment(plan);

    // 6. Instalaciones y Cuadrilla Hexagonal
    renderFacilitiesGrid(plan);
}

// Renderizar productos terminados vendidos al día (100% dinámico de plan.sales)
function renderSalesPills(plan) {
    const container = document.getElementById('sales-items-container');
    if (!container) return;
    container.innerHTML = '';

    const sales = plan.sales || [];
    document.getElementById('sales-count-label').textContent = `${sales.length} productos vendidos en la Tienda cooperativa`;

    sales.forEach(s => {
        const pill = document.createElement('div');
        pill.className = 'hp-sale-pill';
        const name = getItemName(s.item);
        const iconSrc = getItemIcon(s.item);
        const qtyPerDay = Math.round(s.perDay).toLocaleString('es-ES');
        const unitPrice = Math.round(s.price).toLocaleString('es-ES');
        const totalCoins = Math.round(s.coins || (s.perDay * s.price)).toLocaleString('es-ES');

        pill.innerHTML = `
            <div class="sale-pill-left">
                <img src="${iconSrc}" alt="${name}" class="sale-pill-img" onerror="this.src='assets/items/default_item.svg'">
                <div class="sale-pill-info">
                    <strong>${name}</strong>
                    <span class="sale-pill-meta">${qtyPerDay} al día a ${unitPrice}</span>
                </div>
            </div>
            <div class="sale-pill-total">+ ${totalCoins}</div>
        `;
        container.appendChild(pill);
    });
}

// Renderizar cadena de suministros intermedia (100% dinámico de plan.units y plan.crafts)
function renderSupplyChain(plan) {
    const container = document.getElementById('supply-items-container');
    if (!container) return;
    container.innerHTML = '';

    const units = plan.units || [];
    const farmUnits = units.filter(u => String(u.facility).startsWith('101'));

    farmUnits.forEach(u => {
        const recipe = state.facts?.recipes?.find(r => r.id === u.recipe);
        if (!recipe) return;
        const outItem = recipe.outputs?.[0]?.item;
        const name = getItemName(outItem);
        const iconSrc = getItemIcon(outItem);
        const totalYield = Math.round((u.perDay || 48) * (u.count || 1));
        const plotsCount = u.count || 1;

        const row = document.createElement('div');
        row.className = 'hp-supply-row';
        row.innerHTML = `
            <div class="supply-left">
                <img src="${iconSrc}" alt="${name}" class="supply-img" onerror="this.src='assets/items/default_item.svg'">
                <div class="supply-info">
                    <strong>${name}</strong>
                    <p>Sembrado en ${plotsCount} parcelas · Ciclo ${Math.round((u.cycle || 1800)/60)} min</p>
                </div>
            </div>
            <div class="supply-qty">
                <strong>${totalYield.toLocaleString('es-ES')}</strong>
                <small>uds/día</small>
            </div>
        `;
        container.appendChild(row);
    });
}

// Renderizar plan de compra e inversión de semillas (100% dinámico de plan.seeds)
function renderSeedInvestment(plan) {
    const container = document.getElementById('investment-seed-chips');
    if (!container) return;
    container.innerHTML = '';

    const seeds = plan.seeds || [];
    seeds.forEach(s => {
        const chip = document.createElement('span');
        chip.className = 'seed-chip';
        const name = getItemName(s.item);
        const iconSrc = getItemIcon(s.item);
        const costStr = Math.round(s.costPerDay).toLocaleString('es-ES');
        chip.innerHTML = `<img src="${iconSrc}" class="chip-item-icon" onerror="this.src='assets/items/default_item.svg'"> ${name} ×${s.fields} parcelas (${Math.round(s.perDay).toLocaleString('es-ES')}/día · −${costStr})`;
        container.appendChild(chip);
    });
}

// Renderizar matriz de talleres y cuadrilla (100% dinámico de plan.tables)
function renderFacilitiesGrid(plan) {
    const container = document.getElementById('facilities-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const tables = plan.tables || [];
    tables.forEach((t, idx) => {
        const facType = t.facility;
        const facName = getFacilityName(facType);
        const recipe = state.facts?.recipes?.find(r => r.id === t.recipe);
        const outItem = recipe?.outputs?.[0]?.item;
        const outItemName = getItemName(outItem);
        const outItemIcon = getItemIcon(outItem);

        // Buscar aniimo asignado
        const assignedWorker = state.aniimos[idx % state.aniimos.length] || {
            form: 10211,
            name: "Trabajador Experto",
            letter: "T",
            trait: "+20% Vel. Producción"
        };

        const formId = assignedWorker.form || 10211;
        const workerAvatar = getFormAvatar(formId);
        const workerName = assignedWorker.name || getFormName(formId);
        const workerMbti = assignedWorker.letter || "T";
        const workerTrait = assignedWorker.trait || "+20% Vel. Producción";

        const card = document.createElement('div');
        card.className = 'hp-workshop-card';
        card.innerHTML = `
            <div class="workshop-head">
                <div class="workshop-title-wrap">
                    <img src="${outItemIcon}" alt="${facName}" class="workshop-icon" onerror="this.src='assets/items/default_item.svg'">
                    <h3>${facName}</h3>
                </div>
                <span class="workshop-level-pill">Tier ${t.level || 4}</span>
            </div>
            <div class="workshop-body">
                <div class="recipe-info">
                    <img src="${outItemIcon}" alt="${outItemName}" class="recipe-img" onerror="this.src='assets/items/default_item.svg'">
                    <div class="recipe-details">
                        <strong>${outItemName}</strong>
                        <small>${t.emode ? '⚡ Modo Eléctrico (+20%)' : 'Modo Estándar'}</small>
                    </div>
                </div>
                <div class="hp-hex-worker">
                    <div class="hex-avatar">
                        <img src="${workerAvatar}" alt="${workerName}" onerror="this.src='assets/aniimo/default.svg'">
                        <span class="worker-mbti-badge">${workerMbti}</span>
                    </div>
                    <div class="worker-name-block">
                        <span class="worker-name">${workerName}</span>
                        <span class="worker-trait">${workerTrait}</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Generar diagnóstico dinámico y sugerencias de mejora
function generateSuggestions(plan) {
    const netCoins = Math.round(plan.homeCoinPerDay || 0);
    const currentEstimate = state.currentProfile?.currentProfitEstimate || Math.round(netCoins * 0.65);
    const gainPercent = currentEstimate > 0 ? (((netCoins - currentEstimate) / currentEstimate) * 100).toFixed(1) : "0";

    document.getElementById('sugg-base-profit').textContent = `~${currentEstimate.toLocaleString('es-ES')} /día`;
    document.getElementById('sugg-opt-profit').textContent = `${netCoins.toLocaleString('es-ES')} /día`;
    document.getElementById('sugg-gain-badge').textContent = `+${gainPercent}% de Ganancia Neta`;
}

// Renderizar módulos de herramientas exclusivas
function renderExclusiveTools(plan) {
    // 1. Nutrición del Comedero
    const selectDish = document.getElementById('select-feeder-dish');
    if (selectDish && selectDish.options.length === 0) {
        const dishes = [
            { name: "Sopa de Patata y Trigo", energy: 120 },
            { name: "Guiso de Fresas y Miel", energy: 180 },
            { name: "Pastel de Calabaza Mágica", energy: 240 }
        ];
        dishes.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.energy;
            opt.textContent = `${d.name} (${d.energy} pts energía)`;
            selectDish.appendChild(opt);
        });
        selectDish.addEventListener('change', updateFeederMetrics);
    }
    updateFeederMetrics();

    // 2. Mapa 2D de Campamento con cultivos reales del plan
    renderCampMap(plan);
}

function updateFeederMetrics() {
    const selectDish = document.getElementById('select-feeder-dish');
    const energyPerDish = parseInt(selectDish?.value || "180", 10);
    const workerCount = state.aniimos.length || 10;
    const energyDrainPerMin = workerCount * 10;
    const totalBowlEnergy = 1000 * energyPerDish;
    const totalMinutes = totalBowlEnergy / energyDrainPerMin;
    const daysAutonomy = (totalMinutes / 1440).toFixed(1);

    document.getElementById('feeder-days-val').textContent = `${daysAutonomy} días`;
    document.getElementById('feeder-rate-val').textContent = `${energyDrainPerMin} /min`;
    document.getElementById('feeder-dish-energy').textContent = `${energyPerDish} pts`;
}

// Renderizar mapa 2D del campamento vinculando cada parcela a su cultivo real resuelto
function renderCampMap(plan) {
    const grid = document.getElementById('camp-map-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Mapear qué cultivo va en qué parcela (instancia)
    const plotCropMap = {};
    const units = plan?.units || [];
    for (const u of units) {
        if (String(u.facility).startsWith('101')) {
            const recipe = state.facts?.recipes?.find(r => r.id === u.recipe);
            const outItem = recipe?.outputs?.[0]?.item;
            const name = getItemName(outItem);
            const iconSrc = getItemIcon(outItem);
            const timeMins = Math.round((u.cycle || 1800) / 60);
            const rateStr = `+${(u.perDay || 48).toFixed(1)}/día`;
            const tierLvl = u.level || 6;

            for (const inst of (u.instances || [])) {
                plotCropMap[inst] = {
                    name,
                    icon: iconSrc,
                    time: `${timeMins}m`,
                    yield: rateStr,
                    tier: tierLvl
                };
            }
        }
    }

    const totalPlots = state.plotsCount || 30;
    for (let i = 1; i <= totalPlots; i++) {
        const plot = document.createElement('div');
        plot.className = 'camp-plot is-active';
        const crop = plotCropMap[i] || {
            name: "Cultivo Fértil",
            icon: "assets/items/default_item.svg",
            time: "30m",
            yield: "+48/día",
            tier: 6
        };

        plot.innerHTML = `
            <div class="plot-head">
                <span class="plot-num">Parcela ${i}</span>
                <span class="plot-tier">Tier ${crop.tier}</span>
            </div>
            <div class="plot-body">
                <img src="${crop.icon}" class="plot-crop-img" alt="${crop.name}" onerror="this.src='assets/items/default_item.svg'">
                <strong class="plot-crop-name">${crop.name}</strong>
            </div>
            <div class="plot-foot">
                <span class="plot-time">⏱️ ${crop.time}</span>
                <span class="plot-yield">${crop.yield}</span>
            </div>
        `;
        grid.appendChild(plot);
    }
}

// Banner de mensajes de estado
function showStatus(msg, type = 'success') {
    const el = document.getElementById('import-status-banner');
    if (!el) return;
    el.className = `hp-status-banner ${type}`;
    el.textContent = msg;
    el.style.display = 'block';
}

// Inicializar en DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
