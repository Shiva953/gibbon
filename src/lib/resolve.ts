import { GibworkApiError } from '@gibwork/sdk';
import type { GibworkClient, TaskDetails } from '@gibwork/sdk';
import type { BountyEntry, PendingOperation, SyncState } from '../types.js';
import { clearPending, forgetTask, recordTask } from './state.js';

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

/**
 * The SDK exposes intent reads for submissions only, so reading the task back
 * IS the reconciliation — which works because `prepareCreate` handed us the
 * taskId before any funds moved.
 */
function isNotFound(error: unknown): boolean {
  return error instanceof GibworkApiError && error.status === 404;
}

/** Live status strings differ in casing between endpoints, so match loosely. */
function statusIs(details: TaskDetails, needle: string): boolean {
  return String(details.status ?? '').toLowerCase().includes(needle);
}

/** Resolves one interrupted operation. Reads only; never signs or moves funds. */
export async function resolveOperation(
  client: GibworkClient,
  state: SyncState,
  op: PendingOperation,
  entry?: BountyEntry,
  signal?: AbortSignal,
): Promise<{ state: SyncState; resolution: Resolution }> {
  // No taskId means prepare never returned, so nothing can have landed.
  if (!op.taskId) {
    return {
      state: clearPending(state, op.id, op.kind),
      resolution: {
        op,
        verdict: 'never-landed',
        detail: 'no task id was recorded, so the operation never reached the network.',
        cleared: true,
      },
    };
  }

  let details: TaskDetails;
  try {
    details = await client.tasks.get(op.taskId, signal ? { signal } : undefined);
  } catch (error) {
    if (!isNotFound(error)) throw error;

    // 404: the task id was allocated at prepare but never funded.
    if (op.kind === 'refund') {
      return {
        state: clearPending(forgetTask(state, op.id), op.id, op.kind),
        resolution: {
          op,
          verdict: 'succeeded',
          detail: 'task no longer exists, so the refund completed.',
          cleared: true,
        },
      };
    }
    return {
      state: clearPending(state, op.id, op.kind),
      resolution: {
        op,
        verdict: 'never-landed',
        detail: 'task was never created. Safe to apply again.',
        cleared: true,
      },
    };
  }

  // Funding has not confirmed. The one case that must keep blocking:
  // retrying now could fund the same bounty twice.
  if (statusIs(details, 'creating')) {
    return {
      state,
      resolution: {
        op,
        verdict: 'in-flight',
        detail: `still settling (status: ${details.status}). Re-run status in a minute.`,
        cleared: false,
      },
    };
  }

  if (op.kind === 'refund') {
    if (statusIs(details, 'refunded') || !details.isOpen) {
      return {
        state: clearPending(forgetTask(state, op.id), op.id, op.kind),
        resolution: {
          op,
          verdict: 'succeeded',
          detail: `refund landed (status: ${details.status}).`,
          cleared: true,
        },
      };
    }
    return {
      state: clearPending(state, op.id, op.kind),
      resolution: {
        op,
        verdict: 'never-landed',
        detail: 'task is still open, so the refund did not land. Safe to apply again.',
        cleared: true,
      },
    };
  }

  // create
  if (statusIs(details, 'refunded')) {
    return {
      state: clearPending(forgetTask(state, op.id), op.id, op.kind),
      resolution: {
        op,
        verdict: 'rolled-back',
        detail: 'the created task was refunded. Safe to apply again.',
        cleared: true,
      },
    };
  }

  return {
    state: clearPending(recordTask(state, op.id, op.taskId, entry), op.id, op.kind),
    resolution: {
      op,
      verdict: 'succeeded',
      detail: `task exists (status: ${details.status}). Adopted into state.`,
      cleared: true,
    },
  };
}
