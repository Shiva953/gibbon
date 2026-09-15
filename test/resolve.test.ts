import { describe, expect, test } from 'bun:test';
import { GibworkApiError } from '@gibwork/sdk';
import type { GibworkClient, TaskDetails } from '@gibwork/sdk';
import { resolveOperation } from '../src/lib/resolve.js';
import { hashEntry } from '../src/lib/state.js';
import type { BountyEntry, PendingOperation, SyncState } from '../src/types.js';

const entry: BountyEntry = {
  id: 'fix-142',
  title: 'Fix memory leak in parser',
  content: '<p>See #142.</p>',
  tags: ['bug', 'rust'],
  amount: '40.00',
  minSubmission: '5.00',
};

function pending(over: Partial<PendingOperation> = {}): PendingOperation {
  return {
    id: 'fix-142',
    kind: 'create',
    taskId: 'task-1',
    intentId: 'intent-1',
    startedAt: '2026-09-15T10:32:00.000Z',
    ...over,
  };
}

function stateWith(op: PendingOperation, tracked = false): SyncState {
  return {
    version: 1,
    tasks: tracked
      ? { 'fix-142': { taskId: 'task-1', lastAppliedHash: 'h', lastSyncedAt: 't' } }
      : {},
    pending: [op],
  };
}

/** A client whose tasks.get either returns details or throws. */
function clientReturning(result: Partial<TaskDetails> | Error): GibworkClient {
  return {
    tasks: {
      get: async () => {
        if (result instanceof Error) throw result;
        return result as TaskDetails;
      },
    },
  } as unknown as GibworkClient;
}

const notFound = () => new GibworkApiError(404, { message: 'not found' }, 'GET', '/tasks/task-1');

describe('resolveOperation — interrupted create', () => {
  test('404 means it never landed, and apply is unblocked', async () => {
    const op = pending();
    const { state, resolution } = await resolveOperation(
      clientReturning(notFound()),
      stateWith(op),
      op,
      entry,
    );

    expect(resolution.verdict).toBe('never-landed');
    expect(resolution.cleared).toBe(true);
    expect(state.pending).toHaveLength(0);
    expect(state.tasks['fix-142']).toBeUndefined();
  });

  test('status "creating" KEEPS blocking — retrying could double-fund', async () => {
    const op = pending();
    const { state, resolution } = await resolveOperation(
      clientReturning({ id: 'task-1', status: 'creating', isOpen: false }),
      stateWith(op),
      op,
      entry,
    );

    expect(resolution.verdict).toBe('in-flight');
    expect(resolution.cleared).toBe(false);
    expect(state.pending).toHaveLength(1); // still blocked, on purpose
  });

  test('a live task is adopted into state and the marker cleared', async () => {
    const op = pending();
    const { state, resolution } = await resolveOperation(
      clientReturning({ id: 'task-1', status: 'in progress', isOpen: true }),
      stateWith(op),
      op,
      entry,
    );

    expect(resolution.verdict).toBe('succeeded');
    expect(state.pending).toHaveLength(0);
    expect(state.tasks['fix-142']?.taskId).toBe('task-1');
    expect(state.tasks['fix-142']?.lastAppliedHash).toBe(hashEntry(entry));
  });

  test('adopts even when the file entry is gone, with an unknown hash', async () => {
    const op = pending();
    const { state } = await resolveOperation(
      clientReturning({ id: 'task-1', status: 'in progress', isOpen: true }),
      stateWith(op),
      op,
      undefined, // entry deleted from bounties.yaml
    );

    expect(state.tasks['fix-142']?.taskId).toBe('task-1');
    expect(state.tasks['fix-142']?.lastAppliedHash).toBe('unknown');
  });

  test('a refunded task is treated as rolled back and dropped', async () => {
    const op = pending();
    const { state, resolution } = await resolveOperation(
      clientReturning({ id: 'task-1', status: 'refunded', isOpen: false }),
      stateWith(op, true),
      op,
      entry,
    );

    expect(resolution.verdict).toBe('rolled-back');
    expect(state.pending).toHaveLength(0);
    expect(state.tasks['fix-142']).toBeUndefined();
  });

  test('a marker with no task id never reached the network', async () => {
    const op = pending({ taskId: undefined });
    const { state, resolution } = await resolveOperation(
      clientReturning(new Error('should not be called')),
      stateWith(op),
      op,
      entry,
    );

    expect(resolution.verdict).toBe('never-landed');
    expect(state.pending).toHaveLength(0);
  });
});

describe('resolveOperation — interrupted refund', () => {
  test('a refunded task means the refund landed', async () => {
    const op = pending({ kind: 'refund' });
    const { state, resolution } = await resolveOperation(
      clientReturning({ id: 'task-1', status: 'refunded', isOpen: false }),
      stateWith(op, true),
      op,
    );

    expect(resolution.verdict).toBe('succeeded');
    expect(state.tasks['fix-142']).toBeUndefined();
    expect(state.pending).toHaveLength(0);
  });

  test('a still-open task means the refund did NOT land', async () => {
    const op = pending({ kind: 'refund' });
    const { state, resolution } = await resolveOperation(
      clientReturning({ id: 'task-1', status: 'in progress', isOpen: true }),
      stateWith(op, true),
      op,
    );

    expect(resolution.verdict).toBe('never-landed');
    expect(state.pending).toHaveLength(0);
    // Still tracked, so the next plan will propose the refund again.
    expect(state.tasks['fix-142']?.taskId).toBe('task-1');
  });

  test('404 means the refund completed', async () => {
    const op = pending({ kind: 'refund' });
    const { state, resolution } = await resolveOperation(
      clientReturning(notFound()),
      stateWith(op, true),
      op,
    );

    expect(resolution.verdict).toBe('succeeded');
    expect(state.tasks['fix-142']).toBeUndefined();
  });
});

describe('resolveOperation — failure handling', () => {
  test('rethrows a non-404 API error rather than guessing', async () => {
    const op = pending();
    await expect(
      resolveOperation(
        clientReturning(new GibworkApiError(500, {}, 'GET', '/tasks/task-1')),
        stateWith(op),
        op,
        entry,
      ),
    ).rejects.toThrow(GibworkApiError);
  });
});
