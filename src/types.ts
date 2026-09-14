/**
 * One entry in bounties.yaml.
 *
 * `id` is a stable, human-chosen key — NOT the Gibwork task UUID.
 * It's what lets gibwork-sync match a line in this file to a real
 * task across runs, via the local id -> taskId mapping in state.json.
 * Never change an existing entry's `id` once it has been applied.
 */
export interface BountyEntry {
    id: string;
    issue?: string; // optional reference, e.g. "#142" — not sent to Gibwork
    title: string;
    content: string;
    tags: string[];
    amount: string; // decimal string, e.g. "40.00"
    minSubmission?: string;
  }
  
  /**
   * Local state file (.gibwork/state.json).
   * Tracks which file `id` maps to which real Gibwork task UUID,
   * plus enough info to support reconciliation after an interruption.
   */
  export interface SyncState {
    tasks: Record<
      string,
      {
        taskId: string;
        lastAppliedHash: string; // hash of the entry, to detect drift
        lastSyncedAt: string; // ISO timestamp
      }
    >;
  }
  
  /** The result of diffing bounties.yaml against live Gibwork state. */
  export interface Plan {
    toCreate: BountyEntry[];
    toUpdate: { entry: BountyEntry; taskId: string }[];
    toRefund: { id: string; taskId: string }[];
    unchanged: BountyEntry[];
  }