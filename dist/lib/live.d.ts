import type { GibworkClient, WalletTaskSummary } from '@gibwork/sdk';
import type { LiveTask, SyncState } from '../types.js';
/** Walks every page of tasks.list for the signing wallet. */
export declare function listAllSummaries(client: GibworkClient, signal?: AbortSignal): Promise<WalletTaskSummary[]>;
/**
 * Builds the live half of the diff.
 *
 * `tasks.list()` omits `content` and `tags`, so a real diff needs one
 * `tasks.get()` per task — and only for tasks the state file tracks, since the
 * diff ignores the rest anyway.
 *
 * A tracked task that 404s is omitted, leaving the diff to block a mapping
 * with no live counterpart rather than silently recreate it.
 */
export declare function fetchLiveTasks(client: GibworkClient, state: SyncState, signal?: AbortSignal): Promise<{
    live: LiveTask[];
    summaries: WalletTaskSummary[];
    missing: string[];
}>;
//# sourceMappingURL=live.d.ts.map