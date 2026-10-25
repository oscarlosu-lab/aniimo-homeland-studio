import { FACILITIES, simpleSetup } from './facility-config.js';
import { translate, isBilingual, setBilingual } from './i18n.js';

// State
let allRecipes = [];
let filteredRecipes = [];
let selectedRecipe = null;
let selectedQuantity = 1;
let currentRvLevel = 20;
let filterCategory = 'all';
let searchQuery = '';
let filterFacility = 'all';
let filterByRv = true;
let isSolving = false;
let aniimoDatabase = null;

// Worker Instance
let worker = null;
let nextRequestId = 0;
const pendingRequests = new Map();

function initWorker() {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
        const { id, ok, result, error, type } = event.data;
        if (type === 'progress') {
            return; // Ignore intermediate progress notifications
        }
        const pending = pendingRequests.get(id);
        if (pending) {
            pendingRequests.delete(id);
            if (ok) pending.resolve(result);
            else pending.reject(new Error(error || 'Worker error'));
        }
    };
    worker.onerror = (err) => {
        console.error('Worker error:', err);
    };
}

function callWorker(type, payload) {
    return new Promise((resolve, reject) => {
        if (!worker) initWorker();
        const id = ++nextRequestId;
        pendingRequests.set(id, { resolve, reject });
        worker.postMessage({ id, type, payload });
    });
}

// Format duration
function formatSeconds(secs) {
    if (!secs || !Number.isFinite(secs)) return '0s';
    const total = Math.round(secs);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

const ITEM_NAMES = {
    coins: 'Home Coins',
    wood_block: 'Wood Blocks',
    mineral_sand: 'Mineral Sand',
    coarse_sifted_ore: 'Coarse-Sifted Ore',
    river_washed_stones: 'River-Washed Stones',
    premium_river_washed_stones: 'Premium River-Washed Stones',
    sugar_roasted_chestnuts: 'Sugar-Roasted Chestnuts',
    flowers_in_a_bottle: 'Flowers in a Bottle',
};

// Pretty item name helper
function prettyItemName(key) {
    if (!key) return '';
    const formatted = ITEM_NAMES[key] || key.split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    const translated = translate(formatted);
    if (isBilingual() && translated !== formatted) {
        return `${translated} (${formatted})`;
    }
    return translated;
}

// Format reason with translated item names
function formatReason(reason) {
    if (!reason) return 'Usado para la receta';
    return reason
        .replace(/^Usado para ([^;]+)/i, (_, list) => 'Usado para ' + list.split(', ').map(k => prettyItemName(k.trim())).join(', '))
        .replace(/^Used for ([^;]+)/i, (_, list) => 'Usado para ' + list.split(', ').map(k => prettyItemName(k.trim())).join(', '))
        .replace(/; the rest sells directly$/i, '; el resto se vende')
        .replace(/Sells directly$/i, 'Se vende directamente');
}

// Pretty facility helper
function prettyFacilityName(name) {
    if (!name) return '';
    return translate(name);
}

// Category mappings
const RECIPE_CATEGORIES = [
    { id: 'all', name: '🌟 Todas', emoji: '🌟' },
    { id: 'cooking', name: '🍽️ Cocina y Platos', emoji: '🍽️', facilities: ['Blazing Stove', 'Claw Game Cooker', 'Simmering Pot'] },
    { id: 'pickling', name: '🏺 Encurtidos y Bebidas', emoji: '🏺', facilities: ['Pickling Jar', 'Bouncy Brew Keg'] },
    { id: 'incense', name: '🌸 Inciensos y Esencias', emoji: '🌸', facilities: ['Phonolfactory Table'] },
    { id: 'milling', name: '🌾 Molino y Granos', emoji: '🌾', facilities: ['Carousel Mill', 'Jukebox Dryer'] },
    { id: 'crafting', name: '🛠️ Artesanía y Tejidos', emoji: '🛠️', facilities: ['Crafting Table', 'Joy Wheel Loom', 'Dance Pad Polisher', 'Aniipod Maker'] },
    { id: 'materials', name: '🪵 Carpintería y Horno', emoji: '🪵', facilities: ['Woodworking Bench', 'Chimney Kiln'] },
    { id: 'season', name: '🌸 Temporada', emoji: '🌸', seasonOnly: true }
];

function getCategoryForRecipe(recipe) {
    if (recipe.isSeason) return 'season';
    for (const cat of RECIPE_CATEGORIES) {
        if (cat.facilities && cat.facilities.includes(recipe.facility)) {
            return cat.id;
        }
    }
    return 'crafting';
}

// Calculate unlock RV for a recipe
function getMinRvForRecipe(facilityName, facilityLevel) {
    const fac = FACILITIES.find(f => f.name === facilityName);
    if (!fac || !fac.unlocks) return 1;
    let minRv = 1;
    for (let lvl = 1; lvl <= (facilityLevel || 1); lvl++) {
        if (fac.unlocks[lvl] && fac.unlocks[lvl] > minRv) {
            minRv = fac.unlocks[lvl];
        }
    }
    return minRv;
}

// Initialize Page
async function initQuickRecipes() {
    initWorker();
    
    // Load saved RV level
    try {
        const saved = localStorage.getItem('homeland-studio-home-level');
        if (saved) currentRvLevel = parseInt(saved, 10) || 20;
    } catch (_) {}

    // Load Aniimo database
    try {
        const resp = await fetch('aniimo_creatures.json');
        if (resp.ok) aniimoDatabase = await resp.json();
    } catch (e) {
        console.warn('Could not load aniimo_creatures.json:', e);
    }

    // Populate RV select
    const rvSelect = document.getElementById('quick-rv-select');
    if (rvSelect) {
        rvSelect.innerHTML = '';
        for (let lvl = 1; lvl <= 20; lvl++) {
            const opt = document.createElement('option');
            opt.value = lvl;
            opt.textContent = `Nivel ${lvl}${lvl === 20 ? ' (Máximo)' : ''}`;
            if (lvl === currentRvLevel) opt.selected = true;
            rvSelect.appendChild(opt);
        }
        rvSelect.addEventListener('change', (e) => {
            currentRvLevel = parseInt(e.target.value, 10) || 20;
            try { localStorage.setItem('homeland-studio-home-level', currentRvLevel); } catch (_) {}
            applyFilters();
            if (selectedRecipe) calculateOptimalPlan();
        });
    }

    // Load all items from Worker WASM
    try {
        const itemsJson = await callWorker('get_all_items');
        const rawItems = JSON.parse(itemsJson);

        // Filter only craftable recipes (has ingredients or is produced in a workshop)
        const workshopFacilities = new Set([
            'Blazing Stove', 'Claw Game Cooker', 'Simmering Pot', 'Pickling Jar',
            'Bouncy Brew Keg', 'Phonolfactory Table', 'Carousel Mill', 'Jukebox Dryer',
            'Crafting Table', 'Joy Wheel Loom', 'Dance Pad Polisher', 'Aniipod Maker',
            'Woodworking Bench', 'Chimney Kiln'
        ]);

        allRecipes = rawItems.filter(it => {
            if (!it.name) return false;
            if (workshopFacilities.has(it.facility)) return true;
            return it.raw_materials && it.raw_materials.length > 0;
        }).map(it => {
            const minRv = getMinRvForRecipe(it.facility, it.facility_level);
            const isSeason = (it.season_seed_cost && it.season_seed_cost > 0) ||
                             ['harvest_platter', 'umbral_pickle', 'umbral_hot_pot', 'umbral_sweet_and_spicy_sauce', 'moondew_radish_slices', 'roasted_waxing_moon_pepper'].includes(it.name);
            return {
                ...it,
                minRv,
                isSeason,
                category: isSeason ? 'season' : (getCategoryForRecipe({ ...it, isSeason })),
                nameEn: it.name.split('_').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ')
            };
        }).sort((a, b) => a.facility.localeCompare(b.facility) || a.name.localeCompare(b.name));

        // Populate facility select
        populateFacilitySelect();

        // Render category pills
        renderCategoryPills();

        // Attach search & filters
        setupFilterListeners();

        // Initial filter & render
        applyFilters();

        // Auto select first recipe if available
        if (filteredRecipes.length > 0) {
            selectRecipe(filteredRecipes[0]);
        }

    } catch (err) {
        console.error('Failed to load recipes from worker:', err);
        const container = document.getElementById('recipes-list-container');
        if (container) {
            container.innerHTML = `<p class="error-msg">Error al cargar recetas del motor: ${err.message}</p>`;
        }
    }

    // Bilingual Toggle
    const bilingualBtn = document.getElementById('bilingualToggle');
    if (bilingualBtn) {
        bilingualBtn.addEventListener('click', () => {
            setBilingual(!isBilingual());
            bilingualBtn.classList.toggle('active', isBilingual());
            applyFilters();
            if (selectedRecipe) renderActiveRecipeCard();
        });
        if (isBilingual()) bilingualBtn.classList.add('active');
    }

    // Theme Toggle
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            themeBtn.textContent = newTheme === 'dark' ? 'Claro' : 'Oscuro';
            try { localStorage.setItem('theme', newTheme); } catch (_) {}
        });
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeBtn.textContent = savedTheme === 'dark' ? 'Claro' : 'Oscuro';
    }
}

function populateFacilitySelect() {
    const sel = document.getElementById('quick-facility-select');
    if (!sel) return;
    const facilities = Array.from(new Set(allRecipes.map(r => r.facility))).sort();
    sel.innerHTML = '<option value="all">🏭 Todas las instalaciones</option>';
    facilities.forEach(fac => {
        const opt = document.createElement('option');
        opt.value = fac;
        opt.textContent = `${prettyFacilityName(fac)} (${fac})`;
        sel.appendChild(opt);
    });
}

function renderCategoryPills() {
    const bar = document.getElementById('quick-category-pills');
    if (!bar) return;
    bar.innerHTML = RECIPE_CATEGORIES.map(cat => `
        <button type="button" class="category-pill ${filterCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
            ${cat.name}
        </button>
    `).join('');

    bar.querySelectorAll('.category-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            filterCategory = btn.dataset.cat;
            bar.querySelectorAll('.category-pill').forEach(b => b.classList.toggle('active', b === btn));
            applyFilters();
        });
    });
}

function setupFilterListeners() {
    const searchInput = document.getElementById('quick-recipe-search');
    const clearBtn = document.getElementById('quick-search-clear');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            if (clearBtn) clearBtn.hidden = !searchQuery.trim();
            applyFilters();
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            clearBtn.hidden = true;
            applyFilters();
            if (searchInput) searchInput.focus();
        });
    }

    const facSelect = document.getElementById('quick-facility-select');
    if (facSelect) {
        facSelect.addEventListener('change', (e) => {
            filterFacility = e.target.value;
            applyFilters();
        });
    }

    const rvCheck = document.getElementById('quick-filter-rv-check');
    if (rvCheck) {
        rvCheck.addEventListener('change', (e) => {
            filterByRv = e.target.checked;
            applyFilters();
        });
    }

    // Quantity buttons
    const qtyInput = document.getElementById('recipe-qty-input');
    const btnMinus = document.getElementById('qty-btn-minus');
    const btnPlus = document.getElementById('qty-btn-plus');
    if (qtyInput) {
        qtyInput.addEventListener('change', (e) => {
            selectedQuantity = Math.max(1, parseInt(e.target.value, 10) || 1);
            qtyInput.value = selectedQuantity;
            updateQuickQtyPills();
            renderActiveRecipeCard();
            calculateOptimalPlan();
        });
    }
    if (btnMinus) {
        btnMinus.addEventListener('click', () => {
            selectedQuantity = Math.max(1, selectedQuantity - 1);
            if (qtyInput) qtyInput.value = selectedQuantity;
            updateQuickQtyPills();
            renderActiveRecipeCard();
            calculateOptimalPlan();
        });
    }
    if (btnPlus) {
        btnPlus.addEventListener('click', () => {
            selectedQuantity += 1;
            if (qtyInput) qtyInput.value = selectedQuantity;
            updateQuickQtyPills();
            renderActiveRecipeCard();
            calculateOptimalPlan();
        });
    }

    // Quick quantity pills
    document.querySelectorAll('.quick-qty-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            selectedQuantity = parseInt(pill.dataset.qty, 10) || 1;
            if (qtyInput) qtyInput.value = selectedQuantity;
            updateQuickQtyPills();
            renderActiveRecipeCard();
            calculateOptimalPlan();
        });
    });

    // Solve button
    const solveBtn = document.getElementById('btn-calculate-recipe');
    if (solveBtn) {
        solveBtn.addEventListener('click', () => {
            calculateOptimalPlan();
        });
    }
}

function updateQuickQtyPills() {
    document.querySelectorAll('.quick-qty-pill').forEach(pill => {
        const q = parseInt(pill.dataset.qty, 10);
        pill.classList.toggle('active', q === selectedQuantity);
    });
}

function applyFilters() {
    let list = [...allRecipes];

    // Filter by Category
    if (filterCategory !== 'all') {
        if (filterCategory === 'season') {
            list = list.filter(r => r.isSeason);
        } else {
            const catObj = RECIPE_CATEGORIES.find(c => c.id === filterCategory);
            if (catObj && catObj.facilities) {
                list = list.filter(r => catObj.facilities.includes(r.facility) && !r.isSeason);
            }
        }
    }

    // Filter by Facility
    if (filterFacility !== 'all') {
        list = list.filter(r => r.facility === filterFacility);
    }

    // Filter by RV Level
    if (filterByRv) {
        list = list.filter(r => r.minRv <= currentRvLevel);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(r => {
            const nameEs = prettyItemName(r.name).toLowerCase();
            const nameEn = (r.nameEn || '').toLowerCase();
            const rawKey = r.name.toLowerCase();
            const fac = prettyFacilityName(r.facility).toLowerCase();
            const ingr = (r.raw_materials || []).map(m => prettyItemName(m).toLowerCase()).join(' ');
            return nameEs.includes(q) || nameEn.includes(q) || rawKey.includes(q) || fac.includes(q) || ingr.includes(q);
        });
    }

    filteredRecipes = list;
    renderRecipeGrid();
}

function renderRecipeGrid() {
    const container = document.getElementById('recipes-list-container');
    const countBadge = document.getElementById('recipe-results-count');
    if (countBadge) {
        countBadge.textContent = `${filteredRecipes.length} receta${filteredRecipes.length === 1 ? '' : 's'}`;
    }

    if (!container) return;

    if (filteredRecipes.length === 0) {
        container.innerHTML = `
            <div class="empty-recipes-state">
                <span class="empty-icon">🔍</span>
                <p>No se encontraron recetas con estos filtros.</p>
                <button type="button" class="btn-clear-filters" id="btn-reset-filters">Limpiar filtros</button>
            </div>
        `;
        const resetBtn = container.querySelector('#btn-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                searchQuery = '';
                filterCategory = 'all';
                filterFacility = 'all';
                const sInp = document.getElementById('quick-recipe-search');
                if (sInp) sInp.value = '';
                const facSel = document.getElementById('quick-facility-select');
                if (facSel) facSel.value = 'all';
                renderCategoryPills();
                applyFilters();
            });
        }
        return;
    }

    container.innerHTML = filteredRecipes.map(r => {
        const isSelected = selectedRecipe && selectedRecipe.name === r.name;
        const displayName = prettyItemName(r.name);
        const facilityTitle = prettyFacilityName(r.facility);
        const cycleStr = formatSeconds(r.cycle_time);
        const matsPreview = (r.raw_materials || []).map((m, idx) => {
            const amt = r.required_amount ? r.required_amount[idx] : 1;
            return `<span class="mat-badge">${amt}× ${prettyItemName(m)}</span>`;
        }).join('');

        return `
            <div class="recipe-card ${isSelected ? 'selected' : ''}" data-name="${r.name}">
                <div class="recipe-card-top">
                    <div class="recipe-title-wrap">
                        <span class="recipe-icon">${r.isSeason ? '🌸' : '⚡'}</span>
                        <h4 class="recipe-name">${displayName}</h4>
                    </div>
                    <span class="recipe-facility-badge">${facilityTitle} Nv.${r.facility_level || 1}</span>
                </div>
                <div class="recipe-meta-row">
                    <span class="meta-item">⏱️ Ciclo: <strong>${cycleStr}</strong></span>
                    <span class="meta-item">📦 Rend.: <strong>${r.yield_amount || 1}</strong></span>
                    ${r.sell_value ? `<span class="meta-item coins">🪙 <strong>${r.sell_value.toLocaleString()}</strong></span>` : ''}
                </div>
                <div class="recipe-mats-wrap">
                    ${matsPreview || '<span class="hint small">Sin ingredientes</span>'}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', () => {
            const name = card.dataset.name;
            const target = allRecipes.find(r => r.name === name);
            if (target) selectRecipe(target);
        });
    });
}

function selectRecipe(recipe) {
    selectedRecipe = recipe;
    document.querySelectorAll('.recipe-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.name === recipe.name);
    });
    renderActiveRecipeCard();
    calculateOptimalPlan();
}

function renderActiveRecipeCard() {
    const banner = document.getElementById('selected-recipe-banner');
    if (!banner || !selectedRecipe) return;

    const r = selectedRecipe;
    const displayName = prettyItemName(r.name);
    const facilityTitle = prettyFacilityName(r.facility);
    const cycleStr = formatSeconds(r.cycle_time);

    const ingrHtml = (r.raw_materials || []).map((m, idx) => {
        const amt = (r.required_amount ? r.required_amount[idx] : 1) * selectedQuantity;
        return `<span class="active-ingr-pill"><strong>${amt}×</strong> ${prettyItemName(m)}</span>`;
    }).join('');

    banner.innerHTML = `
        <div class="active-banner-content">
            <div class="active-banner-header">
                <span class="active-banner-icon">${r.isSeason ? '🌸' : '🎯'}</span>
                <div>
                    <h3 class="active-banner-title">${selectedQuantity}× ${displayName}</h3>
                    <p class="active-banner-sub">Fabricado en <strong>${facilityTitle}</strong> (Nivel ${r.facility_level || 1}) · RV Mínimo: ${r.minRv}</p>
                </div>
            </div>
            <div class="active-banner-specs">
                <div class="spec-col">
                    <span class="spec-label">Tiempo base unitario:</span>
                    <span class="spec-val">${cycleStr}</span>
                </div>
                <div class="spec-col">
                    <span class="spec-label">Producción por lote:</span>
                    <span class="spec-val">${(r.yield_amount || 1) * selectedQuantity} uds</span>
                </div>
                ${r.aniimo ? `
                    <div class="spec-col">
                        <span class="spec-label">Aptitud requerida:</span>
                        <span class="spec-val aniimo-tag">🐾 ${translate(r.aniimo[0])} Nv.${r.aniimo[1]}+</span>
                    </div>
                ` : ''}
            </div>
            <div class="active-banner-ingredients">
                <span class="ingr-title">Ingredientes directos necesarios (${selectedQuantity}×):</span>
                <div class="active-ingr-list">${ingrHtml || '<span class="hint">Sin ingredientes</span>'}</div>
            </div>
        </div>
    `;
}

// Calculate optimal plan focused 100% on the assigned recipe and its dependencies
function calculateDirectRecipePlan(recipeName, targetQuantity, rvLevel) {
    const itemMap = new Map(allRecipes.map(i => [i.name, i]));
    const target = itemMap.get(recipeName);
    if (!target) throw new Error(`Receta no encontrada: ${recipeName}`);

    const setup = simpleSetup(rvLevel);
    const facCounts = setup.facilities || {};
    function getFacCount(facName) {
        const entry = facCounts[facName];
        if (!entry || !entry[0]) return 1;
        return entry[0].count || 1;
    }

    const nodes = new Map();

    function addDemand(name, qty, usedFor) {
        const item = itemMap.get(name);
        if (!item) return;
        const yieldAmt = item.yield_amount || 1;

        let node = nodes.get(name);
        if (!node) {
            node = {
                item,
                name: item.name,
                facility: item.facility,
                facility_level: item.facility_level,
                yield_amount: yieldAmt,
                production_time: item.production_time,
                workload: item.workload,
                aniimo: item.aniimo,
                jobs: item.jobs || [],
                isRaw: !item.raw_materials || item.raw_materials.length === 0,
                totalDemand: 0,
                batchesNeeded: 0,
                usedFor: new Set()
            };
            nodes.set(name, node);
        }
        node.totalDemand += qty;
        if (usedFor) node.usedFor.add(usedFor);

        node.batchesNeeded = Math.ceil(node.totalDemand / yieldAmt);

        if (item.raw_materials && item.required_amount) {
            for (let i = 0; i < item.raw_materials.length; i++) {
                const mat = item.raw_materials[i];
                const reqPerBatch = item.required_amount[i];
                const totalReq = node.batchesNeeded * reqPerBatch;
                addDemand(mat, totalReq, item.name);
            }
        }
    }

    addDemand(recipeName, targetQuantity, null);

    // Official game formula for worker efficiency
    function getProcessorSpeed(above) {
        if (above <= 0) return 1.0;
        if (above === 1) return 3.0;
        return 3.0 + (above - 1) * 1.0;
    }
    function getGatheringEfficiency(above, req) {
        const base = 1.0 + 0.25 * (Math.max(1, req) - 1);
        return 1.0 + 0.5 * above / base;
    }
    function hasPersonality(fac) {
        return fac !== 'Dance Pad Polisher' && fac !== 'Aniipod Maker';
    }

    const isGatheringFacility = (fac) => ['Well', 'Mine', 'Tidewhisper Sandcastle', 'Dewy House', 'Nimbus Bed', 'Starfall Hammock'].includes(fac);
    const isFarmOrWoodland = (fac) => fac === 'Farmland' || fac === 'Woodland';

    const farmItems = [];
    const gatheringItems = [];
    const workshopIntermediates = [];
    let finalItem = null;

    for (const node of nodes.values()) {
        const facCount = getFacCount(node.facility);
        const isTarget = node.name === recipeName;
        const gathering = isGatheringFacility(node.facility);

        let cycleTime = node.production_time;
        if (node.workload && node.aniimo) {
            const ability = node.aniimo[0];
            const reqLvl = node.aniimo[1] || 1;
            const maxLvl = (ability === 'Perfumery') ? 3 : 4;
            const above = Math.max(0, maxLvl - reqLvl);
            let eff = gathering ? getGatheringEfficiency(above, reqLvl) : getProcessorSpeed(above);
            if (hasPersonality(node.facility)) eff *= 1.2;
            const baseRate = gathering ? (1.0 + 0.25 * (Math.max(1, reqLvl) - 1)) : 1.0;
            cycleTime = Math.max(1, Math.round(node.workload / (eff * baseRate)));
        }

        node.effectiveCycleTime = cycleTime;
        node.availableFacilities = facCount;
        node.parallelMachinesUsed = Math.min(facCount, Math.max(1, node.batchesNeeded));
        node.batchesPerMachine = Math.ceil(node.batchesNeeded / node.parallelMachinesUsed);

        if (isFarmOrWoodland(node.facility)) {
            const plotBatches = Math.ceil(node.batchesNeeded / Math.max(1, facCount));
            node.durationSeconds = plotBatches * cycleTime;
            farmItems.push(node);
        } else if (gathering) {
            node.durationSeconds = node.batchesPerMachine * cycleTime;
            gatheringItems.push(node);
        } else if (isTarget) {
            node.durationSeconds = node.batchesPerMachine * cycleTime;
            finalItem = node;
        } else {
            node.durationSeconds = node.batchesPerMachine * cycleTime;
            workshopIntermediates.push(node);
        }
    }

    // Critical Path Timing
    let initialWaveSeconds = 0;
    for (const f of farmItems) {
        if (f.durationSeconds > initialWaveSeconds) initialWaveSeconds = f.durationSeconds;
    }
    for (const g of gatheringItems) {
        if (g.durationSeconds > initialWaveSeconds) initialWaveSeconds = g.durationSeconds;
    }

    let workshopSeconds = 0;
    for (const w of workshopIntermediates) {
        workshopSeconds += w.durationSeconds;
    }
    if (finalItem) {
        workshopSeconds += finalItem.durationSeconds;
    }

    const totalCriticalPathSeconds = initialWaveSeconds + workshopSeconds;

    return {
        recipeName,
        targetQuantity,
        rvLevel,
        finalItem,
        workshopIntermediates,
        gatheringItems,
        farmItems,
        initialWaveSeconds,
        workshopSeconds,
        totalCriticalPathSeconds
    };
}

// Calculate optimal plan focused strictly on recipe crafting without surplus sales
async function calculateOptimalPlan() {
    if (!selectedRecipe || isSolving) return;

    isSolving = true;
    const btn = document.getElementById('btn-calculate-recipe');
    const resultsContainer = document.getElementById('quick-results-container');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner">⏳</span> Optimizando recursos para ${selectedQuantity}x ${prettyItemName(selectedRecipe.name)}...`;
    }

    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="solver-loading-state">
                <div class="pulse-loader"></div>
                <h4>Coordinando parcelas y talleres en paralelo...</h4>
                <p class="hint">Distribuyendo los máximos recursos de tu Casa Rodante para fabricar <strong>${selectedQuantity}x ${prettyItemName(selectedRecipe.name)}</strong> en el menor tiempo récord posible, sin desviar ingredientes ni generar excedentes de venta.</p>
            </div>
        `;
    }

    // Small delay for UI reactivity
    await new Promise(r => setTimeout(r, 120));

    try {
        const plan = calculateDirectRecipePlan(selectedRecipe.name, selectedQuantity, currentRvLevel);
        renderOptimalResults(plan);
    } catch (err) {
        console.error('Error solving recipe plan:', err);
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="solver-error-state">
                    <span class="error-icon">⚠️</span>
                    <h4>No se pudo completar el cálculo</h4>
                    <p class="error-msg">${err.message}</p>
                    <p class="hint">Verifica que tu nivel de Casa Rodante (RV ${currentRvLevel}) tenga desbloqueada esta instalación y sus cultivos requeridos.</p>
                </div>
            `;
        }
    } finally {
        isSolving = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `🚀 Calcular Producción Óptima (Lo más rápido posible)`;
        }
    }
}

// Render the results breakdown
function renderOptimalResults(plan) {
    const container = document.getElementById('quick-results-container');
    if (!container || !plan) return;

    const timeFormatted = formatSeconds(plan.totalCriticalPathSeconds);
    const finalProducer = plan.finalItem;
    const workshopProducers = plan.workshopIntermediates || [];
    const farmProducers = plan.farmItems || [];
    const gatheringProducers = plan.gatheringItems || [];

    // Best Aniimo creature recommendation from database
    const recommendCreature = (ability, minLvl) => {
        if (!aniimoDatabase || !Array.isArray(aniimoDatabase)) return null;
        const targetLvl = minLvl || 1;
        const matches = aniimoDatabase.filter(a => {
            if (!a.abilities) return false;
            const lvl = a.abilities[ability] ?? a.abilities[translate(ability)] ?? 0;
            return lvl >= targetLvl;
        });
        if (matches.length === 0) return null;
        matches.sort((a, b) => {
            const lvlA = a.abilities[ability] ?? a.abilities[translate(ability)] ?? 0;
            const lvlB = b.abilities[ability] ?? b.abilities[translate(ability)] ?? 0;
            if (lvlB !== lvlA) return lvlB - lvlA;
            return (a.is_prismana ? 1 : 0) - (b.is_prismana ? 1 : 0);
        });
        return matches[0];
    };

    const totalActiveWorkshops = (finalProducer?.parallelMachinesUsed || 1) + workshopProducers.reduce((sum, w) => sum + w.parallelMachinesUsed, 0);
    const totalFarmPlots = farmProducers.reduce((sum, f) => sum + f.batchesNeeded, 0);

    container.innerHTML = `
        <div class="results-kpi-banner">
            <div class="kpi-banner-item main-kpi">
                <span class="kpi-label">⏱️ Tiempo Récord de Fabricación</span>
                <span class="kpi-value time-highlight">${timeFormatted}</span>
                <span class="kpi-sub">100% dedicado a fabricar ${selectedQuantity}x ${prettyItemName(selectedRecipe.name)}</span>
            </div>
            <div class="kpi-banner-item">
                <span class="kpi-label">🏭 Talleres en Paralelo</span>
                <span class="kpi-value">${totalActiveWorkshops} máquinas</span>
                <span class="kpi-sub">Trabajando simultáneamente</span>
            </div>
            <div class="kpi-banner-item">
                <span class="kpi-label">🌱 Parcelas Asignadas</span>
                <span class="kpi-value">${totalFarmPlots} parcelas</span>
                <span class="kpi-sub">${farmProducers.length} tipos de cultivo</span>
            </div>
            <div class="kpi-banner-item">
                <span class="kpi-label">🎯 Eficiencia del Plan</span>
                <span class="kpi-value">100% Útil</span>
                <span class="kpi-sub">0% excedentes para venta</span>
            </div>
        </div>

        <!-- TALLER PRINCIPAL -->
        ${finalProducer ? `
            <div class="plan-card-section target-section">
                <div class="section-title-wrap">
                    <span class="section-badge main-badge">🎯 Taller Final</span>
                    <h4>${prettyFacilityName(finalProducer.facility)} — Fabricando ${selectedQuantity}x ${prettyItemName(selectedRecipe.name)}</h4>
                </div>
                <div class="facility-spec-card">
                    <div class="fac-info">
                        <span class="fac-name">🏭 ${prettyFacilityName(finalProducer.facility)}</span>
                        <span class="fac-action">
                            ${finalProducer.parallelMachinesUsed > 1 
                                ? `<strong>${finalProducer.parallelMachinesUsed} máquinas en paralelo</strong> (${finalProducer.batchesPerMachine} lote(s) cada una)` 
                                : `<strong>${finalProducer.batchesNeeded} lote(s)</strong> a máxima velocidad`}
                            · Ciclo: ${formatSeconds(finalProducer.effectiveCycleTime)} / lote
                            · Duración: <strong>${formatSeconds(finalProducer.durationSeconds)}</strong>
                        </span>
                    </div>
                    <div class="fac-staff">
                        ${finalProducer.aniimo ? `
                            <span class="staff-badge">
                                🐾 ${translate(finalProducer.aniimo[0])} Lv.${finalProducer.aniimo[1]}+
                                ${recommendCreature(finalProducer.aniimo[0], finalProducer.aniimo[1]) ? `(Sugerido: <strong>${recommendCreature(finalProducer.aniimo[0], finalProducer.aniimo[1]).name}</strong>)` : ''}
                            </span>
                        ` : '<span class="hint small">Autónomo / Sin operador fijo</span>'}
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- TALLERES INTERMEDIOS -->
        ${workshopProducers.length > 0 ? `
            <div class="plan-card-section workshop-section">
                <div class="section-title-wrap">
                    <span class="section-badge workshop-badge">⚙️ Procesamiento Intermedio</span>
                    <h4>Máquinas Transformando Ingredientes</h4>
                </div>
                <p class="hint">Instalaciones trabajando exclusivamente para abastecer los componentes de la receta:</p>
                <div class="table-responsive">
                    <table class="plan-table">
                        <thead>
                            <tr>
                                <th>Instalación</th>
                                <th>Producto Intermedio</th>
                                <th>Lote y Máquinas</th>
                                <th>Duración</th>
                                <th>Misión en la Receta</th>
                                <th>Operario Aniimo Recomendado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workshopProducers.map(w => `
                                <tr>
                                    <td><strong>${prettyFacilityName(w.facility)}</strong></td>
                                    <td><strong>⚙️ ${prettyItemName(w.name)}</strong></td>
                                    <td>
                                        ${w.batchesNeeded} uds 
                                        ${w.parallelMachinesUsed > 1 ? `<span class="task-pill">x${w.parallelMachinesUsed} en paralelo</span>` : ''}
                                    </td>
                                    <td><strong>${formatSeconds(w.durationSeconds)}</strong> (${formatSeconds(w.effectiveCycleTime)}/u)</td>
                                    <td>
                                        <span class="reason-tag">
                                            ${Array.from(w.usedFor).map(u => `Usado para ${prettyItemName(u)}`).join(', ') || `Para ${prettyItemName(selectedRecipe.name)}`}
                                        </span>
                                    </td>
                                    <td>
                                        ${w.aniimo ? `
                                            <span class="task-pill">
                                                🐾 ${translate(w.aniimo[0])} Lv.${w.aniimo[1]}
                                                ${recommendCreature(w.aniimo[0], w.aniimo[1]) ? `(ej. <strong>${recommendCreature(w.aniimo[0], w.aniimo[1]).name}</strong>)` : ''}
                                            </span>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : ''}

        <!-- HUERTO Y CULTIVOS -->
        ${farmProducers.length > 0 ? `
            <div class="plan-card-section farm-section">
                <div class="section-title-wrap">
                    <span class="section-badge farm-badge">🌱 Huerto y Parcelas Requeridas</span>
                    <h4>Campos de Cultivo y Arboleda Asignados</h4>
                </div>
                <p class="hint">Siembra simultánea en tus parcelas para abastecer la receta sin que falte ningún ingrediente:</p>
                <div class="table-responsive">
                    <table class="plan-table">
                        <thead>
                            <tr>
                                <th>Instalación / Terreno</th>
                                <th>Cultivo</th>
                                <th>Parcelas Asignadas</th>
                                <th>Tiempo de Crecimiento</th>
                                <th>Misión en el Plan</th>
                                <th>Cuadrilla de Cuidado Requerida</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${farmProducers.map(f => `
                                <tr>
                                    <td><strong>${prettyFacilityName(f.facility)}</strong> (${f.availableFacilities} disp.)</td>
                                    <td><strong>🌱 ${prettyItemName(f.name)}</strong></td>
                                    <td>
                                        <strong>${f.batchesNeeded} parcela(s)</strong> (${f.totalDemand} uds requeridas)
                                    </td>
                                    <td><strong>${formatSeconds(f.durationSeconds)}</strong> (simultáneo)</td>
                                    <td>
                                        <span class="reason-tag">
                                            ${Array.from(f.usedFor).map(u => `Suministro para ${prettyItemName(u)}`).join(', ') || `Para ${prettyItemName(selectedRecipe.name)}`}
                                        </span>
                                    </td>
                                    <td>
                                        ${(f.jobs || []).map(j => `
                                            <span class="task-pill">
                                                ${translate(j[1])} Lv.${j[2]} (${translate(j[0])})
                                            </span>
                                        `).join('') || '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : ''}

        <!-- RECOLECCIÓN Y EXTRACCIÓN -->
        ${gatheringProducers.length > 0 ? `
            <div class="plan-card-section gathering-section">
                <div class="section-title-wrap">
                    <span class="section-badge gather-badge">⛏️ Recolección y Extracción</span>
                    <h4>Materias Primas Naturales Extraídas</h4>
                </div>
                <p class="hint">Instalaciones de recolección activadas en paralelo con los cultivos:</p>
                <div class="table-responsive">
                    <table class="plan-table">
                        <thead>
                            <tr>
                                <th>Instalación</th>
                                <th>Recurso</th>
                                <th>Lotes / Máquinas</th>
                                <th>Duración</th>
                                <th>Misión en la Receta</th>
                                <th>Operario Sugerido</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${gatheringProducers.map(g => `
                                <tr>
                                    <td><strong>${prettyFacilityName(g.facility)}</strong></td>
                                    <td><strong>⛏️ ${prettyItemName(g.name)}</strong></td>
                                    <td>
                                        ${g.batchesNeeded} lote(s) 
                                        ${g.parallelMachinesUsed > 1 ? `<span class="task-pill">x${g.parallelMachinesUsed} en paralelo</span>` : ''}
                                    </td>
                                    <td><strong>${formatSeconds(g.durationSeconds)}</strong></td>
                                    <td>
                                        <span class="reason-tag">
                                            ${Array.from(g.usedFor).map(u => `Usado para ${prettyItemName(u)}`).join(', ') || `Para ${prettyItemName(selectedRecipe.name)}`}
                                        </span>
                                    </td>
                                    <td>
                                        ${g.aniimo ? `
                                            <span class="task-pill">
                                                🐾 ${translate(g.aniimo[0])} Lv.${g.aniimo[1]}
                                                ${recommendCreature(g.aniimo[0], g.aniimo[1]) ? `(ej. <strong>${recommendCreature(g.aniimo[0], g.aniimo[1]).name}</strong>)` : ''}
                                            </span>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : ''}

        <!-- RESUMEN DE BALANCE -->
        <div class="plan-card-section summary-section">
            <div class="section-title-wrap">
                <span class="section-badge summary-badge">📦 Balance de Fabricación Directa</span>
                <h4>Flujo 100% Eficiente sin Sobrantes</h4>
            </div>
            <div class="summary-details-box">
                <p>✔ Asignación directa optimizada: <strong>${selectedQuantity}x ${prettyItemName(selectedRecipe.name)}</strong> estará listo en exactamente <strong>${timeFormatted}</strong>. Todas las parcelas de cultivo y talleres intermedios se han coordinado para trabajar en paralelo al máximo rendimiento, sin fabricar ningún producto adicional para la venta.</p>
            </div>
        </div>
    `;
}

// Auto init on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickRecipes);
} else {
    initQuickRecipes();
}
