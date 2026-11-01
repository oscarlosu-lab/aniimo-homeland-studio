/**
 * Aniimo Homeland Studio - Solver Bridge (Native Aniidex HiGHS Worker)
 * Enlaza la interfaz reactiva con el Web Worker matemático de Aniidex (HiGHS MIP WASM).
 */

export class SolverBridge {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.reqIdCounter = 1;
        this.facts = null;
        this.isReady = false;
    }

    async init(facts) {
        this.facts = facts;
        if (!this.worker) {
            const workerUrl = new URL('./aniidex-solver-worker.js', import.meta.url).href;
            this.worker = new Worker(workerUrl, { type: 'module' });
            this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
            this.worker.onerror = (err) => console.error('[SolverBridge] Worker error:', err);
        }
        this.isReady = true;
        return true;
    }

    handleWorkerMessage(data) {
        const { id, plan, coinsPlan, extra, done, error } = data || {};
        const req = this.pendingRequests.get(id);
        if (!req) return;

        if (error) {
            this.pendingRequests.delete(id);
            req.reject(new Error(error));
            return;
        }

        if (plan) {
            req.resultPlan = plan;
            req.coinsPlan = coinsPlan;
            this.pendingRequests.delete(id);
            req.resolve({ plan, coinsPlan });
        }
    }

    async solve(settings) {
        if (!this.worker) {
            await this.init(this.facts);
        }

        return new Promise((resolve, reject) => {
            const id = this.reqIdCounter++;
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('El motor de Aniidex tardó más de 20s en resolver.'));
                }
            }, 20000);

            this.pendingRequests.set(id, {
                resolve: (res) => {
                    clearTimeout(timeout);
                    resolve(res);
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            this.worker.postMessage({
                id,
                settings: settings,
                planner: this.facts,
                parts: ['plan']
            });
        });
    }
}

export const solverBridge = new SolverBridge();
