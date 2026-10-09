import type { CreateTaskInput, GibworkClient, UpdateTaskInput, WalletSigner } from '@gibwork/sdk';
import type { BountyEntry, Plan, PlannedUpdate, SyncState } from '../types.js';
import type { Pacer, Sleep } from './pacer.js';
/** Upper bound for the crash-test pause, so a typo cannot stall a run for hours. */
export declare const MAX_FAULT_PAUSE_MS = 60000;
/**
 * Parses GIBBON_FAULT_PAUSE_MS. Unset or empty means off (0). Anything that is
 * not a whole number of milliseconds in range is a usage error, never a silent 0.
 */
export declare function parseFaultPauseMs(raw: string | undefined): number;
/** Everything an executor needs. Injectable so tests can drive it offline. */
export interface ExecutorDeps {
    client: GibworkClient;
    signer: WalletSigner;
    pacer: Pacer;
    /** Separated from the logic so tests can observe every write. */
    save: (state: SyncState) => void;
    /** Injectable so tests can assert the marker reaches disk before a signature exists. */
    sign?: (serializedTransaction: string, signer: WalletSigner) => Promise<string>;
    /** Aborting before a submit is safe; after it, `status` recovers. */
    signal?: AbortSignal;
    log?: (message: string) => void;
    /**
     * Crash testing only (GIBBON_FAULT_PAUSE_MS). Holds each operation open after
     * its submit returns and BEFORE the result is recorded: the funds have moved,
     * but nothing local says so yet. Killing the process inside this window must
     * leave a marker that `apply` refuses over and `status` settles. 0 = off.
     */
    faultPauseMs?: number;
    /** Injectable so tests can observe the fault pause without real time. */
    pause?: Sleep;
}
/** 'confirmed' means we know it landed. 'unresolved' means only `status` can say. */
export type Outcome = 'confirmed' | 'unresolved';
export interface ExecResult {
    state: SyncState;
    outcome: Outcome;
}
export declare function toCreateInput(entry: BountyEntry): CreateTaskInput;
export declare function toUpdateInput(planned: PlannedUpdate): UpdateTaskInput;
/**
 * Update: one HTTP call, no transaction, no funds. Deliberately has no pending
 * marker — nothing is signed, so an interrupted update is safe to run again.
 */
export declare function execUpdate(deps: ExecutorDeps, state: SyncState, planned: PlannedUpdate): Promise<ExecResult>;
/**
 * Create: prepare -> persist -> sign -> submit -> settle.
 *
 * The ordering is the entire point. `prepareCreate` returns the taskId before
 * any funds move, and it reaches disk BEFORE a signature exists. There is no
 * idempotency key, so without that marker a process killed after submit leaves
 * a funded bounty recorded nowhere, and the next run funds a second one.
 */
export declare function execCreate(deps: ExecutorDeps, state: SyncState, entry: BountyEntry): Promise<ExecResult>;
/**
 * Refund: the same five steps as create, through prepareRefund/submitRefund.
 * Funds move out of escrow, so it gets identical crash protection.
 */
export declare function execRefund(deps: ExecutorDeps, state: SyncState, target: Plan['toRefund'][number]): Promise<ExecResult>;
//# sourceMappingURL=executor.d.ts.map