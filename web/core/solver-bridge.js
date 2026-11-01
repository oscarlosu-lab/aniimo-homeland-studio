/**
 * Aniimo Homeland Studio - Solver Bridge (Client Manager)
 * Gestiona la comunicación asíncrona con solver-worker.js
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
            const workerUrl = new URL('./solver-worker.js', import.meta.url).href;
            this.worker = new Worker(workerUrl, { type: 'module' });
            this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
            this.worker.onerror = (err) => console.error('[SolverBridge] Worker error:', err);
        }

        return this.sendRequest('init', { facts });
    }

    handleWorkerMessage(data) {
        const { id, success, plan, error, message } = data || {};
        const resolver = this.pendingRequests.get(id);
        if (resolver) {
            this.pendingRequests.delete(id);
            if (success) {
                resolver.resolve(plan || message);
            } else {
                resolver.reject(new Error(error || 'Worker solve failure'));
            }
        }
    }

    sendRequest(type, payload = {}) {
        return new Promise((resolve, reject) => {
            const id = this.reqIdCounter++;
            this.pendingRequests.set(id, { resolve, reject });
            this.worker.postMessage({ id, type, ...payload });
            
            // Timeout de seguridad a los 30 segundos
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Solver request timed out (30s)'));
                }
            }, 30000);
        });
    }

    async solve(config) {
        return this.sendRequest('solve', {
            facts: this.facts,
            config
        });
    }
}

export const solverBridge = new SolverBridge();
