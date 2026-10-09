import type { Runtime } from '../runtime.js';
export interface StatusOptions {
    file: string;
    /** Report without writing the resolved state back. */
    dryRun?: boolean;
}
/**
 * The reconciliation watchdog: reads back every operation a previous `apply`
 * started but never confirmed, and settles the local record against what
 * Gibwork shows. Only ever READS from the API, but rewrites
 * .gibwork/state.json — which is what unblocks `apply`.
 */
export declare function statusCommand(runtime: Runtime, options: StatusOptions): Promise<void>;
//# sourceMappingURL=status.d.ts.map