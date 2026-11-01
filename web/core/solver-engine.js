/**
 * Aniimo Homeland Studio - Core Solver Engine (HiGHS LP / Simplex)
 * Formulación matemática del plan óptimo de cultivo, producción en talleres,
 * venta a la cooperativa y maximización de monedas/EXP con eventos de temporada.
 */

export class HomelandSolverEngine {
    constructor(facts) {
        this.facts = facts;
    }

    /**
     * Genera la formulación en sintaxis estándar LP para HiGHS
     */
    buildLpModel(config) {
        const {
            rv = 14,
            plotsCount = 30,
            facilities = {},
            seasonActive = true,
            seasonMultiplier = 1.25,
            goal = 'coins', // 'coins' o 'level_up'
            targetRv = 15,
            stock = {},
            roster = []
        } = config;

        const recipes = this.facts.recipes || {};
        const items = this.facts.items || {};

        // 1. Filtrar recetas agrícolas para parcelas (farmland: 101xxxx)
        const farmRecipes = Object.entries(recipes)
            .filter(([id, r]) => String(r.facility).startsWith('101') && r.minLevel <= 6)
            .map(([id, r]) => ({ id, ...r }));

        // 2. Filtrar recetas de talleres industriales (molino, cocina, telar, etc.)
        const workshopRecipes = Object.entries(recipes)
            .filter(([id, r]) => !String(r.facility).startsWith('101') && r.minLevel <= 4)
            .map(([id, r]) => ({ id, ...r }));

        const objTerms = [];
        const constraints = [];

        // Capacidad de parcelas (86400 seg/día por parcela)
        const farmlandSeconds = plotsCount * 86400;
        const farmlandTerms = [];

        for (const r of farmRecipes) {
            const varCrop = `crop_${r.id}`;
            const outItem = r.outputs[0]?.item;
            const itemInfo = items[String(outItem)] || {};
            let baseSell = itemInfo.sell || 45;
            
            // Si es producto de temporada y está activa, aplicar multiplicador
            if (seasonActive && r.season) {
                baseSell = Math.round(baseSell * seasonMultiplier);
            }

            const seedCost = r.inputs[0]?.qty ? (r.inputs[0].qty * 10) : 0;
            const netMargin = Math.max(1, baseSell - seedCost);

            objTerms.push(`+ ${netMargin} ${varCrop}`);
            const cropDuration = r.workload || r.time || 3600;
            farmlandTerms.push(`+ ${cropDuration} ${varCrop}`);
        }

        // Capacidad por taller
        const workshopTerms = {};
        for (const r of workshopRecipes) {
            const facType = String(r.facility).slice(0, 4); // ej: 1020, 1030
            const varCraft = `craft_${r.id}`;
            const outItem = r.outputs[0]?.item;
            const itemInfo = items[String(outItem)] || {};
            let sellPrice = itemInfo.sell || 120;
            if (seasonActive && r.season) {
                sellPrice = Math.round(sellPrice * seasonMultiplier);
            }

            objTerms.push(`+ ${sellPrice} ${varCraft}`);

            if (!workshopTerms[facType]) workshopTerms[facType] = [];
            const craftDuration = r.workload || r.time || 1800;
            workshopTerms[facType].push(`+ ${craftDuration} ${varCraft}`);
        }

        // Construir LP
        let lp = "Maximize\n obj: " + objTerms.join(" ") + "\n";
        lp += "Subject To\n";
        lp += ` c_farmland: ${farmlandTerms.join(" ")} <= ${farmlandSeconds}\n`;

        for (const [facType, terms] of Object.entries(workshopTerms)) {
            // Asumir 1 taller por tipo salvo Farmland
            const maxSeconds = 1 * 86400;
            lp += ` c_fac_${facType}: ${terms.join(" ")} <= ${maxSeconds}\n`;
        }

        lp += "Bounds\n";
        for (const r of farmRecipes) lp += ` 0 <= crop_${r.id}\n`;
        for (const r of workshopRecipes) lp += ` 0 <= craft_${r.id}\n`;
        lp += "End\n";

        return { lp, farmRecipes, workshopRecipes };
    }

    /**
     * Formatea el resultado crudo de HiGHS a un informe ejecutivo
     */
    formatSolution(solution, modelMeta, config) {
        if (!solution || solution.Status !== 'Optimal') {
            return {
                success: false,
                status: solution?.Status || 'Error',
                message: 'No se pudo encontrar una solución óptima con las restricciones dadas.'
            };
        }

        const cols = solution.Columns || {};
        const items = this.facts.items || {};
        const recipes = this.facts.recipes || {};

        const activeCrops = [];
        let totalFarmlandSecondsUsed = 0;
        let totalSeedCost = 0;
        let totalRevenue = 0;

        for (const r of modelMeta.farmRecipes) {
            const col = cols[`crop_${r.id}`];
            if (col && col.Primal > 0.05) {
                const qty = col.Primal;
                const outId = r.outputs[0]?.item;
                const itemInfo = items[String(outId)] || {};
                const duration = r.workload || r.time || 3600;
                totalFarmlandSecondsUsed += qty * duration;

                const unitSell = itemInfo.sell || 45;
                const unitSeedCost = r.inputs[0]?.qty ? (r.inputs[0].qty * 10) : 0;
                const rev = qty * unitSell;
                const cost = qty * unitSeedCost;
                totalRevenue += rev;
                totalSeedCost += cost;

                activeCrops.push({
                    recipeId: r.id,
                    itemId: outId,
                    name: itemInfo.name || `Cosecha #${outId}`,
                    icon: itemInfo.icon || 'Item_Seed_Default',
                    harvestsPerDay: Math.round(qty * 10) / 10,
                    cycleMinutes: Math.round(duration / 60),
                    unitPrice: unitSell,
                    dailyRevenue: Math.round(rev),
                    dailySeedCost: Math.round(cost),
                    dailyNetProfit: Math.round(rev - cost)
                });
            }
        }

        const activeCrafts = [];
        for (const r of modelMeta.workshopRecipes) {
            const col = cols[`craft_${r.id}`];
            if (col && col.Primal > 0.05) {
                const qty = col.Primal;
                const outId = r.outputs[0]?.item;
                const itemInfo = items[String(outId)] || {};
                const unitSell = itemInfo.sell || 120;
                const rev = qty * unitSell;
                totalRevenue += rev;

                activeCrafts.push({
                    recipeId: r.id,
                    facilityId: r.facility,
                    itemId: outId,
                    name: itemInfo.name || `Producto #${outId}`,
                    icon: itemInfo.icon || 'Item_Product_Default',
                    craftsPerDay: Math.round(qty * 10) / 10,
                    unitPrice: unitSell,
                    dailyRevenue: Math.round(rev)
                });
            }
        }

        const netProfit = Math.round(solution.ObjectiveValue);
        const cycleTimeAverage = activeCrops.length > 0
            ? Math.round(activeCrops.reduce((acc, c) => acc + c.cycleMinutes, 0) / activeCrops.length)
            : 45;

        return {
            success: true,
            status: solution.Status,
            summary: {
                coinsPerDay: netProfit,
                grossRevenuePerDay: Math.round(totalRevenue),
                seedInvestmentPerDay: Math.round(totalSeedCost),
                expPerDay: Math.round(netProfit * 0.15),
                cycleMinutes: cycleTimeAverage,
                plotsUsed: config.plotsCount || 30,
                seasonBonusActive: Boolean(config.seasonActive)
            },
            crops: activeCrops,
            crafts: activeCrafts
        };
    }
}
