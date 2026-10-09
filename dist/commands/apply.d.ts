import type { Runtime } from '../runtime.js';
export interface ApplyOptions {
    file: string;
    /** Skip the interactive confirmation. For CI. */
    yes?: boolean;
}
/**
 * Reconciles live Gibwork state to match bounties.yaml.
 *
 * The order is deliberate: refuse to start while a previous run is unresolved,
 * recompute the plan, confirm, then updates before creates and refunds.
 *
 * Exit codes follow @gibwork/cli: 0 applied · 30 blocked · 31 unresolved ·
 * 2/10/20/21/22 for usage, credential, API, network and ambiguous submit.
 */
export declare function applyCommand(runtime: Runtime, options: ApplyOptions): Promise<void>;
//# sourceMappingURL=apply.d.ts.map