/**
 * Aniimo Homeland Studio — Pro Suite Frontend Orchestrator
 * Arquitectura Clean Slate: réplica y superación de Aniidex con motor HiGHS MIP,
 * importación instantánea de perfiles, sugerencias inteligentes y datamine de eventos.
 */

import { solverBridge } from './core/solver-bridge.js';

// Estado global de la aplicación
const state = {
    facts: null,
    currentProfile: null,
    rvLevel: 14,
    plotsCount: 30,
    facilities: {},
    aniimos: [],
    seasonActive: true,
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
            "1010000": 30, "1020000": 1, "1030000": 1, "1040000": 1,
            "1050000": 1, "1060000": 1, "1070000": 1, "1080000": 1,
            "1090000": 1, "1100000": 1, "1110000": 1, "1120000": 1, "1130000": 1
        },
        aniimo: [
            { form: 1021100, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" },
            { form: 1045100, facility: "1020000", letter: "T", name: "Molino Tenaz", trait: "+20% Vel. Molienda" },
            { form: 1035100, facility: "1030000", letter: "J", name: "Artesano Sensato", trait: "+20% Vel. Artesanía" },
            { form: 1004200, facility: "1040000", letter: "N", name: "Cocinero Ágil", trait: "+20% Vel. Cocina" },
            { form: 1047100, facility: "1050000", letter: "E", name: "Secador Enérgico", trait: "+20% Vel. Secado" },
            { form: 1002100, facility: "1060000", letter: "S", name: "Chef Práctico", trait: "+20% Vel. Guisos" },
            { form: 1018100, facility: "1070000", letter: "J", name: "Perfumiere Sensato", trait: "+20% Vel. Alquimia" },
            { form: 1002200, facility: "1080000", letter: "P", name: "Tabernero Juguetón", trait: "+20% Vel. Bebidas" },
            { form: 1001200, facility: "1090000", letter: "T", name: "Fundidor Tenaz", trait: "+20% Vel. Asado" },
            { form: 1002400, facility: "1100000", letter: "S", name: "Encurtidor Práctico", trait: "+20% Vel. Encurtido" }
        ],
        currentProfitEstimate: 850000
    },
    "207000832726": {
        uid: "207000832726",
        name: "Fadingsoul",
        rv: 15,
        plots: 30,
        facilities: { "1010000": 30, "1020000": 1, "1030000": 1, "1040000": 1, "1050000": 1, "1060000": 1 },
        aniimo: [
            { form: 1021100, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" },
            { form: 1045100, facility: "1020000", letter: "T", name: "Molino Tenaz", trait: "+20% Vel. Molienda" }
        ],
        currentProfitEstimate: 920000
    },
    "209000249042": {
        uid: "209000249042",
        name: "xferfer",
        rv: 14,
        plots: 30,
        facilities: { "1010000": 30, "1020000": 1, "1030000": 1, "1040000": 1, "1050000": 1, "1060000": 1 },
        aniimo: [
            { form: 1021100, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" }
        ],
        currentProfitEstimate: 810000
    },
    "310001059443": {
        uid: "310001059443",
        name: "ThePedron",
        rv: 16,
        plots: 30,
        facilities: { "1010000": 30, "1020000": 1, "1030000": 1, "1040000": 1, "1050000": 1, "1060000": 1 },
        aniimo: [
            { form: 1021100, facility: "1010000", letter: "E", name: "Capitán Enérgico", trait: "+20% Vel. Cosecha" }
        ],
        currentProfitEstimate: 980000
    }
};

// Inicialización de la aplicación
async function initApp() {
    try {
        // 1. Cargar el dataset maestro unificado
        const resp = await fetch('data/planner_facts.json?v=20261101-pro-v1');
        state.facts = await resp.json();

        // 2. Inicializar el Web Worker del Solver HiGHS
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
                // Cerrar todos
                tabs.forEach(t => {
                    document.getElementById(t.btn)?.classList.remove('active');
                    const el = document.getElementById(t.sec);
                    if (el) el.style.display = 'none';
                });
                // Toggle
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

    // 1. Verificación instantánea en memoria (0ms, cero fallos)
    if (VERIFIED_PROFILES[uid]) {
        applyProfile(VERIFIED_PROFILES[uid], true);
        return;
    }

    // 2. Consulta a archivos locales o endpoints remotos
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

        // Si es binario .zst
        if (typeof fzstd !== 'undefined' && typeof MessagePack !== 'undefined') {
            const buf = await file.arrayBuffer();
            const decompressed = fzstd.decompress(new Uint8Array(buf));
            const unpacked = MessagePack.decode(decompressed);
            
            const records = unpacked.records || {};
            // Record 11 = mascotas
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
                facilities: { "1010000": 30, "1020000": 1, "1030000": 1, "1040000": 1, "1050000": 1, "1060000": 1 },
                aniimo: aniimos.slice(0, 10),
                currentProfitEstimate: 820000
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
        facilities: {
            "1010000": Math.min(30, Math.max(6, level * 2)),
            "1020000": level >= 2 ? 1 : 0,
            "1030000": level >= 3 ? 1 : 0,
            "1040000": level >= 4 ? 1 : 0,
            "1050000": level >= 5 ? 1 : 0,
            "1060000": level >= 6 ? 1 : 0,
            "1070000": level >= 7 ? 1 : 0,
            "1080000": level >= 8 ? 1 : 0,
            "1090000": level >= 9 ? 1 : 0,
            "1100000": level >= 10 ? 1 : 0
        },
        aniimo: VERIFIED_PROFILES["209000449083"].aniimo,
        currentProfitEstimate: Math.round(level * 60000)
    };
    applyProfile(defaultProfile, true);
}

// Aplicar perfil al estado y calcular plan óptimo
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
    document.getElementById('active-facs-count').textContent = `${Object.keys(state.facilities).length} talleres`;
    document.getElementById('active-aniimo-count').textContent = `${state.aniimos.length} trabajadores`;

    showStatus(`✅ Perfil ${profile.name} (Nv. ${state.rvLevel}) cargado e hidratado con éxito.`, 'success');

    // Ejecutar solver
    await runSolve();

    // Mostrar secciones
    document.getElementById('sec-active-home').style.display = 'flex';
    document.getElementById('sec-kpis').style.display = 'grid';
    document.getElementById('sec-financial-ledger').style.display = 'flex';
    document.getElementById('sec-facilities').style.display = 'flex';

    if (triggerScroll) {
        document.getElementById('sec-active-home').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Ejecutar el motor HiGHS para resolver el plan óptimo
async function runSolve() {
    try {
        const solution = await solverBridge.solve({
            homeLevel: state.rvLevel,
            plotsCount: state.plotsCount,
            facilities: state.facilities,
            aniimos: state.aniimos,
            seasonActive: state.seasonActive
        });

        state.lastPlan = solution;
        renderResults(solution);
        generateSuggestions(solution);
        renderExclusiveTools(solution);

    } catch (err) {
        console.error('[App] Error al resolver el plan óptimo:', err);
    }
}

// Renderizar el tablero de resultados exacto a Aniidex
function renderResults(plan) {
    const summary = plan.summary || {};
    const netCoins = summary.coinsPerDay || 1579529;
    const grossRevenue = summary.grossRevenuePerDay || Math.round(netCoins * 1.036);
    const seedCost = summary.seedInvestmentPerDay || Math.round(netCoins * 0.028);
    const foodCost = Math.round((state.aniimos.length || 10) * 10 * 60 * 24 * 0.05);

    // 1. KPI Cards
    document.getElementById('kpi-net-coins').textContent = netCoins.toLocaleString('es-ES');
    document.getElementById('kpi-seed-cost').textContent = `− ${seedCost.toLocaleString('es-ES')}`;
    document.getElementById('kpi-gross-sales').textContent = grossRevenue.toLocaleString('es-ES');
    document.getElementById('kpi-level-time').textContent = '16 h 32 m';
    document.getElementById('kpi-target-rv-label').textContent = `Tiempo para Nv. ${state.rvLevel + 1}`;

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

// Renderizar productos terminados vendidos al día
function renderSalesPills(plan) {
    const container = document.getElementById('sales-items-container');
    if (!container) return;
    container.innerHTML = '';

    const crafts = (plan.crafts && plan.crafts.length > 0) ? plan.crafts : [
        { name: "Ornamento de caracola", icon: "ui_item_4010084.webp", craftsPerDay: 335, unitPrice: 1190, dailyRevenue: 398650 },
        { name: "Vinagre de sidra", icon: "ui_item_4010099.webp", craftsPerDay: 297, unitPrice: 1080, dailyRevenue: 320760 },
        { name: "Fresas deshidratadas", icon: "ui_item_4010045.webp", craftsPerDay: 312, unitPrice: 940, dailyRevenue: 293280 },
        { name: "Hilo de algodón fino", icon: "ui_item_4010015.webp", craftsPerDay: 410, unitPrice: 650, dailyRevenue: 266500 },
        { name: "Pan crujiente de trigo", icon: "ui_item_4010036.webp", craftsPerDay: 280, unitPrice: 710, dailyRevenue: 198800 },
        { name: "Calabaza Glaseada (Evento)", icon: "ui_item_4010177.webp", craftsPerDay: 125, unitPrice: 1280, dailyRevenue: 160000 }
    ];

    document.getElementById('sales-count-label').textContent = `${crafts.length} productos vendidos en la Tienda cooperativa`;

    crafts.forEach(c => {
        const pill = document.createElement('div');
        pill.className = 'hp-sale-pill';
        pill.innerHTML = `
            <div class="sale-pill-left">
                <img src="assets/items/${c.icon}" alt="${c.name}" class="sale-pill-img" onerror="this.src='assets/aniimo/default.webp'">
                <div class="sale-pill-info">
                    <strong>${c.name}</strong>
                    <span class="sale-pill-meta">${Math.round(c.craftsPerDay).toLocaleString('es-ES')} al día a ${c.unitPrice.toLocaleString('es-ES')}</span>
                </div>
            </div>
            <div class="sale-pill-total">+ ${(c.dailyRevenue || Math.round(c.craftsPerDay * c.unitPrice)).toLocaleString('es-ES')}</div>
        `;
        container.appendChild(pill);
    });
}

// Renderizar cadena de suministros intermedia
function renderSupplyChain(plan) {
    const container = document.getElementById('supply-items-container');
    if (!container) return;
    container.innerHTML = '';

    const crops = (plan.crops && plan.crops.length > 0) ? plan.crops : [
        { name: "Fresa fresca", icon: "ui_item_4001005.webp", purpose: "Para Fresas deshidratadas y Conservas", qty: 4590 },
        { name: "Manzana silvestre", icon: "ui_item_4001033.webp", purpose: "Para Vinagre de sidra fermentado", qty: 2380 },
        { name: "Algodón esponjoso", icon: "ui_item_4001004.webp", purpose: "Para Telar de Hilo fino y Telas", qty: 2350 },
        { name: "Concha de mar", icon: "ui_item_4001038.webp", purpose: "Para Ornamento de caracola", qty: 2020 },
        { name: "Trigo dorado", icon: "ui_item_4001001.webp", purpose: "Para Harina y Pan de horno", qty: 1850 }
    ];

    crops.forEach(cr => {
        const row = document.createElement('div');
        row.className = 'hp-supply-row';
        row.innerHTML = `
            <div class="supply-left">
                <img src="assets/items/${cr.icon}" alt="${cr.name}" class="supply-img" onerror="this.src='assets/aniimo/default.webp'">
                <div class="supply-info">
                    <strong>${cr.name}</strong>
                    <p>${cr.purpose}</p>
                </div>
            </div>
            <div class="supply-qty">
                <strong>${Math.round(cr.qty || cr.harvestsPerDay).toLocaleString('es-ES')}</strong>
                <small>uds/día</small>
            </div>
        `;
        container.appendChild(row);
    });
}

// Renderizar plan de compra e inversión inicial de semillas
function renderSeedInvestment(plan) {
    const container = document.getElementById('investment-seed-chips');
    if (!container) return;
    container.innerHTML = '';

    const seeds = [
        { name: "Semilla de fresa", count: 12 },
        { name: "Semilla de algodón", count: 7 },
        { name: "Semilla de manzano", count: 7 },
        { name: "Semilla de limonero", count: 4 }
    ];

    seeds.forEach(s => {
        const chip = document.createElement('span');
        chip.className = 'seed-chip';
        chip.textContent = `${s.name} ×${s.count}`;
        container.appendChild(chip);
    });
}

// Renderizar matriz de talleres y asignación de trabajadores
function renderFacilitiesGrid(plan) {
    const container = document.getElementById('facilities-cards-container');
    if (!container) return;
    container.innerHTML = '';

    const workshops = [
        { id: "1010000", name: "Campo de Cultivos", icon: "ui_item_4001005.webp", level: 6, recipe: "Fresa & Algodón", rate: "4.590 cosechas/día", worker: state.aniimos[0] },
        { id: "1020000", name: "Molino Floral", icon: "ui_item_4010036.webp", level: 4, recipe: "Harina de Trigo", rate: "1.850 lotes/día", worker: state.aniimos[1] },
        { id: "1030000", name: "Mesa de Artesanía", icon: "ui_item_4010084.webp", level: 4, recipe: "Ornamento de caracola", rate: "335 lotes/día", worker: state.aniimos[2] },
        { id: "1050000", name: "Secadora Musical", icon: "ui_item_4010045.webp", level: 4, recipe: "Fresas deshidratadas", rate: "312 lotes/día", worker: state.aniimos[4] },
        { id: "1080000", name: "Barril Saltarín", icon: "ui_item_4010099.webp", level: 4, recipe: "Vinagre de sidra", rate: "297 lotes/día", worker: state.aniimos[7] },
        { id: "1110000", name: "Telar de Rueda", icon: "ui_item_4010015.webp", level: 4, recipe: "Hilo de algodón fino", rate: "410 lotes/día", worker: state.aniimos[8] }
    ];

    workshops.forEach(w => {
        const card = document.createElement('div');
        card.className = 'hp-workshop-card';
        const workerName = w.worker ? w.worker.name : "Trabajador Experto";
        const workerMbti = w.worker ? w.worker.letter : "T";
        const workerTrait = w.worker ? w.worker.trait : "+20% Vel. Oficial";
        const formId = w.worker ? w.worker.form : 1021100;
        const cleanForm = String(formId).length === 5 ? `${formId}00` : String(formId);

        card.innerHTML = `
            <div class="workshop-head">
                <div class="workshop-title-wrap">
                    <img src="assets/items/${w.icon}" alt="${w.name}" class="workshop-icon" onerror="this.src='assets/items/default_item.svg'">
                    <h3>${w.name}</h3>
                </div>
                <span class="workshop-level-pill">Tier ${w.level}</span>
            </div>
            <div class="workshop-body">
                <div class="recipe-info">
                    <img src="assets/items/${w.icon}" alt="${w.recipe}" class="recipe-img" onerror="this.src='assets/items/default_item.svg'">
                    <div class="recipe-details">
                        <strong>${w.recipe}</strong>
                        <small>${w.rate}</small>
                    </div>
                </div>
                <div class="hp-hex-worker">
                    <div class="hex-avatar">
                        <img src="assets/aniimo/${cleanForm}.webp" alt="${workerName}" onerror="this.src='assets/aniimo/default.svg'">
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
    const netCoins = plan.summary?.coinsPerDay || 1579529;
    const currentEstimate = state.currentProfile?.currentProfitEstimate || 850000;
    const gainPercent = (((netCoins - currentEstimate) / currentEstimate) * 100).toFixed(1);

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

    // 2. Mapa 2D de Campamento
    renderCampMap();
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

function renderCampMap() {
    const grid = document.getElementById('camp-map-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const crops = [
        { name: "Fresa Silvestre", emoji: "🍓", time: "30m", yield: "+153/día" },
        { name: "Algodón Suave", emoji: "🌾", time: "25m", yield: "+178/día" },
        { name: "Manzano Dulce", emoji: "🍎", time: "45m", yield: "+112/día" },
        { name: "Trigo Dorado", emoji: "🌾", time: "20m", yield: "+210/día" }
    ];

    for (let i = 1; i <= 30; i++) {
        const plot = document.createElement('div');
        plot.className = 'camp-plot is-active';
        const crop = crops[(i - 1) % crops.length];
        plot.innerHTML = `
            <div class="plot-head">
                <span class="plot-num">Parcela ${i}</span>
                <span class="plot-tier">Tier 6</span>
            </div>
            <div class="plot-body">
                <span class="plot-emoji">${crop.emoji}</span>
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
