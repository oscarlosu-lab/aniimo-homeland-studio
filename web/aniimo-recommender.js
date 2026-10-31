import { getActiveContracts } from './contracts-manager.js';
// aniimo-recommender.js - Recomendador inteligente de Aniimos basado en Datamine Oficial
import { FACILITIES, PERSONALITY_PAIRS, personalityLetter, opposedPersonality } from './facility-config.js';

let creaturesDatabase = null;
let databaseLoading = null;

export async function loadCreaturesDatabase() {
    if (creaturesDatabase) return creaturesDatabase;
    if (databaseLoading) return databaseLoading;
    databaseLoading = (async () => {
        try {
            const resp = await fetch(new URL('./aniimo_creatures.json', import.meta.url));
            if (!resp.ok) throw new Error('No se pudo cargar aniimo_creatures.json');
            creaturesDatabase = await resp.json();
            return creaturesDatabase;
        } catch (e) {
            console.error('Error cargando base de datos de Aniimos:', e);
            return [];
        } finally {
            databaseLoading = null;
        }
    })();
    return databaseLoading;
}

const ELEMENT_COLORS = {
    'Fuego': '#f87171',
    'Hierba': '#4ade80',
    'Agua': '#60a5fa',
    'Tierra': '#ca8a04',
    'Relámpago': '#facc15',
    'Hielo': '#38bdf8',
    'Viento': '#2dd4bf',
    'Oscuro': '#c084fc',
    'Luz': '#fef08a',
    'Neutro': '#94a3b8'
};

const ABILITY_ES_NAME = {
    'Fire': 'Fuego', 'Fuego': 'Fuego',
    'Grass': 'Hierba', 'Hierba': 'Hierba',
    'Water': 'Agua', 'Agua': 'Agua',
    'Earth': 'Tierra', 'Tierra': 'Tierra',
    'Lightning': 'Relámpago', 'Relámpago': 'Relámpago',
    'Ice': 'Hielo', 'Hielo': 'Hielo',
    'Wind': 'Viento', 'Viento': 'Viento',
    'Dark': 'Oscuro', 'Oscuro': 'Oscuro',
    'Light': 'Luz', 'Luz': 'Luz',
    'Hauling': 'Remolque', 'Remolque': 'Remolque',
    'Artisanship': 'Artesanía', 'Artesanía': 'Artesanía',
    'Leisure': 'Ocio', 'Ocio': 'Ocio',
    'Perfumery': 'Perfumería', 'Perfumería': 'Perfumería'
};

export const PERSONALITY_META = {
    'Instinctive': { letter: 'I', es: 'Instintivo', axis: 'I/E', default: false, desc: 'Intuición animal y reflejos rápidos' },
    'Energetic': { letter: 'E', es: 'Enérgico', axis: 'I/E', default: true, desc: 'Alta vitalidad y dinamismo en labores' },
    'Nimble': { letter: 'N', es: 'Ágil', axis: 'N/S', default: true, desc: 'Destreza veloz y aceleración' },
    'Practical': { letter: 'S', es: 'Práctico', axis: 'N/S', default: false, desc: 'Eficiencia pragmática y cero desperdicio' },
    'Faithful': { letter: 'F', es: 'Fiel', axis: 'F/T', default: false, desc: 'Constancia y dedicación incansable' },
    'Tenacious': { letter: 'T', es: 'Tenaz', axis: 'F/T', default: true, desc: 'Resistencia a la fatiga y decaimiento de ánimo' },
    'Playful': { letter: 'P', es: 'Juguetón', axis: 'P/J', default: false, desc: 'Creatividad, motivación e ingenio' },
    'Judicious': { letter: 'J', es: 'Sensato', axis: 'P/J', default: true, desc: 'Pulcritud y máxima precisión artesanal' },
};

export const FACILITY_ES_NAME = {
    'Mine': 'Mina',
    'Well': 'Pozo',
    'Tidewhisper Sandcastle': 'Castillo de arena susurrante',
    'Dewy House': 'Casa del rocío',
    'Nimbus Bed': 'Cama nimbus',
    'Starfall Hammock': 'Hamaca de estrellas',
    'Floral Windmill': 'Molino floral',
    'Carousel Mill': 'Molino de carrusel',
    'Crafting Table': 'Mesa de artesanía',
    'Claw Game Cooker': 'Cocina de garra',
    'Jukebox Dryer': 'Secadora musical',
    'Simmering Pot': 'Olla a fuego lento',
    'Phonolfactory Table': 'Mesa fonolfativa',
    'Bouncy Brew Keg': 'Barril saltarín',
    'Blazing Stove': 'Cocina abrasadora',
    'Pickling Jar': 'Frasco de encurtidos',
    'Joy Wheel Loom': 'Telar de rueda',
    'Woodworking Bench': 'Banco de carpintería',
    'Chimney Kiln': 'Horno de chimenea',
    'Farmland': 'Parcela de cultivo',
    'Woodland': 'Bosque maderero',
    'Dance Pad Polisher': 'Pulidora de pista',
    'Aniipod Maker': 'Fabricadora de Aniipods'
};

export function computeOptimalPersonalityProfile(roles) {
    const requested = [];
    const seenFacNames = new Set();

    for (const role of roles) {
        // Combinar nombres técnicos y textos descriptivos para detectar la instalación
        const candidates = (role.facilities || []).concat([role.where || '']);
        for (const cand of candidates) {
            if (!cand) continue;
            for (const fac of FACILITIES) {
                if (!fac.personality) continue;
                const esName = FACILITY_ES_NAME[fac.name] || fac.name;
                const matches = cand === fac.name || 
                                cand === fac.slug || 
                                cand === esName || 
                                cand.includes(fac.name) || 
                                cand.includes(esName);
                if (matches && !seenFacNames.has(fac.name)) {
                    seenFacNames.add(fac.name);
                    const meta = PERSONALITY_META[fac.personality];
                    if (meta) {
                        requested.push({
                            facility: fac.name,
                            facilityEs: esName,
                            personality: fac.personality,
                            letter: meta.letter,
                            es: meta.es
                        });
                    }
                }
            }
        }
    }

    const mbti = [];
    const activeBonuses = [];
    const conflicts = [];

    PERSONALITY_PAIRS.forEach((pair) => {
        const matches = requested.filter(r => pair.names.includes(r.personality));
        const distinctLetters = [...new Set(matches.map(m => m.letter))];

        if (distinctLetters.length > 1) {
            // Conflicto de personalidades opuestas en el mismo eje
            const chosen = distinctLetters[0];
            mbti.push(chosen);
            const facA = matches.find(m => m.letter === distinctLetters[0]);
            const facB = matches.find(m => m.letter === distinctLetters[1]);
            conflicts.push({
                axis: pair.letters.join('/'),
                letters: distinctLetters,
                desc: `${facA.es} (${facA.letter}) en ${facA.facilityEs} vs ${facB.es} (${facB.letter}) en ${facB.facilityEs}`
            });
            activeBonuses.push({
                facility: facA.facility,
                facilityEs: facA.facilityEs,
                personality: facA.personality,
                letter: facA.letter,
                es: facA.es,
                bonus: '+20% vel.'
            });
        } else if (distinctLetters.length === 1) {
            const letter = distinctLetters[0];
            mbti.push(letter);
            const seenFac = new Set();
            matches.forEach(m => {
                if (!seenFac.has(m.facility)) {
                    seenFac.add(m.facility);
                    activeBonuses.push({
                        facility: m.facility,
                        facilityEs: m.facilityEs,
                        personality: m.personality,
                        letter: m.letter,
                        es: m.es,
                        bonus: '+20% vel.'
                    });
                }
            });
        } else {
            const defaultName = pair.names.find(n => PERSONALITY_META[n]?.default) || pair.names[0];
            mbti.push(PERSONALITY_META[defaultName].letter);
        }
    });

    return {
        mbti: mbti.join('·'),
        rawMBTI: mbti.join(''),
        activeBonuses,
        conflicts,
        hasBonuses: activeBonuses.length > 0,
        hasConflicts: conflicts.length > 0
    };
}

function renderPersonalityBlock(profile) {
    if (!profile) return '';

    let bonusesHtml = '';
    if (profile.activeBonuses && profile.activeBonuses.length > 0) {
        bonusesHtml = profile.activeBonuses.map(b => 
            `<span class="recommender-pers-pill bonus" title="Otorga +20% de velocidad de trabajo en ${b.facilityEs}">⚡ [${b.letter}] ${b.es} (+20% en ${b.facilityEs})</span>`
        ).join('');
    } else {
        bonusesHtml = `<span class="recommender-pers-pill neutral" title="Esta criatura realiza labores generales; este rasgo optimiza su rendimiento">⚡ [${profile.mbti.split('·')[0]}] ${PERSONALITY_META['Energetic'].es} (Utilidad general)</span>`;
    }

    let conflictsHtml = '';
    if (profile.conflicts && profile.conflicts.length > 0) {
        conflictsHtml = profile.conflicts.map(c => 
            `<div class="recommender-pers-conflict" title="Un Aniimo no puede tener ambas personalidades opuestas simultáneamente">⚠️ <strong>Conflicto ${c.axis}:</strong> ${c.desc}. Se prioriza la primera labor.</div>`
        ).join('');
    }

    return `
        <div class="recommender-personality-block">
            <div class="recommender-pers-header">
                <span class="recommender-pers-title">🧬 <strong>Personalidad recomendada:</strong></span>
                <span class="recommender-mbti-badge" title="Perfil MBTI de 4 ejes ideal para eclosionar o usar Fruta de Personalidad">MBTI: <strong>${profile.mbti}</strong></span>
            </div>
            <div class="recommender-pers-pills-row">
                ${bonusesHtml}
            </div>
            ${conflictsHtml}
        </div>
    `;
}

const DISPLAY_ABILITIES = ['Fuego', 'Hierba', 'Agua', 'Tierra', 'Relámpago', 'Hielo', 'Viento', 'Oscuro', 'Luz', 'Remolque', 'Artesanía', 'Ocio', 'Perfumería'];

export function isBaseForm(creature) {
    if (!creature) return false;
    if (creature.is_prismana) return false;
    if (creature.name.includes('(')) return false;
    return true;
}

export function findBaseFormAlternative(primaryCreature, canonicalAbility, rawAbility, requiredLevel, pool) {
    if (!primaryCreature || !pool) return null;
    const bn = primaryCreature.base_name || primaryCreature.name;
    
    // 1. Probar misma especie base pura si tiene la habilidad activa
    const sameLineBase = pool.find(c => 
        isBaseForm(c) && 
        (c.base_name === bn || c.name === bn) &&
        (c.abilities[canonicalAbility] || c.abilities[rawAbility] || 0) > 0 &&
        c.name !== primaryCreature.name
    );
    if (sameLineBase) return sameLineBase;

    // 2. Buscar en el pool de formas básicas puras accesibles
    let candidates = pool.filter(c => 
        isBaseForm(c) && 
        (c.abilities[canonicalAbility] || c.abilities[rawAbility] || 0) > 0 &&
        c.name !== primaryCreature.name &&
        c.id !== primaryCreature.id
    );

    if (!candidates.length) return null;

    // Priorizar que sean salvajes
    const wildCands = candidates.filter(isWildCreature);
    if (wildCands.length) candidates = wildCands;

    // Ordenar:
    // a) Cumplir nivel requerido primero
    // b) Nivel más alto de la habilidad
    // c) Menor ID (etapas iniciales/fáciles de encontrar en rutas de inicio)
    candidates.sort((a, b) => {
        const lvlA = a.abilities[canonicalAbility] || a.abilities[rawAbility] || 0;
        const lvlB = b.abilities[canonicalAbility] || b.abilities[rawAbility] || 0;
        const meetA = lvlA >= requiredLevel ? 1 : 0;
        const meetB = lvlB >= requiredLevel ? 1 : 0;
        if (meetB !== meetA) return meetB - meetA;
        if (lvlB !== lvlA) return lvlB - lvlA;
        const idA = typeof a.id === 'number' ? a.id : 9999;
        const idB = typeof b.id === 'number' ? b.id : 9999;
        return idA - idB;
    });

    return candidates[0] || null;
}

export function isWildCreature(creature) {
    if (!creature || !creature.habitat) return false;
    const hab = creature.habitat.toLowerCase();
    if (hab.includes('no se encuentra en la naturaleza') || hab.includes('nacen de huevos') || hab.includes('crianza compartida')) {
        return false;
    }
    return true;
}

export function findAlternativeCreature(primaryCreature, canonicalAbility, rawAbility, requiredLevel, pool, preferWild = true) {
    let candidates = pool.filter(c => {
        if (c.name === primaryCreature.name || c.base_name === primaryCreature.base_name || c.id === primaryCreature.id) return false;
        const lvl = c.abilities[canonicalAbility] || c.abilities[rawAbility] || 0;
        return lvl >= requiredLevel;
    });

    if (preferWild) {
        const wildMatches = candidates.filter(isWildCreature);
        if (wildMatches.length) candidates = wildMatches;
    }

    if (!candidates.length) {
        candidates = pool.filter(c => {
            if (c.name === primaryCreature.name || c.base_name === primaryCreature.base_name || c.id === primaryCreature.id) return false;
            return (c.abilities[canonicalAbility] || c.abilities[rawAbility] || 0) > 0;
        });
        if (preferWild) {
            const wildMatches = candidates.filter(isWildCreature);
            if (wildMatches.length) candidates = wildMatches;
        }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
        const wildA = isWildCreature(a) ? 1 : 0;
        const wildB = isWildCreature(b) ? 1 : 0;
        if (wildB !== wildA) return wildB - wildA;
        const lvlA = a.abilities[canonicalAbility] || a.abilities[rawAbility] || 0;
        const lvlB = b.abilities[canonicalAbility] || b.abilities[rawAbility] || 0;
        if (lvlB !== lvlA) return lvlB - lvlA;
        const haulA = a.abilities['Remolque'] || a.abilities['Hauling'] || 0;
        const haulB = b.abilities['Remolque'] || b.abilities['Hauling'] || 0;
        if (haulB !== haulA) return haulB - haulA;
        return Object.keys(b.abilities).length - Object.keys(a.abilities).length;
    });

    return candidates[0] || null;
}

/**
 * Calcula la recomendación de Aniimos óptimos para el plan actual
 * @param {Array} keptGroups Lista de grupos de tareas de renderAniimoSummary
 * @param {number|null} maxSlots Capacidad del RV actual
 * @param {Object} options Opciones de configuración { allowPrismana, onlyWild, swaps }
 */
export async function recommendAniimos(keptGroups, maxSlots = 26, options = {}) {
    const allowPrismana = options.allowPrismana ?? true;
    const onlyWild = options.onlyWild ?? false;
    const onlyBaseForms = options.onlyBaseForms ?? false;
    const manualSwaps = options.swaps || {};

    const db = await loadCreaturesDatabase();
    if (!db || !db.length || !keptGroups || !keptGroups.length) {
        return { recommendations: [], totalAssigned: 0, maxSlots: maxSlots || 26, freeSlots: maxSlots || 26 };
    }

    let availablePool = db.filter(c => allowPrismana ? true : !c.is_prismana);
    if (onlyWild) {
        availablePool = availablePool.filter(isWildCreature);
    }
    if (onlyBaseForms) {
        availablePool = availablePool.filter(isBaseForm);
    }

    const rawRecommendations = [];
    let totalAssigned = 0;

    for (const group of keptGroups) {
        const rawAbility = group.ability;
        const canonicalAbility = ABILITY_ES_NAME[rawAbility] || rawAbility;
        const requiredLevel = group.level || 1;
        const count = group.count || 1;
        
        let whereDesc = '';
        const facilityNames = group.where && group.where.size ? [...group.where.keys()] : [];
        if (group.where && group.where.size) {
            whereDesc = [...group.where.entries()]
                .map(([place, n]) => n > 1 ? `${place} ×${n}` : place)
                .join(', ');
        } else if (group.jobs && group.jobs.size) {
            const trJobs = {
                'Sowing': 'Siembra',
                'Collecting': 'Recolección',
                'Reaping': 'Cosecha',
                'Logging': 'Tala',
                'Reclaiming': 'Preparación'
            };
            whereDesc = [...group.jobs.keys()].map(j => trJobs[j] || j).join(' y ') + ' de cultivos';
        } else {
            whereDesc = 'Labores generales del Hogar';
        }

        // Buscar en el pool criaturas que cumplan con la habilidad requerida
        const candidates = availablePool.filter(c => {
            const lvl = c.abilities[canonicalAbility] || c.abilities[rawAbility] || 0;
            return lvl >= requiredLevel;
        });

        // Si no hay candidatos para ese nivel exacto, buscar las de mayor nivel disponible
        const sorted = candidates.length ? candidates : availablePool.filter(c => {
            return (c.abilities[canonicalAbility] || c.abilities[rawAbility] || 0) > 0;
        });

        sorted.sort((a, b) => {
            // Si no estamos en modo onlyWild estricto, preferir criaturas salvajes si los niveles empatan
            const wildA = isWildCreature(a) ? 1 : 0;
            const wildB = isWildCreature(b) ? 1 : 0;
            const lvlA = a.abilities[canonicalAbility] || a.abilities[rawAbility] || 0;
            const lvlB = b.abilities[canonicalAbility] || b.abilities[rawAbility] || 0;
            if (lvlB !== lvlA) return lvlB - lvlA;
            if (wildB !== wildA) return wildB - wildA;
            // Desempate 1: mayor nivel de Remolque / Transporte secundario
            const haulA = a.abilities['Remolque'] || a.abilities['Hauling'] || 0;
            const haulB = b.abilities['Remolque'] || b.abilities['Hauling'] || 0;
            if (haulB !== haulA) return haulB - haulA;
            // Desempate 2: más habilidades generales para polivalencia
            return Object.keys(b.abilities).length - Object.keys(a.abilities).length;
        });

        let chosenCreature = sorted[0];

        // Verificar si el usuario pidió un reemplazo manual para esta criatura
        if (chosenCreature && manualSwaps[chosenCreature.id]) {
            const swapTarget = db.find(c => c.id === manualSwaps[chosenCreature.id]);
            if (swapTarget) chosenCreature = swapTarget;
        }

        if (chosenCreature) {
            const provLvl = chosenCreature.abilities[canonicalAbility] || chosenCreature.abilities[rawAbility] || requiredLevel;
            
            // Buscar una alternativa (preferiblemente salvaje y fácil de capturar)
            const alternative = findAlternativeCreature(chosenCreature, canonicalAbility, rawAbility, requiredLevel, db, true);
            // Buscar la forma básica accesible si no se tiene la forma avanzada/variante
            const baseForm = findBaseFormAlternative(chosenCreature, canonicalAbility, rawAbility, requiredLevel, db);

            rawRecommendations.push({
                creature: chosenCreature,
                alternative: alternative,
                baseForm: baseForm,
                isWild: isWildCreature(chosenCreature),
                count: count,
                ability: canonicalAbility,
                requiredLevel: requiredLevel,
                providedLevel: provLvl,
                where: whereDesc,
                facilities: facilityNames,
                personalityBonus: group.bonus,
                haulingBonus: chosenCreature.abilities['Remolque'] || 0
            });
            totalAssigned += count;
        }
    }

    // Asegurar siempre 1+ transportista dedicado para la fila de Remolque
    const hasDedicatedHauler = rawRecommendations.some(r => r.ability === 'Remolque');
    if (!hasDedicatedHauler) {
        const bestHaulers = availablePool
            .filter(c => (c.abilities['Remolque'] || c.abilities['Hauling'] || 0) >= 1)
            .sort((a, b) => {
                const wildA = isWildCreature(a) ? 1 : 0;
                const wildB = isWildCreature(b) ? 1 : 0;
                const hA = a.abilities['Remolque'] || a.abilities['Hauling'] || 0;
                const hB = b.abilities['Remolque'] || b.abilities['Hauling'] || 0;
                if (hB !== hA) return hB - hA;
                return wildB - wildA;
            });
        
        if (bestHaulers[0]) {
            let h = bestHaulers[0];
            if (manualSwaps[h.id]) {
                const swapTarget = db.find(c => c.id === manualSwaps[h.id]);
                if (swapTarget) h = swapTarget;
            }
            const hLvl = h.abilities['Remolque'] || h.abilities['Hauling'] || 1;
            const altHauler = findAlternativeCreature(h, 'Remolque', 'Hauling', 1, db, true);
            const baseHauler = findBaseFormAlternative(h, 'Remolque', 'Hauling', 1, db);
            rawRecommendations.push({
                creature: h,
                alternative: altHauler,
                baseForm: baseHauler,
                isWild: isWildCreature(h),
                count: 1,
                ability: 'Remolque',
                requiredLevel: 1,
                providedLevel: hLvl,
                where: 'Transporte continuo al Almacén',
                facilities: [],
                personalityBonus: false,
                haulingBonus: hLvl
            });
            totalAssigned += 1;
        }
    }

    // Agrupar inteligentemente por criatura para presentar una lista limpia y profesional
    const groupedMap = new Map();
    for (const r of rawRecommendations) {
        const key = r.creature.id || r.creature.name;
        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                creature: r.creature,
                alternative: r.alternative,
                baseForm: r.baseForm,
                isWild: r.isWild,
                totalCount: 0,
                roles: [],
                primaryAbility: r.ability,
                providedLevel: r.providedLevel
            });
        }
        if (!groupedMap.get(key).baseForm && r.baseForm) {
            groupedMap.get(key).baseForm = r.baseForm;
        }
        const item = groupedMap.get(key);
        item.totalCount += r.count;
        item.roles.push({
            count: r.count,
            ability: r.ability,
            level: r.providedLevel,
            where: r.where,
            facilities: r.facilities || [],
            bonus: r.personalityBonus
        });
    }

    const consolidatedRecommendations = [...groupedMap.values()];
    for (const item of consolidatedRecommendations) {
        item.personalityProfile = computeOptimalPersonalityProfile(item.roles);
    }

    const effectiveMax = maxSlots || 26;
    const freeSlots = Math.max(0, effectiveMax - totalAssigned);

    return {
        recommendations: consolidatedRecommendations,
        totalAssigned,
        maxSlots: effectiveMax,
        freeSlots,
        allowPrismana,
        onlyWild,
        onlyBaseForms
    };
}

/**
 * Renderiza el widget interactivo del recomendador de Aniimo
 */
export function renderRecommenderUI(recommendationData, containerEl, onUpdateOptions) {
    if (!containerEl) return;
    const { recommendations, totalAssigned, maxSlots, freeSlots, allowPrismana = true, onlyWild = false, onlyBaseForms = false } = recommendationData;

    if (!recommendations || recommendations.length === 0) {
        containerEl.innerHTML = `
            <div class="recommender-box empty">
                <p class="hint">No hay Aniimos requeridos en este plan.</p>
            </div>
        `;
        return;
    }

    const cardsHtml = recommendations.map(rec => {
        const c = rec.creature;
        const iconSrc = c.icon || `assets/aniimo/${c.id}.webp`;
        const fallbackSrc = `https://raw.githubusercontent.com/oscarlosu-lab/homeland-studio/main/web/assets/aniimo/${c.id}.webp`;
        
        const elementColor = ELEMENT_COLORS[c.element] || '#94a3b8';
        const elementBadge = `<span class="recommender-elem-badge" style="background:${elementColor}22; color:${elementColor}; border:1px solid ${elementColor}66">${c.element}</span>`;
        const nonWildBadge = !rec.isWild
            ? `<span class="recommender-obtain-badge non-wild" title="No aparece libre en la naturaleza; se consigue mediante evolución o crianza">⚠️ No salvaje (evolución)</span>`
            : `<span class="recommender-obtain-badge wild" title="Se puede capturar directamente en estado salvaje">🌿 Salvaje</span>`;

        // Mostrar únicamente las aptitudes en español sin duplicados
        const abilitiesBadges = DISPLAY_ABILITIES
            .filter(ab => (c.abilities[ab] || 0) > 0)
            .map(ab => {
                const lvl = c.abilities[ab];
                const isPrimary = ab === rec.primaryAbility || rec.roles.some(r => r.ability === ab);
                return `<span class="recommender-skill-pill${isPrimary ? ' active-target' : ''}">${ab} Lv.${lvl}</span>`;
            }).join('');

        // Tareas desglosadas con claridad y etiquetas de contratos
        const activeContracts = getActiveContracts();
        const urgentItems = new Set(activeContracts.filter(c => c.type === 'urgent').flatMap(c => c.items.map(it => it.item.toLowerCase())));
        const seasonItems = new Set(activeContracts.filter(c => c.type === 'season').flatMap(c => c.items.map(it => it.item.toLowerCase())));

        const tasksHtml = rec.roles.map(role => {
            const countStr = role.count > 1 ? `<strong>×${role.count}</strong> en ` : '';
            const whereLower = (role.where || '').toLowerCase();
            const isContractUrgent = Array.from(urgentItems).some(it => whereLower.includes(it.replace('_', ' ')));
            const isContractSeason = Array.from(seasonItems).some(it => whereLower.includes(it.replace('_', ' ')));
            
            let badge = '';
            if (isContractUrgent) {
                badge = `<span class="contract-facility-pill" title="Esta asignación produce un material requerido por tus contratos urgentes">⚡ Pedido Urgente</span>`;
            } else if (isContractSeason) {
                badge = `<span class="contract-facility-pill" style="border-color:#f472b6; color:#f472b6; background:rgba(236,72,153,0.15)" title="Produce material para el evento o pase de temporada">🌸 Evento</span>`;
            }

            return `<div class="recommender-subtask">• ${countStr}<span>${role.where}</span> <small class="hint">(${role.ability} Lv.${role.level})</small>${badge}</div>`;
        }).join('');

        
        // Bloque de Forma Básica Accesible (si la recomendada es una variante, evolución o si no se tiene)
        let baseFormHtml = '';
        if (rec.baseForm && rec.baseForm.id !== c.id) {
            const bf = rec.baseForm;
            const bfIconSrc = bf.icon || `assets/aniimo/${bf.id}.webp`;
            const bfFallbackSrc = `https://raw.githubusercontent.com/oscarlosu-lab/homeland-studio/main/web/assets/aniimo/${bf.id}.webp`;
            const bfLvl = bf.abilities[rec.primaryAbility] || bf.abilities[ABILITY_ES_NAME[rec.primaryAbility]] || 1;
            const targetReq = rec.roles[0]?.requiredLevel || 1;
            const gap = targetReq - bfLvl;
            const gapBadge = gap > 0 
                ? `<span class="base-lvl-badge need-training" title="Puedes usar esta forma básica inicial, pero requerirá entrenar +${gap} niveles en el campamento para la labor máxima">⚠️ Nv.${bfLvl} (Entrenar +${gap})</span>`
                : `<span class="base-lvl-badge pass" title="Cubre el nivel requerido inmediatamente">✔ Nv.${bfLvl} Listo</span>`;

            baseFormHtml = `
                <div class="recommender-base-form-box">
                    <div class="recommender-base-form-header">
                        <span class="recommender-base-form-title">🌱 <strong>Forma básica accesible si no tienes a ${c.name}:</strong></span>
                        <button type="button" class="recommender-swap-btn btn-base-swap" data-from="${c.id}" data-to="${bf.id}" title="Reemplazar ${c.name} por la forma básica ${bf.name}">Usar forma básica (${bf.name})</button>
                    </div>
                    <div class="recommender-base-form-content">
                        <img class="recommender-alt-avatar" src="${bfIconSrc}" onerror="this.onerror=null;this.src='${bfFallbackSrc}';" alt="${bf.name}" loading="lazy" />
                        <div class="recommender-alt-text">
                            <div class="recommender-alt-name-row">
                                <span class="recommender-alt-dex">${bf.dex}</span>
                                <strong class="recommender-alt-name">${bf.name}</strong>
                                <span class="recommender-alt-wild-tag" style="background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3)">🌱 Forma Básica</span>
                                <span class="recommender-skill-pill active-target small">${rec.primaryAbility} Lv.${bfLvl}</span>
                                ${gapBadge}
                            </div>
                            <div class="recommender-alt-habitat">📍 ${bf.habitat || 'Fácil de encontrar en rutas abiertas'}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const habitatText = c.habitat ? `📍 <strong>Hábitat:</strong> ${c.habitat}` : '';

        // Bloque de Alternativa (para Aniimos no salvajes como Inferlupa o por si no lo tienes)
        let altHtml = '';
        if (rec.alternative) {
            const alt = rec.alternative;
            const altIconSrc = alt.icon || `assets/aniimo/${alt.id}.webp`;
            const altFallbackSrc = `https://raw.githubusercontent.com/oscarlosu-lab/homeland-studio/main/web/assets/aniimo/${alt.id}.webp`;
            const altLvl = alt.abilities[rec.primaryAbility] || alt.abilities[ABILITY_ES_NAME[rec.primaryAbility]] || 1;
            const altIsWild = isWildCreature(alt);
            altHtml = `
                <div class="recommender-alt-box">
                    <div class="recommender-alt-header">
                        <span class="recommender-alt-title">🔄 <strong>Alternativa si no tienes a ${c.name}:</strong></span>
                        <button type="button" class="recommender-swap-btn" data-from="${c.id}" data-to="${alt.id}" title="Reemplazar ${c.name} por ${alt.name} en el equipo">Usar ${alt.name}</button>
                    </div>
                    <div class="recommender-alt-content">
                        <img class="recommender-alt-avatar" src="${altIconSrc}" onerror="this.onerror=null;this.src='${altFallbackSrc}';" alt="${alt.name}" loading="lazy" />
                        <div class="recommender-alt-text">
                            <div class="recommender-alt-name-row">
                                <span class="recommender-alt-dex">${alt.dex}</span>
                                <strong class="recommender-alt-name">${alt.name}</strong>
                                ${altIsWild ? '<span class="recommender-alt-wild-tag">🌿 Salvaje fácil</span>' : ''}
                                <span class="recommender-skill-pill active-target small">${rec.primaryAbility} Lv.${altLvl}</span>
                            </div>
                            <div class="recommender-alt-habitat">📍 ${alt.habitat || 'Naturaleza abierta'}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="recommender-card${!rec.isWild ? ' card-non-wild' : ''}">
                <div class="recommender-card-left">
                    <div class="recommender-avatar-wrap">
                        <img class="recommender-avatar" src="${iconSrc}" onerror="this.onerror=null;this.src='${fallbackSrc}';" alt="${c.name}" loading="lazy" />
                        <span class="recommender-count-badge">×${rec.totalCount}</span>
                    </div>
                </div>
                <div class="recommender-card-info">
                    <div class="recommender-header-line">
                        <span class="recommender-dex">${c.dex}</span>
                        <strong class="recommender-name">${c.name}</strong>
                        ${elementBadge}
                        ${nonWildBadge}
                    </div>
                    <div class="recommender-task-line">
                        🎯 <strong>Labor asignada:</strong>
                        <div class="recommender-tasks-container">
                            ${tasksHtml}
                        </div>
                    </div>
                    <div class="recommender-skills-list">
                        ${abilitiesBadges}
                    </div>
                    ${habitatText ? `<div class="recommender-habitat-line">${habitatText}</div>` : ''}
                    ${renderPersonalityBlock(rec.personalityProfile)}
                    ${altHtml}
                    ${baseFormHtml}
                </div>
            </div>
        `;
    }).join('');

    const isOver = totalAssigned > maxSlots;
    const slotsClass = isOver ? 'over-capacity' : 'optimal-capacity';
    const statusNote = isOver
        ? `⚠️ Supera por ${totalAssigned - maxSlots} el cupo de Casa rodante (máx. ${maxSlots})`
        : `✔ Capacidad óptima (${freeSlots} slots libres para transporte o reservas)`;

    let isRecommenderExpanded = false;
    try {
        isRecommenderExpanded = localStorage.getItem('homeland_studio_recommender_expanded') === 'true';
    } catch (_) {}

    containerEl.innerHTML = `
        <div class="recommender-container">
            <button type="button" class="recommender-collapse-toggle" id="recommender-toggle-btn" aria-expanded="${isRecommenderExpanded}">
                <div class="recommender-title-block">
                    <div class="recommender-title-row">
                        <span class="chevron" aria-hidden="true"></span>
                        <h3 class="recommender-title">✨ Aniimos recomendados para este plan</h3>
                    </div>
                    <p class="recommender-subtitle">Criaturas óptimas del datamine oficial (${recommendations.length} recomendadas). Haz clic para ${isRecommenderExpanded ? 'plegar' : 'desplegar'}.</p>
                </div>
                <div class="recommender-header-right">
                    <div class="recommender-stats-badge ${slotsClass}">
                        <strong>${totalAssigned}</strong> / ${maxSlots} slots usados
                        <span class="recommender-free-slots">(${freeSlots} libres)</span>
                    </div>
                    <span class="recommender-expand-pill">${isRecommenderExpanded ? '▲ Plegar' : '▼ Desplegar'}</span>
                </div>
            </button>

            <div class="recommender-collapsible-content" id="recommender-collapsible-body" ${isRecommenderExpanded ? '' : 'hidden'}>
                <div class="recommender-status-bar ${slotsClass}">
                    ${statusNote}
                </div>

                <div class="recommender-toolbar">
                    <label class="recommender-toggle-label">
                        <input type="checkbox" id="recommender-prismana-toggle" ${allowPrismana ? 'checked' : ''}>
                        <span>Formas de Prismana (máxima eficiencia Lv.4)</span>
                    </label>
                    <label class="recommender-toggle-label">
                        <input type="checkbox" id="recommender-only-wild-toggle" ${onlyWild ? 'checked' : ''}>
                        <span>🌿 Priorizar Aniimos salvajes</span>
                    </label>
                    <label class="recommender-toggle-label" title="Filtra y sugiere exclusivamente formas básicas sin variantes raras de clima o eventos">
                        <input type="checkbox" id="recommender-base-forms-toggle" ${onlyBaseForms ? 'checked' : ''}>
                        <span>🌱 Solo Formas Básicas (Fáciles de capturar)</span>
                    </label>
                    <div class="recommender-mbti-toolbar-pill" title="El algoritmo calcula el perfil MBTI ideal y las personalidades que otorgan +20% de velocidad a cada criatura en su instalación">
                        <span>🧬 Personalidad MBTI (+20% vel) Activa</span>
                    </div>
                    <button type="button" class="button small" id="recommender-copy-btn">📋 Copiar lista completa</button>
                </div>

                <div class="recommender-grid">
                    ${cardsHtml}
                </div>
            </div>
        </div>
    `;

    // Toggle para desplegar/plegar panel
    const toggleBtn = containerEl.querySelector('#recommender-toggle-btn');
    const collapsibleBody = containerEl.querySelector('#recommender-collapsible-body');
    const expandPill = containerEl.querySelector('.recommender-expand-pill');
    const subtitleEl = containerEl.querySelector('.recommender-subtitle');

    if (toggleBtn && collapsibleBody) {
        toggleBtn.addEventListener('click', () => {
            isRecommenderExpanded = !isRecommenderExpanded;
            try { localStorage.setItem('homeland_studio_recommender_expanded', isRecommenderExpanded); } catch (_) {}
            toggleBtn.setAttribute('aria-expanded', String(isRecommenderExpanded));
            collapsibleBody.hidden = !isRecommenderExpanded;
            if (expandPill) {
                expandPill.textContent = isRecommenderExpanded ? '▲ Plegar' : '▼ Desplegar';
            }
            if (subtitleEl) {
                subtitleEl.textContent = `Criaturas óptimas del datamine oficial (${recommendations.length} recomendadas). Haz clic para ${isRecommenderExpanded ? 'plegar' : 'desplegar'}.`;
            }
        });
    }

    // Eventos interactivos
    const prismanaToggle = containerEl.querySelector('#recommender-prismana-toggle');
    if (prismanaToggle && onUpdateOptions) {
        prismanaToggle.addEventListener('change', (e) => {
            onUpdateOptions({ type: 'toggle-prismana', value: e.target.checked });
        });
    }

    const wildToggle = containerEl.querySelector('#recommender-only-wild-toggle');
    if (wildToggle && onUpdateOptions) {
        wildToggle.addEventListener('change', (e) => {
            onUpdateOptions({ type: 'toggle-wild', value: e.target.checked });
        });
    }

    const baseFormsToggle = containerEl.querySelector('#recommender-base-forms-toggle');
    if (baseFormsToggle && onUpdateOptions) {
        baseFormsToggle.addEventListener('change', (e) => {
            onUpdateOptions({ type: 'toggle-base-forms', value: e.target.checked });
        });
    }

    containerEl.querySelectorAll('.recommender-swap-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const fromId = parseInt(e.target.dataset.from, 10);
            const toId = parseInt(e.target.dataset.to, 10);
            if (fromId && toId && onUpdateOptions) {
                onUpdateOptions({ type: 'swap', from: fromId, to: toId });
            }
        });
    });

    const copyBtn = containerEl.querySelector('#recommender-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const lines = [];
            lines.push(`📋 EQUIPO RECOMENDADO DE ANIIMO (${totalAssigned}/${maxSlots} slots):`);
            recommendations.forEach(r => {
                const tasks = r.roles.map(rl => `${rl.where} (${rl.ability} Lv.${rl.level})`).join(', ');
                const wildMark = r.isWild ? '[Salvaje]' : '[Evolución]';
                const mbtiText = r.personalityProfile ? ` [MBTI: ${r.personalityProfile.mbti}]` : '';
                lines.push(`• ${r.creature.name} (${r.creature.dex}) ${wildMark} ×${r.totalCount} -> ${tasks}${mbtiText}`);
            });
            const textToCopy = lines.join('\n');
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.textContent = '✓ ¡Lista copiada!';
                setTimeout(() => { copyBtn.textContent = '📋 Copiar lista completa'; }, 2000);
            });
        });
    }
}
