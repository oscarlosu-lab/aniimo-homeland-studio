/**
 * HOMELAND STUDIO - Extra Management Features
 * 1. Calculadora de Nutrición y Autonomía del Comedero (Food Bowl Autonomy)
 * 2. Dashboard Táctico Superior (Executive KPI Banner)
 * 3. Modo Bilingüe (ES / EN)
 */

import { translate } from './i18n.js';

let foodData = [];
let currentActiveWorkers = 20;

export async function initExtraFeatures(onToggleBilingual) {
    await loadFood();
    initFoodCalculator();
    initBilingualButton(onToggleBilingual);
}

async function loadFood() {
    try {
        const res = await fetch('data/datamine_food.json');
        if (res.ok) foodData = await res.json();
    } catch (e) {
        console.warn('Could not load datamine_food.json:', e);
    }
}

function initFoodCalculator() {
    const select = document.getElementById('select-food-dish');
    if (!select || !foodData.length) return;

    select.innerHTML = foodData.map((f, idx) => `
        <option value="${idx}">${f.name} (${f.energy.toLocaleString('es-ES')} fd) - ${f.facility}</option>
    `).join('');

    select.addEventListener('change', () => {
        updateFoodAutonomy();
    });

    updateFoodAutonomy();
}

export function updateFoodAutonomy(workersCount = null) {
    if (workersCount !== null) currentActiveWorkers = workersCount;

    const select = document.getElementById('select-food-dish');
    const daysEl = document.getElementById('nutrition-autonomy-days');
    const crewEl = document.getElementById('nutrition-crew-consumption');
    const energyEl = document.getElementById('nutrition-dish-energy');
    const hintEl = document.getElementById('food-ingredients-hint');
    const kpiBowlDays = document.getElementById('kpi-bowl-days');
    const kpiBowlFood = document.getElementById('kpi-bowl-food');

    if (!select || !daysEl || !foodData.length) return;

    const idx = parseInt(select.value, 10) || 0;
    const food = foodData[idx] || foodData[0];

    // Formula: 10 energy points per min per active worker = 600 per hour
    const consumptionPerMin = currentActiveWorkers * 10;
    const consumptionPerHour = consumptionPerMin * 60;
    const bowlCapacity = 1000;
    const totalBowlEnergy = bowlCapacity * food.energy;

    const totalHours = totalBowlEnergy / consumptionPerHour;
    const days = Math.floor(totalHours / 24);
    const remHours = Math.round(totalHours % 24);
    const timeStr = days > 0 ? `${days}d ${remHours}h` : `${remHours}h`;

    daysEl.textContent = `${timeStr} AFK`;
    if (crewEl) crewEl.textContent = `${consumptionPerMin} fd/min (${currentActiveWorkers} Aniimos)`;
    if (energyEl) energyEl.textContent = `${food.energy.toLocaleString('es-ES')} fd / ración`;
    if (hintEl) {
        hintEl.textContent = `1.000 raciones en ${food.facility}. Necesita ~${food.units_7d || 53} unidades cada 7 días.`;
    }

    if (kpiBowlDays) kpiBowlDays.textContent = timeStr;
    if (kpiBowlFood) kpiBowlFood.textContent = food.name.split(' ')[0] + '...';
}

export function updateExecutiveKPI(plan, assignedWorkers = null, maxSlots = null) {
    const kpiCoinRate = document.getElementById('kpi-coin-rate');
    const kpiLevelTime = document.getElementById('kpi-level-time');
    const kpiTargetRv = document.getElementById('kpi-target-rv');
    const kpiAniimoSlots = document.getElementById('kpi-aniimo-slots');
    const kpiAniimoFree = document.getElementById('kpi-aniimo-free');

    if (kpiCoinRate && plan) {
        const hourlyRate = (plan.rate_per_second || 0) * 3600;
        kpiCoinRate.textContent = `${Math.round(hourlyRate).toLocaleString('es-ES')} 🪙/h`;
    }

    if (kpiLevelTime && plan) {
        if (plan.level_up) {
            const timeEl = document.getElementById('level-up-time');
            kpiLevelTime.textContent = timeEl ? timeEl.textContent : 'En progreso';
            if (kpiTargetRv) {
                const targetEl = document.getElementById('level-up-target');
                kpiTargetRv.textContent = targetEl ? `A Casa rodante ${targetEl.value}` : 'Siguiente nivel';
            }
        } else {
            kpiLevelTime.textContent = 'Modo Monedas';
            if (kpiTargetRv) kpiTargetRv.textContent = '100% Producción';
        }
    }

    if (assignedWorkers !== null) {
        currentActiveWorkers = assignedWorkers;
        updateFoodAutonomy(assignedWorkers);
        if (kpiAniimoSlots) {
            const max = maxSlots || 26;
            kpiAniimoSlots.textContent = `${assignedWorkers} / ${max}`;
            if (kpiAniimoFree) {
                const free = Math.max(0, max - assignedWorkers);
                kpiAniimoFree.textContent = `${free} plazas libres`;
            }
        }
    }
}

function initBilingualButton(onToggleBilingual) {
    const btn = document.getElementById('bilingualToggle');
    if (!btn) return;

    let isBi = localStorage.getItem('homeland-studio-bilingual') === 'true';
    updateBtnState(btn, isBi);

    btn.addEventListener('click', () => {
        isBi = !isBi;
        localStorage.setItem('homeland-studio-bilingual', isBi);
        updateBtnState(btn, isBi);
        if (onToggleBilingual) onToggleBilingual(isBi);
    });
}

function updateBtnState(btn, isBi) {
    if (isBi) {
        btn.classList.add('active-bilingual');
        btn.textContent = '🌐 Bilingüe: ON';
        btn.style.color = 'var(--accent)';
    } else {
        btn.classList.remove('active-bilingual');
        btn.textContent = '🌐 Bilingüe: OFF';
        btn.style.color = '';
    }
}
