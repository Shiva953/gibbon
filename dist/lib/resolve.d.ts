import type { GibworkClient } from '@gibwork/sdk';
import type { BountyEntry, PendingOperation, SyncState } from '../types.js';
/**
 * What reading the live task told us about an interrupted operation.
 * `in-flight` is the only verdict that keeps the marker; every other one is
 * settled, and clearing the marker is what unblocks the next apply.
 */
export type Verdict = 'never-landed' | 'in-flight' | 'succeeded' | 'rolled-back';
export interface Resolution {
    op: PendingOperation;
    verdict: Verdict;
    detail: string;
    /** True when the marker was removed, so `apply` may proceed over this entry. */
    cleared: boolean;
}
/** Resolves one interrupted operation. Reads only; never signs or moves funds. */
export declare function resolveOperation(client: GibworkClient, state: SyncState, op: PendingOperation, entry?: BountyEntry, signal?: AbortSignal): Promise<{
    state: SyncState;
    resolution: Resolution;
}>;
//# sourceMappingURL=resolve.d.ts.map