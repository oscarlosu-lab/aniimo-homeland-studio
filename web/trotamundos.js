/**
 * Aniimo Homeland Studio - Módulo Táctico Trotamundos (Pathfinder Counter Builder)
 * Algoritmo de optimización de escuadrón basado en el datamine oficial y matriz de debilidades elementales.
 */

// Matriz elemental oficial de Aniimo
export const ELEMENT_CHART = {
    'Fuego': { strong: ['Hierba', 'Hielo'], weak: ['Agua', 'Roca'], emoji: '🔥', color: '#f97316' },
    'Agua': { strong: ['Fuego', 'Roca'], weak: ['Hierba', 'Eléctrico'], emoji: '💧', color: '#06b6d4' },
    'Hierba': { strong: ['Roca', 'Agua'], weak: ['Fuego', 'Hielo', 'Oscuridad'], emoji: '🌿', color: '#10b981' },
    'Eléctrico': { strong: ['Agua', 'Viento'], weak: ['Oscuridad'], emoji: '⚡', color: '#eab308' },
    'Hielo': { strong: ['Viento', 'Hierba'], weak: ['Roca', 'Fuego'], emoji: '❄️', color: '#38bdf8' },
    'Roca': { strong: ['Fuego', 'Hielo'], weak: ['Hierba', 'Viento'], emoji: '🪨', color: '#a8a29e' },
    'Viento': { strong: ['Roca', 'Eléctrico'], weak: ['Sagrado', 'Hielo'], emoji: '🌪️', color: '#2dd4bf' },
    'Sagrado': { strong: ['Viento', 'Oscuridad'], weak: ['Oscuridad'], emoji: '☀️', color: '#fbbf24' },
    'Oscuridad': { strong: ['Hierba', 'Eléctrico', 'Sagrado'], weak: ['Sagrado'], emoji: '🌑', color: '#a855f7' }
};

// Aliases para normalizar elementos
export function normalizeElement(elem) {
    if (!elem) return 'Universal';
    const clean = elem.trim();
    if (clean.includes('Luz') || clean.includes('Sagrado')) return 'Sagrado';
    if (clean.includes('Tierra') || clean.includes('Roca')) return 'Roca';
    if (clean.includes('Fuego')) return 'Fuego';
    if (clean.includes('Agua')) return 'Agua';
    if (clean.includes('Hierba')) return 'Hierba';
    if (clean.includes('Eléctrico') || clean.includes('Electrico')) return 'Eléctrico';
    if (clean.includes('Hielo')) return 'Hielo';
    if (clean.includes('Viento')) return 'Viento';
    if (clean.includes('Oscuridad')) return 'Oscuridad';
    return clean;
}

// Cálculo del multiplicador de daño atacante -> defensor
export function calculateMultiplier(attackerElem, defenderElements) {
    const normAttacker = normalizeElement(attackerElem);
    const chart = ELEMENT_CHART[normAttacker];
    if (!chart || !defenderElements || defenderElements.length === 0) return 1.0;

    let mult = 1.0;
    for (const defRaw of defenderElements) {
        const def = normalizeElement(defRaw);
        if (chart.strong.includes(def)) {
            mult *= 1.6;
        } else if (chart.weak.includes(def)) {
            mult *= 0.625;
        }
    }
    return Math.round(mult * 100) / 100;
}

// Obtener debilidades y fortalezas de una criatura
export function getCreatureAffinities(elements) {
    const weaknesses = [];
    const resistances = [];

    const allElements = Object.keys(ELEMENT_CHART);
    for (const el of allElements) {
        const m = calculateMultiplier(el, elements);
        if (m >= 1.5) {
            weaknesses.push({ element: el, multiplier: m, isDouble: m >= 2.5 });
        } else if (m <= 0.65) {
            resistances.push({ element: el, multiplier: m });
        }
    }
    weaknesses.sort((a, b) => b.multiplier - a.multiplier);
    return { weaknesses, resistances };
}

// Estado del simulador
let allCreatures = [];
let selectedRivals = [null, null, null, null];
let activeSlotIndex = 0;
let modalFilterElement = 'all';
let modalSearchQuery = '';

// Presets famosos
const PRESETS = {
    lita: {
        name: 'Instructora Lita (Arena Astra - Lv. 65)',
        desc: 'El mayor reto del juego. Rotación rápida de Glacy (Healer), Sherro (DPS móvil), Stellaria y Glynsera.',
        names: ['Sherro (Forma prismana)', 'Glacy (Forma prismana)', 'Stellarys (Forma prismana)', 'Glynsera (Forma prismana)']
    },
    hurricane: {
        name: 'Trío Huracán (Viento & Rayo Aéreo)',
        desc: 'Enemigos voladores con daño de choque continuo a distancia.',
        names: ['Hypnyto (Forma prismana)', 'Cornet (Forma prismana)', 'Tromber', 'Chirpi']
    },
    magma: {
        name: 'Dúo Volcánico (Fuego & Roca Magma)',
        desc: 'Jefes con armaduras de piedra que sufren daño x2.56 ante ataques de Agua.',
        names: ['Scorchhowl (Forma de sierra)', 'Lavazar', 'Infergon', 'Squashel']
    },
    shadow_frost: {
        name: 'Legión de Sombras & Escarcha',
        desc: 'Combinación oscura y de congelación. Vulnerable a ráfagas de Fuego y Luz.',
        names: ['Stellarys (Forma prismana)', 'Fenrier (Forma de noche)', 'Malevsera', 'Glynsera']
    }
};

// Carga inicial
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        initTheme();
        initBilingual();
        await loadCreaturesData();
        setupEventListeners();

        // Cargar por defecto el preset de Lita
        applyPreset('lita');
    });
}

// Inicializar Tema Claro/Oscuro
function initTheme() {
    const toggleBtn = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (toggleBtn) {
        toggleBtn.textContent = savedTheme === 'dark' ? 'Claro' : 'Oscuro';
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            toggleBtn.textContent = next === 'dark' ? 'Claro' : 'Oscuro';
            try { localStorage.setItem('theme', next); } catch (_) {}
        });
    }
}

// Bilingüe básico
let isBilingual = false;
function initBilingual() {
    const btn = document.getElementById('bilingualToggle');
    if (!btn) return;
    try {
        isBilingual = localStorage.getItem('homeland_bilingual') === 'true';
        btn.classList.toggle('active', isBilingual);
    } catch (_) {}

    btn.addEventListener('click', () => {
        isBilingual = !isBilingual;
        try { localStorage.setItem('homeland_bilingual', isBilingual); } catch (_) {}
        btn.classList.toggle('active', isBilingual);
        renderRivalSlots();
        calculateOptimalCounters();
    });
}

// Cargar catálogo de criaturas
async function loadCreaturesData() {
    try {
        const res = await fetch('aniimo_creatures.json');
        if (!res.ok) throw new Error('Error al cargar base de datos');
        allCreatures = await res.json();
        console.log(`[Trotamundos] ${allCreatures.length} criaturas cargadas desde el datamine.`);
    } catch (err) {
        console.error('Error cargando aniimo_creatures.json:', err);
    }
}

// Configuración de listeners
function setupEventListeners() {
    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.currentTarget.getAttribute('data-preset');
            if (key === 'clear') {
                selectedRivals = [null, null, null, null];
                renderRivalSlots();
                clearResults();
            } else if (PRESETS[key]) {
                applyPreset(key);
            }
        });
    });

    // Botón de cálculo
    const calcBtn = document.getElementById('btn-calculate-counters');
    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            calculateOptimalCounters();
        });
    }

    // Modal de selección
    const modalClose = document.getElementById('close-creature-modal');
    const modalOverlay = document.getElementById('creature-picker-modal');
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Filtros del modal
    const searchInput = document.getElementById('modal-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            modalSearchQuery = e.target.value.toLowerCase().trim();
            renderModalCreatures();
        });
    }

    document.querySelectorAll('.modal-elem-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('.modal-elem-pill').forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            modalFilterElement = e.currentTarget.getAttribute('data-elem');
            renderModalCreatures();
        });
    });
}

// Aplicar un preset predefinido
function applyPreset(key) {
    const p = PRESETS[key];
    if (!p || allCreatures.length === 0) return;

    selectedRivals = p.names.map(name => {
        return allCreatures.find(c => c.name === name || c.base_name === name) || null;
    });

    renderRivalSlots();
    calculateOptimalCounters();
}

// Renderizar las 4 ranuras de rivales
function renderRivalSlots() {
    for (let i = 0; i < 4; i++) {
        const slotEl = document.getElementById(`rival-slot-${i}`);
        if (!slotEl) continue;

        const creature = selectedRivals[i];
        if (!creature) {
            slotEl.innerHTML = `
                <div class="slot-empty" onclick="window.openPickerForSlot(${i})">
                    <div class="slot-plus-icon">+</div>
                    <span class="slot-empty-text">Elegir Rival ${i + 1}</span>
                </div>
            `;
            continue;
        }

        const aff = getCreatureAffinities(creature.elements || [creature.element]);
        const weaknessBadges = aff.weaknesses.map(w => {
            const chart = ELEMENT_CHART[w.element] || {};
            const isDouble = w.isDouble;
            return `
                <span class="weakness-tag ${isDouble ? 'double-weak' : ''}" title="${isDouble ? 'Doble Debilidad x2.56' : 'Debilidad x1.6'}">
                    ${chart.emoji || ''} ${w.element} <strong>${w.multiplier}x</strong>
                </span>
            `;
        }).join('');

        const elementBadges = (creature.elements || [creature.element]).map(el => {
            const chart = ELEMENT_CHART[normalizeElement(el)] || {};
            return `<span class="elem-badge" style="background: ${chart.color || '#475569'};">${chart.emoji || ''} ${el}</span>`;
        }).join('');

        const imgSrc = creature.icon || creature.icon_url || 'assets/aniimo/default.webp';

        slotEl.innerHTML = `
            <div class="slot-filled">
                <button type="button" class="btn-slot-remove" onclick="window.removeRivalSlot(${i})" title="Quitar rival">✕</button>
                <div class="slot-avatar-wrap" onclick="window.openPickerForSlot(${i})">
                    <img class="slot-avatar" src="${imgSrc}" onerror="this.onerror=null; this.src='${creature.icon_url || ''}';" alt="${creature.name}">
                    ${creature.is_prismana ? '<span class="prismana-star" title="Forma Prismana">✨</span>' : ''}
                </div>
                <div class="slot-meta" onclick="window.openPickerForSlot(${i})">
                    <h4 class="slot-name">${creature.name}</h4>
                    <span class="slot-role">${creature.role || 'DPS'} · ID #${creature.dex || creature.id}</span>
                    <div class="slot-elements">${elementBadges}</div>
                </div>
                <div class="slot-weaknesses">
                    <span class="weakness-title">Vulnerabilidades:</span>
                    <div class="weakness-list">${weaknessBadges || '<span class="neutral-tag">Sin debilidades extremas</span>'}</div>
                </div>
            </div>
        `;
    }
}

// Abrir selector modal para una ranura
if (typeof window !== 'undefined') {
    window.openPickerForSlot = function(index) {
        activeSlotIndex = index;
        const modal = document.getElementById('creature-picker-modal');
        if (modal) {
            modal.classList.add('show');
            renderModalCreatures();
            const searchInput = document.getElementById('modal-search-input');
            if (searchInput) {
                searchInput.value = '';
                modalSearchQuery = '';
                searchInput.focus();
            }
        }
    };

    window.removeRivalSlot = function(index) {
        selectedRivals[index] = null;
        renderRivalSlots();
        calculateOptimalCounters();
    };

    window.selectCreatureForSlot = function(name) {
        const found = allCreatures.find(c => c.name === name);
        if (found) {
            selectedRivals[activeSlotIndex] = found;
            closeModal();
            renderRivalSlots();
            calculateOptimalCounters();
        }
    };
}

function closeModal() {
    const modal = document.getElementById('creature-picker-modal');
    if (modal) modal.classList.remove('show');
}

// Renderizar criaturas en el modal
function renderModalCreatures() {
    const container = document.getElementById('modal-creatures-grid');
    if (!container) return;

    const filtered = allCreatures.filter(c => {
        if (modalFilterElement !== 'all') {
            const elems = (c.elements || [c.element]).map(normalizeElement);
            if (!elems.includes(modalFilterElement)) return false;
        }
        if (modalSearchQuery) {
            const nameMatch = c.name.toLowerCase().includes(modalSearchQuery);
            const baseMatch = (c.base_name || '').toLowerCase().includes(modalSearchQuery);
            const elemMatch = (c.elements || [c.element]).some(e => e.toLowerCase().includes(modalSearchQuery));
            if (!nameMatch && !baseMatch && !elemMatch) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-modal-search">No se encontraron criaturas con los filtros seleccionados.</div>';
        return;
    }

    container.innerHTML = filtered.map(c => {
        const imgSrc = c.icon || c.icon_url || 'assets/aniimo/default.webp';
        const elemBadges = (c.elements || [c.element]).map(el => {
            const chart = ELEMENT_CHART[normalizeElement(el)] || {};
            return `<span class="mini-elem-badge" style="background: ${chart.color || '#475569'};">${chart.emoji || ''}</span>`;
        }).join('');

        return `
            <div class="modal-creature-card" onclick="window.selectCreatureForSlot('${c.name.replace(/'/g, "\\'")}')">
                <img src="${imgSrc}" onerror="this.onerror=null; this.src='${c.icon_url || ''}';" alt="${c.name}">
                <div class="modal-c-info">
                    <span class="modal-c-name">${c.name}</span>
                    <div class="modal-c-elems">${elemBadges} <span class="modal-c-role">${c.role || ''}</span></div>
                </div>
            </div>
        `;
    }).join('');
}



// Limpiar resultados
function clearResults() {
    const container = document.getElementById('trotamundos-results');
    if (container) {
        container.innerHTML = `
            <div class="empty-results-hint">
                <span class="empty-results-icon">🎯</span>
                <p>Selecciona al menos un rival para calcular la cuadrilla de counters y la estrategia.</p>
            </div>
        `;
    }
}

// =========================================================================
// MOTOR DE OPTIMIZACIÓN DE COUNTERS (Zero-Trust & Basado en Datamine)
// =========================================================================
export function calculateOptimalCounters() {
    const validRivals = selectedRivals.filter(Boolean);
    const container = document.getElementById('trotamundos-results');
    if (!container) return;

    if (validRivals.length === 0) {
        clearResults();
        return;
    }

    // 1. Analizar debilidades de todos los rivales
    const rivalAnalyses = validRivals.map((rival, idx) => {
        const aff = getCreatureAffinities(rival.elements || [rival.element]);
        return {
            index: idx + 1,
            rival,
            weaknesses: aff.weaknesses,
            resistances: aff.resistances
        };
    });

    // 2. Puntuar todo el catálogo de criaturas según efectividad y stats
    // Criterios de puntuación: Multiplicador (x2.56 = 100pts, x1.6 = 50pts), ATQ (hasta 130 pts), Quiebre, Pasiva
    const candidates = allCreatures.map(creature => {
        const stats = creature.stats || {};
        const atq = stats.ATQ || 0;
        const quiebre = stats.QUIEBRE || 0;
        const cElems = creature.elements || [creature.element];

        let totalAdvantageScore = 0;
        let coverageCount = 0;
        const matchupDetails = [];

        validRivals.forEach(r => {
            const rElems = r.elements || [r.element];
            let bestMult = 1.0;
            let bestAttackerElem = cElems[0];

            for (const cElem of cElems) {
                const m = calculateMultiplier(cElem, rElems);
                if (m > bestMult) {
                    bestMult = m;
                    bestAttackerElem = cElem;
                }
            }

            if (bestMult >= 1.5) {
                coverageCount++;
                totalAdvantageScore += (bestMult >= 2.5 ? 120 : 60);
            } else if (bestMult <= 0.65) {
                totalAdvantageScore -= 30; // Penalización por desventaja
            }

            matchupDetails.push({
                rivalName: r.name,
                multiplier: bestMult,
                attackerElem: bestAttackerElem
            });
        });

        // Bono por pasivas ultra-meta
        let passiveBonus = 0;
        const traitStr = (creature.traits || []).join(' ').toLowerCase();
        if (traitStr.includes('electrorreserva')) passiveBonus += 25; // Fulmintis PE battery
        if (traitStr.includes('gran hechicería')) passiveBonus += 20; // Stellarys execute
        if (traitStr.includes('racimo floral')) passiveBonus += 20;   // Irisalis clones
        if (traitStr.includes('furia desatada')) passiveBonus += 20;  // Grizbo break stun
        if (traitStr.includes('llamas abrasadoras')) passiveBonus += 15; // Scorchhowl +25%

        const finalScore = totalAdvantageScore + (atq * 0.8) + (quiebre * 0.4) + passiveBonus;

        return {
            creature,
            score: finalScore,
            coverageCount,
            matchupDetails,
            atq,
            quiebre
        };
    });

    // Ordenar candidatos por puntuación
    candidates.sort((a, b) => b.score - a.score);

    // 3. Selección greedy de los 4 titulares con máxima cobertura sin solapamientos redundantes
    const selectedStarters = [];
    const coveredRivalNames = new Set();

    // Priorizar cubrir cada rival con su counter más devastador
    for (const r of validRivals) {
        if (selectedStarters.length >= 4) break;
        // Buscar el mejor candidato que tenga x2.56 o x1.6 contra este rival y que aún no esté en el equipo
        const bestForRival = candidates.find(c => {
            if (selectedStarters.some(s => s.creature.base_name === c.creature.base_name)) return false;
            const match = c.matchupDetails.find(m => m.rivalName === r.name);
            return match && match.multiplier >= 1.5;
        });

        if (bestForRival) {
            selectedStarters.push(bestForRival);
            coveredRivalNames.add(r.name);
        }
    }

    // Si aún quedan huecos para llegar a 4, rellenar con los mejores hiper-carries globales
    for (const c of candidates) {
        if (selectedStarters.length >= 4) break;
        if (!selectedStarters.some(s => s.creature.base_name === c.creature.base_name)) {
            selectedStarters.push(c);
        }
    }

    // 4. Seleccionar 4 suplentes de reserva (distintos a los titulares)
    const selectedReserves = [];
    for (const c of candidates) {
        if (selectedReserves.length >= 4) break;
        const alreadyInStarters = selectedStarters.some(s => s.creature.base_name === c.creature.base_name);
        const alreadyInReserves = selectedReserves.some(s => s.creature.base_name === c.creature.base_name);
        if (!alreadyInStarters && !alreadyInReserves) {
            selectedReserves.push(c);
        }
    }

    // 5. Determinar orden de eliminación prioritario (Kill Order)
    // Reglas: Healers/Support primero -> DPS burst -> Tanques
    const killOrder = [...validRivals].sort((a, b) => {
        const roleScore = (r) => {
            const role = (r.role || '').toLowerCase();
            if (role.includes('curación') || role.includes('healer') || role.includes('apoyo')) return 10;
            if (role.includes('dps')) return 5;
            return 1;
        };
        return roleScore(b) - roleScore(a);
    });

    // Renderizar resultados en pantalla
    renderResults(selectedStarters, selectedReserves, killOrder, validRivals);
}

// Renderizar el informe táctico completo
function renderResults(starters, reserves, killOrder, validRivals) {
    const container = document.getElementById('trotamundos-results');
    if (!container) return;

    container.innerHTML = `
        <!-- SECCIÓN 1: FORMACIÓN TITULAR (LOS 4 COUNTERS) -->
        <div class="tactical-card-section starters-section">
            <div class="tactical-section-head">
                <span class="tactical-badge badge-primary">🏆 Formación Titular Recomendada</span>
                <h3>Escuadrón Asignado para la Victoria</h3>
                <p class="section-desc">Seleccionados por cobertura de ventaja elemental, techo de ataque base (hasta 130 ATQ) y autosuficiencia de energía (PE).</p>
            </div>

            <div class="starters-grid">
                ${starters.map((s, idx) => {
                    const c = s.creature;
                    const stats = c.stats || {};
                    const imgSrc = c.icon || c.icon_url || 'assets/aniimo/default.webp';
                    const elemBadges = (c.elements || [c.element]).map(el => {
                        const chart = ELEMENT_CHART[normalizeElement(el)] || {};
                        return `<span class="elem-badge" style="background: ${chart.color || '#475569'};">${chart.emoji || ''} ${el}</span>`;
                    }).join('');

                    // Misión asignada: ver a quién contrarresta
                    const strongAgainst = s.matchupDetails.filter(m => m.multiplier >= 1.5);
                    const missionHtml = strongAgainst.length > 0 ? `
                        <div class="starter-mission">
                            <span class="mission-label">🎯 Misión Asignada:</span>
                            <div class="mission-targets">
                                ${strongAgainst.map(m => `
                                    <span class="target-tag ${m.multiplier >= 2.5 ? 'double-adv' : ''}">
                                        Vencer a <strong>${m.rivalName}</strong> (${m.multiplier}x daño)
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<div class="starter-mission"><span class="mission-neutral">Hipercarry de daño neutro y ruptura</span></div>';

                    return `
                        <div class="starter-card">
                            <div class="starter-card-top">
                                <span class="starter-pos">#${idx + 1}</span>
                                <div class="starter-img-wrap">
                                    <img src="${imgSrc}" onerror="this.onerror=null; this.src='${c.icon_url || ''}';" alt="${c.name}">
                                    ${c.is_prismana ? '<span class="prismana-star">✨</span>' : ''}
                                </div>
                                <div class="starter-info">
                                    <h4>${c.name}</h4>
                                    <div class="starter-elems">${elemBadges}</div>
                                    <span class="starter-role">${c.role || 'DPS'}</span>
                                </div>
                            </div>

                            <div class="starter-stats-row">
                                <div class="stat-pill"><span class="stat-k">ATQ</span> <span class="stat-v ${stats.ATQ >= 125 ? 'top-stat' : ''}">${stats.ATQ || 0}</span></div>
                                <div class="stat-pill"><span class="stat-k">QUIEBRE</span> <span class="stat-v">${stats.QUIEBRE || 0}</span></div>
                                <div class="stat-pill"><span class="stat-k">PS</span> <span class="stat-v">${stats.PS || 0}</span></div>
                                <div class="stat-pill"><span class="stat-k">REGEN</span> <span class="stat-v">${stats.REGEN || 0}</span></div>
                            </div>

                            <div class="starter-trait">
                                <strong>Rasgo:</strong> ${(c.traits && c.traits[0]) ? c.traits[0].split(':')[0] : 'Combate Estándar'}
                            </div>

                            ${missionHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- SECCIÓN 2: ORDEN PRIORITARIO DE ELIMINACIÓN (KILL ORDER) -->
        <div class="tactical-card-section kill-order-section">
            <div class="tactical-section-head">
                <span class="tactical-badge badge-warning">⚡ Orden de Eliminación Táctico</span>
                <h3>¿A quién debes abatir primero?</h3>
                <p class="section-desc">Secuencia óptima de foco para evitar que el rival se cure o active mecánicas de contraataque.</p>
            </div>

            <div class="kill-order-row">
                ${killOrder.map((r, i) => {
                    const role = (r.role || '').toLowerCase();
                    let badgeClass = 'badge-dps';
                    let reason = 'Amenaza de alto daño continuo.';
                    if (role.includes('curación') || role.includes('healer') || role.includes('apoyo')) {
                        badgeClass = 'badge-danger';
                        reason = '¡Peligro! Cura o potencia a sus aliados. Eliminar de inmediato.';
                    } else if (role.includes('rupt') || role.includes('tanque')) {
                        badgeClass = 'badge-tank';
                        reason = 'Alta defensa. Dejar para el final tras romper sus escudos.';
                    }

                    const imgSrc = r.icon || r.icon_url || 'assets/aniimo/default.webp';

                    return `
                        <div class="kill-order-card">
                            <span class="kill-step-num">${i + 1}º Foco</span>
                            <img class="kill-thumb" src="${imgSrc}" onerror="this.onerror=null; this.src='${r.icon_url || ''}';" alt="${r.name}">
                            <div class="kill-meta">
                                <strong>${r.name}</strong>
                                <span class="kill-role-tag ${badgeClass}">${r.role || 'DPS'}</span>
                                <p class="kill-reason">${reason}</p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- SECCIÓN 3: MATRIZ DE ENFRENTAMIENTO 1 A 1 -->
        <div class="tactical-card-section matrix-section">
            <div class="tactical-section-head">
                <span class="tactical-badge badge-info">📊 Matriz de Emparejamiento 1 a 1</span>
                <h3>Desglose de Ventajas y Consejos de Combate</h3>
            </div>

            <div class="table-responsive">
                <table class="tactical-table">
                    <thead>
                        <tr>
                            <th>Rival a Batir</th>
                            <th>Tipos Rival</th>
                            <th>Counter Asignado</th>
                            <th>Multiplicador</th>
                            <th>Consejo Táctico de Ejecución</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${validRivals.map(r => {
                            const rElems = r.elements || [r.element];
                            // Encontrar el mejor counter entre los titulares
                            let bestMatch = null;
                            let bestMult = 1.0;
                            for (const s of starters) {
                                const m = s.matchupDetails.find(md => md.rivalName === r.name);
                                if (m && m.multiplier > bestMult) {
                                    bestMult = m.multiplier;
                                    bestMatch = s;
                                }
                            }
                            if (!bestMatch) bestMatch = starters[0];

                            const rElemBadges = rElems.map(el => {
                                const chart = ELEMENT_CHART[normalizeElement(el)] || {};
                                return `<span class="mini-elem-badge" style="background: ${chart.color || '#475569'};">${chart.emoji || ''} ${el}</span>`;
                            }).join(' ');

                            let advice = 'Ataca con ráfaga continua aprovechando tu ventaja elemental.';
                            if (bestMult >= 2.5) advice = '¡Doble debilidad! Desata la Ultimate nada más entrar para un KO instantáneo.';
                            if (r.name.toLowerCase().includes('glynsera')) advice = 'Evita el combate cuerpo a cuerpo; mantén la distancia para no recibir daño de espinas.';
                            if (r.name.toLowerCase().includes('glacy')) advice = 'Interrumpe sus habilidades curativas con daño eléctrico de Fulmintis.';
                            if (r.name.toLowerCase().includes('sherro')) advice = 'Esquiva sus tajos en abanico antes de descargar tu combo.';

                            return `
                                <tr>
                                    <td><strong>${r.name}</strong></td>
                                    <td>${rElemBadges}</td>
                                    <td><strong class="counter-highlight">${bestMatch.creature.name}</strong></td>
                                    <td>
                                        <span class="mult-pill ${bestMult >= 2.5 ? 'mult-double' : bestMult >= 1.5 ? 'mult-single' : 'mult-neutral'}">
                                            ${bestMult}x
                                        </span>
                                    </td>
                                    <td class="advice-cell">${advice}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- SECCIÓN 4: BANQUILLO DE SUPLENTES (MULTI-ELEMENTO) -->
        <div class="tactical-card-section reserves-section">
            <div class="tactical-section-head">
                <span class="tactical-badge badge-secondary">🛡️ Banquillo de Suplentes Estratégicos</span>
                <h3>Alternativas para Adaptación Rápida</h3>
                <p class="section-desc">Llévalos en reserva para intercambiar si el rival cambia de fase elemental o si no dispones de alguna criatura titular.</p>
            </div>

            <div class="reserves-grid">
                ${reserves.map(res => {
                    const c = res.creature;
                    const stats = c.stats || {};
                    const imgSrc = c.icon || c.icon_url || 'assets/aniimo/default.webp';
                    const elemBadges = (c.elements || [c.element]).map(el => {
                        const chart = ELEMENT_CHART[normalizeElement(el)] || {};
                        return `<span class="elem-badge" style="background: ${chart.color || '#475569'};">${chart.emoji || ''} ${el}</span>`;
                    }).join('');

                    return `
                        <div class="reserve-card">
                            <div class="reserve-top">
                                <img src="${imgSrc}" onerror="this.onerror=null; this.src='${c.icon_url || ''}';" alt="${c.name}">
                                <div>
                                    <h5>${c.name}</h5>
                                    <div class="starter-elems">${elemBadges}</div>
                                </div>
                            </div>
                            <div class="reserve-stats">
                                <span>ATQ: <strong>${stats.ATQ || 0}</strong></span>
                                <span>Quiebre: <strong>${stats.QUIEBRE || 0}</strong></span>
                                <span>Rol: <strong>${c.role || 'DPS'}</strong></span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}
