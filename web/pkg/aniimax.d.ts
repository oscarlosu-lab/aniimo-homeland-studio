/* tslint:disable */
/* eslint-disable */

/**
 * With "prioritize byproducts" on, the exact planner first finds the most of each byproduct the
 * facilities can make: one model per byproduct, `[{"resource", "lp", "variables", "tiebreak"}]` (see
 * [`exact_problem`] for the format). The caller solves each and passes
 * `[[resource, most per second], ...]` to [`exact_problem`] and [`exact_plan`] as the floors.
 * Empty when byproducts aren't prioritized.
 */
export function exact_byproduct_problems(input_json: string): string;

/**
 * For the level-up strategy, the model for the soonest level-up (see
 * [`crate::exact::Goal::LevelUp`]): `{"lp", "variables", "tiebreak"}` as in [`exact_problem`]. The caller
 * solves it and passes the pace it finds (its objective) to [`exact_problem`] and [`exact_plan`].
 * `lp` is empty for the coins strategy, or when the stock already covers the level-up.
 */
export function exact_level_up_problem(input_json: string): string;

/**
 * Turns HiGHS's solution of [`exact_problem`]'s model into the same result [`find_plan`]
 * returns, plus whether it's proven optimal.
 */
export function exact_plan(input_json: string, stage_json: string, solution_json: string): string;

/**
 * The model for the most of one priority `target` (see [`JsPlanInput::priorities`]) this
 * homeland can make while keeping every floor in `stage_json` (the priorities before it):
 * `{"lp", "variables", "tiebreak"}` as in [`exact_problem`]. The caller solves it and adds
 * `[target, per second]` to the floors for the next priority and the final coin solve.
 */
export function exact_priority_problem(input_json: string, stage_json: string, target: string): string;

/**
 * The exact planner's model for this input (see [`crate::exact`]), for the caller to solve with
 * HiGHS and hand back to [`exact_plan`]: `{"lp": <CPLEX LP text>, "variables": <count>,
 * "tiebreak": [[variable, weight], ...]}`, where the variables are `x0` up to `x<count - 1>` and
 * the tie-break is added back to the solver's objective to get what it really made (see
 * [`crate::exact::LpProblem`]). `stage_json` is `{"floors": [[byproduct, per
 * second], ...], "pace": <level-ups per day>}` from the earlier solves (see
 * [`exact_byproduct_problems`] and [`exact_level_up_problem`]); either can be left out. `lp` is
 * empty when the exact planner doesn't cover the input (a byproduct as the currency), so the
 * caller uses [`find_plan`] instead.
 */
export function exact_problem(input_json: string, stage_json: string): string;

/**
 * Solve for the best achievable production plan; no goal amount needed.
 *
 * Takes a JSON string input ([`JsPlanInput`]) and returns a JSON string result
 * ([`JsProductionPlan`]). See [`crate::optimizer::find_production_plan`] for the algorithm.
 *
 * `on_progress`, if given, is called with the solver's real, running trial-solve count after
 * every trial solve throughout the whole pipeline (see
 * [`crate::optimizer::find_production_plan_with_progress`]); this is genuine solve progress, not
 * a value simulated independently of the actual computation, so the caller (`web/worker.js`) can
 * forward it to the main thread for a real progress bar. Since this function itself already runs
 * off the main thread (called from a Web Worker; see `web/worker.js`), calling back into JS here
 * doesn't block anything else from rendering.
 */
export function find_plan(input_json: string, on_progress?: Function | null): string;

/**
 * Get the full recipe list for every item in the game data, grouped by nothing in particular
 * (the caller groups by facility); used by the facilities reference page.
 */
export function get_all_items(): string;

/**
 * Get the list of available items for a given facility configuration.
 * Returns JSON array of item names and their facilities.
 */
export function get_available_items(input_json: string): string;

/**
 * Get the version of the optimizer.
 */
export function get_version(): string;

/**
 * Run the production optimizer with the given configuration.
 *
 * Takes a JSON string input and returns a JSON string result.
 */
export function optimize(input_json: string): string;

/**
 * Find how long a specific goal amount takes, given an already-computed plan. Cheap; no
 * facility-allocation re-solve; so this is safe to call on every keystroke of a goal input.
 *
 * Takes a JSON string input ([`JsGoalInput`]) and returns a JSON string result
 * ([`JsGoalResult`]). See [`crate::optimizer::time_to_reach_goal`] for the algorithm.
 */
export function time_to_reach(input_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly exact_byproduct_problems: (a: number, b: number) => [number, number];
    readonly exact_level_up_problem: (a: number, b: number) => [number, number];
    readonly exact_plan: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly exact_priority_problem: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly exact_problem: (a: number, b: number, c: number, d: number) => [number, number];
    readonly find_plan: (a: number, b: number, c: number) => [number, number];
    readonly get_all_items: () => [number, number];
    readonly get_available_items: (a: number, b: number) => [number, number];
    readonly get_version: () => [number, number];
    readonly optimize: (a: number, b: number) => [number, number];
    readonly time_to_reach: (a: number, b: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
