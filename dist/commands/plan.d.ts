import type { Runtime } from '../runtime.js';
export interface PlanOptions {
    file: string;
}
/**
 * Diffs bounties.yaml against live Gibwork state and prints the result.
 * Read-only: calls only tasks.list and tasks.get, and signs nothing.
 */
export declare function planCommand(runtime: Runtime, options: PlanOptions): Promise<void>;
//# sourceMappingURL=plan.d.ts.map