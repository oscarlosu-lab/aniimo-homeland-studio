/**
 * Aniimo Homeland Studio - Dedicated HiGHS LP Solver Web Worker
 * Ejecuta en segundo plano la resolución matemática para mantener 60 FPS en la UI.
 */

import highsModule from '../vendor/highs/highs.js';
import { HomelandSolverEngine } from './solver-engine.js';

let highsInstance = null;
let factsData = null;
let engine = null;

async function initHighs() {
    if (!highsInstance) {
        highsInstance = await highsModule({
            locateFile: (file) => new URL(`../vendor/highs/${file}`, import.meta.url).href
        });
    }
    return highsInstance;
}

self.onmessage = async (e) => {
    const { id, type, facts, config } = e.data || {};

    try {
        if (type === 'init') {
            await initHighs();
            if (facts) {
                factsData = facts;
                engine = new HomelandSolverEngine(factsData);
            }
            self.postMessage({ id, success: true, message: 'Solver worker ready' });
            return;
        }

        if (type === 'solve') {
            await initHighs();
            if (facts && (!factsData || facts.version !== factsData.version)) {
                factsData = facts;
                engine = new HomelandSolverEngine(factsData);
            }

            if (!engine) {
                throw new Error('El motor de hechos (facts) no está inicializado.');
            }

            const modelMeta = engine.buildLpModel(config || {});
            const solution = highsInstance.solve(modelMeta.lp);
            const plan = engine.formatSolution(solution, modelMeta, config || {});

            self.postMessage({
                id,
                success: true,
                plan
            });
            return;
        }

        self.postMessage({ id, success: false, error: `Tipo de mensaje desconocido: ${type}` });
    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err.message || String(err)
        });
    }
};
