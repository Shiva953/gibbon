import { GibworkAmbiguousSubmitError, signPreparedTransaction } from '@gibwork/sdk';
import type { CreateTaskInput, GibworkClient, UpdateTaskInput, WalletSigner } from '@gibwork/sdk';
import type { BountyEntry, Plan, PlannedUpdate, SyncState } from '../types.js';
import { resolveEntry } from './normalize.js';
import type { Pacer } from './pacer.js';
import { clearPending, forgetTask, markPending, recordTask } from './state.js';

/** Everything an executor needs. Injectable so tests can drive it offline. */
export interface ExecutorDeps {
  client: GibworkClient;
  signer: WalletSigner;
  pacer: Pacer;
  /** Persist state. Separated from the logic so tests can observe every write. */
  save: (state: SyncState) => void;
  /**
   * Transaction signing. Injectable so tests can assert the ordering that makes
   * this safe — that the pending marker reaches disk BEFORE a signature exists.
   */
  sign?: (serializedTransaction: string, signer: WalletSigner) => Promise<string>;
  /** Cancellation. Aborting before a submit is safe; after it, `status` recovers. */
  signal?: AbortSignal;
  log?: (message: string) => void;
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
 * Update: one HTTP call, no transaction, no funds.
 *
 * Deliberately has no pending marker. `tasks.update` signs nothing, so a failed
 * or interrupted update is safe to simply run again on the next apply — there
 * is no ambiguous middle state to protect against.
 */
export async function execUpdate(
  deps: ExecutorDeps,
  state: SyncState,
  planned: PlannedUpdate,
): Promise<ExecResult> {
  await deps.client.tasks.update(planned.taskId, toUpdateInput(planned), req(deps));

  const next = recordTask(state, planned.entry.id, planned.taskId, planned.entry);
  deps.save(next);
  deps.log?.(`updated ${planned.entry.id} (${planned.changes.join(', ')})`);
  return { state: next, outcome: 'confirmed' };
}

/**
 * Create: prepare -> persist -> sign -> submit -> settle.
 *
 * The ordering is the entire point. `prepareCreate` hands back the taskId
 * before any funds move, and we write that to disk BEFORE a signature exists.
 * `CreateTaskInput` carries no idempotency key, so without that marker a
 * process killed after submit would leave a funded bounty whose UUID exists
 * nowhere locally, and the next run would happily fund a second one.
 */
export async function execCreate(
  deps: ExecutorDeps,
  state: SyncState,
  entry: BountyEntry,
): Promise<ExecResult> {
  // (1) PREPARE — no funds move. Yields taskId + intentId.
  await deps.pacer.prepare();
  const prepared = await deps.client.tasks.prepareCreate(toCreateInput(entry), req(deps));

  // (2) BARRIER — reach the disk before a signature exists anywhere.
  const marker = {
    id: entry.id,
    kind: 'create' as const,
    taskId: prepared.taskId,
    intentId: prepared.intentId,
    startedAt: new Date().toISOString(),
  };
  let next = markPending(state, marker);
  deps.save(next);

  // (3) SIGN — local only, no network.
  const sign = deps.sign ?? signPreparedTransaction;
  const signedTransaction = await sign(prepared.serializedTransaction, deps.signer);

  // (4) SUBMIT — funds move here.
  await deps.pacer.submit();
  let result;
  try {
    result = await deps.client.tasks.submitCreate(prepared.intentId, signedTransaction, req(deps));
  } catch (error) {
    // Ambiguous means we genuinely do not know whether it landed. Keep the
    // marker and surface it; never retry, that is how duplicates happen.
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

  // (5) SETTLE — 'processing' is not success.
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
 * Funds move out of escrow here, so it gets identical crash protection.
 */
export async function execRefund(
  deps: ExecutorDeps,
  state: SyncState,
  target: Plan['toRefund'][number],
): Promise<ExecResult> {
  await deps.pacer.prepare();
  const prepared = await deps.client.tasks.prepareRefund(target.taskId, req(deps));

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

  next = forgetTask(next, target.id);
  next = clearPending(next, target.id, 'refund');
  deps.save(next);
  deps.log?.(`refunded ${target.id} (${result.txHash})`);
  return { state: next, outcome: 'confirmed' };
}
