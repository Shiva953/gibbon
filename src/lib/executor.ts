import { GibworkAmbiguousSubmitError, signPreparedTransaction } from '@gibwork/sdk';
import type { CreateTaskInput, GibworkClient, UpdateTaskInput, WalletSigner } from '@gibwork/sdk';
import type { BountyEntry, Plan, PlannedUpdate, SyncState } from '../types.js';
import { CliError, EXIT } from './errors.js';
import { resolveEntry } from './normalize.js';
import { realSleep } from './pacer.js';
import type { Pacer, Sleep } from './pacer.js';
import { clearPending, forgetTask, markPending, recordTask } from './state.js';

/** Upper bound for the crash-test pause, so a typo cannot stall a run for hours. */
export const MAX_FAULT_PAUSE_MS = 60_000;

/**
 * Parses GIBBON_FAULT_PAUSE_MS. Unset or empty means off (0). Anything that is
 * not a whole number of milliseconds in range is a usage error, never a silent 0.
 */
export function parseFaultPauseMs(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value) return 0;
  const ms = Number(value);
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_FAULT_PAUSE_MS) {
    throw new CliError(
      `GIBBON_FAULT_PAUSE_MS must be a whole number of milliseconds from 0 to ${MAX_FAULT_PAUSE_MS}, got "${value}".`,
      'USAGE_ERROR',
      EXIT.USAGE,
    );
  }
  return ms;
}

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

/** The crash-test window. A no-op unless `faultPauseMs` is set. */
async function faultPause(deps: ExecutorDeps, id: string): Promise<void> {
  const ms = deps.faultPauseMs ?? 0;
  if (ms <= 0) return;
  deps.log?.(`… fault pause ${Math.round(ms / 1000)}s: ${id} submitted, not yet recorded`);
  await (deps.pause ?? realSleep)(ms, deps.signal);
}

/** SDK RequestOptions, omitted entirely when there is no signal to pass. */
function req(deps: ExecutorDeps): { signal: AbortSignal } | undefined {
  return deps.signal ? { signal: deps.signal } : undefined;
}

/** 'confirmed' means we know it landed. 'unresolved' means only `status` can say. */
export type Outcome = 'confirmed' | 'unresolved';

export interface ExecResult {
  state: SyncState;
  outcome: Outcome;
}

export function toCreateInput(entry: BountyEntry): CreateTaskInput {
  const resolved = resolveEntry(entry);
  return {
    title: resolved.title,
    content: resolved.content,
    tags: resolved.tags,
    payment: { mintAddress: resolved.mint, amount: resolved.amount },
    minSubmissionAmount: resolved.minSubmission,
    ...(resolved.deadline ? { deadline: resolved.deadline } : {}),
    ...(resolved.allowOnlyVerifiedSubmissions !== undefined
      ? { allowOnlyVerifiedSubmissions: resolved.allowOnlyVerifiedSubmissions }
      : {}),
  };
}

export function toUpdateInput(planned: PlannedUpdate): UpdateTaskInput {
  const { entry, changes } = planned;
  const input: UpdateTaskInput = {};
  if (changes.includes('content')) input.content = entry.content;
  if (changes.includes('deadline') && entry.deadline) input.deadline = entry.deadline;
  if (changes.includes('allowOnlyVerifiedSubmissions')) {
    input.allowOnlyVerifiedSubmissions = entry.allowOnlyVerifiedSubmissions ?? false;
  }
  return input;
}

/**
 * Update: one HTTP call, no transaction, no funds. Deliberately has no pending
 * marker — nothing is signed, so an interrupted update is safe to run again.
 */
export async function execUpdate(
  deps: ExecutorDeps,
  state: SyncState,
  planned: PlannedUpdate,
): Promise<ExecResult> {
  await deps.pacer.withRetry(() =>
    deps.client.tasks.update(planned.taskId, toUpdateInput(planned), req(deps)),
  );

  const next = recordTask(state, planned.entry.id, planned.taskId, planned.entry);
  deps.save(next);
  deps.log?.(`updated ${planned.entry.id} (${planned.changes.join(', ')})`);
  return { state: next, outcome: 'confirmed' };
}

/**
 * Create: prepare -> persist -> sign -> submit -> settle.
 *
 * The ordering is the entire point. `prepareCreate` returns the taskId before
 * any funds move, and it reaches disk BEFORE a signature exists. There is no
 * idempotency key, so without that marker a process killed after submit leaves
 * a funded bounty recorded nowhere, and the next run funds a second one.
 */
export async function execCreate(
  deps: ExecutorDeps,
  state: SyncState,
  entry: BountyEntry,
): Promise<ExecResult> {
  // PREPARE — no funds move. Yields taskId + intentId.
  await deps.pacer.prepare();
  const prepared = await deps.pacer.withRetry(() =>
    deps.client.tasks.prepareCreate(toCreateInput(entry), req(deps)),
  );

  // BARRIER — reach the disk before a signature exists anywhere.
  const marker = {
    id: entry.id,
    kind: 'create' as const,
    taskId: prepared.taskId,
    intentId: prepared.intentId,
    startedAt: new Date().toISOString(),
  };
  let next = markPending(state, marker);
  deps.save(next);

  // SIGN — local only, no network.
  const sign = deps.sign ?? signPreparedTransaction;
  const signedTransaction = await sign(prepared.serializedTransaction, deps.signer);

  // SUBMIT — funds move here. Announced first: from this line until the result
  // prints, the outcome is only knowable through `status`.
  await deps.pacer.submit();
  deps.log?.(`… submitting ${entry.id}`);
  let result;
  try {
    result = await deps.client.tasks.submitCreate(prepared.intentId, signedTransaction, req(deps));
  } catch (error) {
    // Ambiguous means we do not know whether it landed: keep the marker and
    // surface it. Never retry — that is how duplicates happen.
    const lastKnownStatus =
      error instanceof GibworkAmbiguousSubmitError ? 'ambiguous' : 'submit-failed';
    next = markPending(next, {
      ...marker,
      lastKnownStatus,
      error: error instanceof Error ? error.message : String(error),
    });
    deps.save(next);
    throw error;
  }

  await faultPause(deps, entry.id);

  // SETTLE — 'processing' is not success.
  if (result.status === 'confirmed') {
    next = recordTask(next, entry.id, prepared.taskId, entry);
    next = clearPending(next, entry.id, 'create');
    deps.save(next);
    deps.log?.(`created ${entry.id} -> ${prepared.taskId}`);
    return { state: next, outcome: 'confirmed' };
  }

  next = markPending(next, {
    ...marker,
    lastKnownStatus: result.status,
    ...(result.txHash ? { txHash: result.txHash } : {}),
  });
  deps.save(next);
  deps.log?.(`created ${entry.id} -> ${prepared.taskId} (status: ${result.status}, unresolved)`);
  return { state: next, outcome: 'unresolved' };
}

/**
 * Refund: the same five steps as create, through prepareRefund/submitRefund.
 * Funds move out of escrow, so it gets identical crash protection.
 */
export async function execRefund(
  deps: ExecutorDeps,
  state: SyncState,
  target: Plan['toRefund'][number],
): Promise<ExecResult> {
  await deps.pacer.prepare();
  const prepared = await deps.pacer.withRetry(() =>
    deps.client.tasks.prepareRefund(target.taskId, req(deps)),
  );

  const marker = {
    id: target.id,
    kind: 'refund' as const,
    taskId: target.taskId,
    intentId: prepared.intentId,
    startedAt: new Date().toISOString(),
  };
  let next = markPending(state, marker);
  deps.save(next);

  const sign = deps.sign ?? signPreparedTransaction;
  const signedTransaction = await sign(prepared.serializedTransaction, deps.signer);

  await deps.pacer.submit();
  deps.log?.(`… submitting ${target.id} (refund)`);
  let result;
  try {
    result = await deps.client.tasks.submitRefund(
      target.taskId,
      prepared.intentId,
      signedTransaction,
      req(deps),
    );
  } catch (error) {
    const lastKnownStatus =
      error instanceof GibworkAmbiguousSubmitError ? 'ambiguous' : 'submit-failed';
    next = markPending(next, {
      ...marker,
      lastKnownStatus,
      error: error instanceof Error ? error.message : String(error),
    });
    deps.save(next);
    throw error;
  }

  await faultPause(deps, target.id);

  next = forgetTask(next, target.id);
  next = clearPending(next, target.id, 'refund');
  deps.save(next);
  deps.log?.(`refunded ${target.id} (${result.txHash})`);
  return { state: next, outcome: 'confirmed' };
}
