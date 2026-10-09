import type { BountyEntry, Environment, PendingOperation, SyncState } from '../types.js';
export declare const STATE_DIR = ".gibwork";
export declare const STATE_FILE = "state.json";
export declare function stateFilePath(cwd?: string): string;
export declare function emptyState(): SyncState;
/**
 * Hash of the Gibwork-relevant fields of an entry. `id` is the lookup key and
 * `issue` is never sent to Gibwork, so neither counts as drift. Keys are
 * sorted so the hash does not depend on YAML key order.
 */
export declare function hashEntry(entry: BountyEntry): string;
/** Reads state.json, returning a fresh empty state if it does not exist. */
export declare function loadState(cwd?: string): SyncState;
/**
 * Writes state.json atomically (temp file + rename): this is the only record
 * of what an interrupted apply was doing, so it must never be half-written.
 */
export declare function saveState(state: SyncState, cwd?: string): void;
/** Records that a write operation is about to start. Call BEFORE signing. */
export declare function markPending(state: SyncState, operation: PendingOperation): SyncState;
/** Clears a pending marker once the operation reached a confirmed end state. */
export declare function clearPending(state: SyncState, id: string, kind: PendingOperation['kind']): SyncState;
/**
 * Records a confirmed create/update so future runs can detect drift. `entry`
 * is optional because `status` may adopt a task whose file entry is gone — the
 * mapping is still worth keeping even with nothing to hash.
 */
export declare function recordTask(state: SyncState, id: string, taskId: string, entry?: BountyEntry): SyncState;
/** Drops a task from tracking after a confirmed refund. */
export declare function forgetTask(state: SyncState, id: string): SyncState;
/**
 * Guards against reading one wallet's or environment's state as another's.
 * Running production against a stage state file would show every tracked task
 * as missing and every entry as new — a plan that could duplicate real bounties.
 */
export declare function assertStateMatches(state: SyncState, wallet: string, environment: Environment): void;
/** Records which wallet and environment this state file belongs to. */
export declare function stampState(state: SyncState, wallet: string, environment: Environment): SyncState;
//# sourceMappingURL=state.d.ts.map