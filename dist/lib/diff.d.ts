import type { BountyEntry, LiveTask, Plan, SyncState } from '../types.js';
export interface DiffInput {
    /** Desired state, from bounties.yaml. */
    desired: BountyEntry[];
    /** Live state, already normalized from the SDK. */
    live: LiveTask[];
    /** Local id -> taskId mapping from .gibwork/state.json. */
    state: SyncState;
}
/**
 * Reconciles desired (bounties.yaml) against live (Gibwork) state.
 *
 * Pure: no I/O, no SDK, no clock. Every decision that can move money is made
 * here and nowhere else, which is what makes them exhaustively table-testable.
 *
 * The rules:
 *   in file, no state mapping                  -> create
 *   in file, mapped, live missing              -> blocked (never silently recreate)
 *   in file, mapped, live closed/refunded      -> blocked (never silently recreate)
 *   in file, mapped, immutable drift           -> blocked (needs refund + recreate)
 *   in file, mapped, only updatable drift      -> update
 *   in file, mapped, no drift                  -> unchanged
 *   mapped, absent from file, live and open    -> refund
 *   mapped, absent from file, already closed   -> dropped silently
 *   live but never tracked                     -> ignored entirely
 */
export declare function computePlan(input: DiffInput): Plan;
//# sourceMappingURL=diff.d.ts.map