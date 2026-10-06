import { describe, expect, test } from 'bun:test';
import type { GibworkClient, WalletSigner } from '@gibwork/sdk';
import {
  execCreate,
  execRefund,
  execUpdate,
  parseFaultPauseMs,
  toCreateInput,
} from '../src/lib/executor.js';
import type { ExecutorDeps } from '../src/lib/executor.js';
import { Pacer } from '../src/lib/pacer.js';
import type { BountyEntry, SyncState } from '../src/types.js';
import { DEFAULT_MINT } from '../src/types.js';

const entry: BountyEntry = {
  id: 'fix-142',
  title: 'Fix memory leak in parser',
  content: '<p>See #142.</p>',
  tags: ['bug', 'rust'],
  amount: '40.00',
  minSubmission: '5.00',
};

const empty: SyncState = { version: 1, tasks: {}, pending: [] };

const prepared = {
  intentId: 'intent-1',
  taskId: 'task-1',
  serializedTransaction: 'BASE64TX',
  lastValidBlockHeight: 100,
  paymentQuote: {} as never,
};

/**
 * A harness that records the exact sequence of side effects, so the ordering
 * that makes crash recovery possible can be asserted directly.
 */
function harness(
  taskOverrides: Record<string, unknown> = {},
): { deps: ExecutorDeps; calls: string[]; saved: SyncState[] } {
  const calls: string[] = [];
  const saved: SyncState[] = [];

  const tasks = {
    prepareCreate: async () => {
      calls.push('prepareCreate');
      return prepared;
    },
    submitCreate: async () => {
      calls.push('submitCreate');
      return { taskId: 'task-1', txHash: 'sig-1', status: 'confirmed' as const };
    },
    prepareRefund: async () => {
      calls.push('prepareRefund');
      return { ...prepared, refundQuote: {} as never };
    },
    submitRefund: async () => {
      calls.push('submitRefund');
      return { taskId: 'task-1', txHash: 'sig-2' };
    },
    update: async () => {
      calls.push('update');
      return {} as never;
    },
    ...taskOverrides,
  };

  let clock = 0;
  const deps: ExecutorDeps = {
    client: { tasks } as unknown as GibworkClient,
    signer: {} as WalletSigner,
    pacer: new Pacer({ sleep: async () => {}, now: () => (clock += 1000) }),
    save: (state) => {
      calls.push(state.pending.length > 0 ? 'save(pending)' : 'save(clean)');
      saved.push(structuredClone(state));
    },
    sign: async () => {
      calls.push('sign');
      return 'SIGNED';
    },
  };

  return { deps, calls, saved };
}

describe('execCreate — the crash barrier', () => {
  test('persists the pending marker BEFORE anything is signed', async () => {
    const { deps, calls } = harness();
    await execCreate(deps, empty, entry);

    // This exact order is the whole safety property.
    expect(calls).toEqual([
      'prepareCreate',
      'save(pending)',
      'sign',
      'submitCreate',
      'save(clean)',
    ]);
    expect(calls.indexOf('save(pending)')).toBeLessThan(calls.indexOf('sign'));
  });

  test('the persisted marker carries the taskId needed to recover', async () => {
    const { deps, saved } = harness();
    await execCreate(deps, empty, entry);

    const atBarrier = saved[0];
    expect(atBarrier?.pending).toHaveLength(1);
    expect(atBarrier?.pending[0]?.taskId).toBe('task-1');
    expect(atBarrier?.pending[0]?.intentId).toBe('intent-1');
    expect(atBarrier?.pending[0]?.kind).toBe('create');
    // Nothing recorded as done yet.
    expect(atBarrier?.tasks).toEqual({});
  });

  test('clears the marker and records the task once confirmed', async () => {
    const { deps } = harness();
    const result = await execCreate(deps, empty, entry);

    expect(result.outcome).toBe('confirmed');
    expect(result.state.pending).toHaveLength(0);
    expect(result.state.tasks['fix-142']?.taskId).toBe('task-1');
  });

  test('status "processing" is NOT success — the marker stays', async () => {
    const { deps } = harness({
      submitCreate: async () => ({ taskId: 'task-1', status: 'processing' as const }),
    });
    const result = await execCreate(deps, empty, entry);

    expect(result.outcome).toBe('unresolved');
    expect(result.state.pending).toHaveLength(1);
    expect(result.state.pending[0]?.lastKnownStatus).toBe('processing');
    expect(result.state.tasks['fix-142']).toBeUndefined();
  });

  test('a failed submit leaves a recoverable marker on disk', async () => {
    const { deps, saved } = harness({
      submitCreate: async () => {
        throw new Error('socket hang up');
      },
    });

    await expect(execCreate(deps, empty, entry)).rejects.toThrow('socket hang up');

    // The last thing written must still name the task, or the funds are orphaned.
    const last = saved.at(-1);
    expect(last?.pending).toHaveLength(1);
    expect(last?.pending[0]?.taskId).toBe('task-1');
    expect(last?.pending[0]?.lastKnownStatus).toBe('submit-failed');
    expect(last?.pending[0]?.error).toMatch(/socket hang up/);
  });

  test('never submits the same intent twice', async () => {
    const { deps, calls } = harness();
    await execCreate(deps, empty, entry);
    expect(calls.filter((c) => c === 'submitCreate')).toHaveLength(1);
  });

  test('announces the submit only once the marker is on disk and the tx is signed', async () => {
    const { deps, calls } = harness();
    deps.log = (message) => calls.push(`log: ${message}`);
    await execCreate(deps, empty, entry);

    // A kill after this line is always recoverable through `status`.
    expect(calls).toEqual([
      'prepareCreate',
      'save(pending)',
      'sign',
      'log: … submitting fix-142',
      'submitCreate',
      'save(clean)',
      'log: created fix-142 -> task-1',
    ]);
  });
});

describe('fault pause (GIBBON_FAULT_PAUSE_MS) — the crash-test window', () => {
  test('holds AFTER the submit and BEFORE anything is recorded', async () => {
    const { deps, calls, saved } = harness();
    deps.log = (message) => calls.push(`log: ${message}`);
    deps.faultPauseMs = 8000;
    let savesAtPause = -1;
    deps.pause = async (ms) => {
      calls.push(`pause(${ms})`);
      savesAtPause = saved.length;
    };

    await execCreate(deps, empty, entry);

    expect(calls).toEqual([
      'prepareCreate',
      'save(pending)',
      'sign',
      'log: … submitting fix-142',
      'submitCreate',
      'log: … fault pause 8s: fix-142 submitted, not yet recorded',
      'pause(8000)',
      'save(clean)',
      'log: created fix-142 -> task-1',
    ]);
    // A kill during the pause finds only the pending marker on disk: the
    // funds moved, the task is unrecorded, so apply must refuse and status adopt.
    const onDisk = saved[savesAtPause - 1];
    expect(onDisk?.pending).toHaveLength(1);
    expect(onDisk?.tasks['fix-142']).toBeUndefined();
  });

  test('is off by default: no pause, no extra output', async () => {
    const { deps, calls } = harness();
    deps.log = (message) => calls.push(`log: ${message}`);
    deps.pause = async () => {
      calls.push('pause');
    };

    await execCreate(deps, empty, entry);

    expect(calls).not.toContain('pause');
    expect(calls.some((c) => c.includes('fault pause'))).toBe(false);
  });

  test('applies to refunds too, before the task is forgotten', async () => {
    const { deps, calls } = harness();
    deps.faultPauseMs = 3000;
    deps.pause = async (ms) => {
      calls.push(`pause(${ms})`);
    };
    const tracked: SyncState = {
      version: 1,
      tasks: { 'fix-142': { taskId: 'task-1', lastAppliedHash: 'h', lastSyncedAt: 't' } },
      pending: [],
    };

    await execRefund(deps, tracked, { id: 'fix-142', taskId: 'task-1' });

    expect(calls).toEqual([
      'prepareRefund',
      'save(pending)',
      'sign',
      'submitRefund',
      'pause(3000)',
      'save(clean)',
    ]);
  });
});

describe('parseFaultPauseMs', () => {
  test('unset or empty means off', () => {
    expect(parseFaultPauseMs(undefined)).toBe(0);
    expect(parseFaultPauseMs('')).toBe(0);
    expect(parseFaultPauseMs('  ')).toBe(0);
  });

  test('accepts whole milliseconds in range', () => {
    expect(parseFaultPauseMs('8000')).toBe(8000);
    expect(parseFaultPauseMs(' 0 ')).toBe(0);
    expect(parseFaultPauseMs('60000')).toBe(60000);
  });

  test('rejects anything else as a usage error instead of silently ignoring it', () => {
    for (const bad of ['8s', '-1', '1.5', '60001', 'abc']) {
      expect(() => parseFaultPauseMs(bad)).toThrow(/GIBBON_FAULT_PAUSE_MS/);
    }
  });
});

describe('execUpdate — cheap and unsigned', () => {
  test('signs nothing and writes no pending marker', async () => {
    const { deps, calls } = harness();
    const result = await execUpdate(deps, empty, {
      entry,
      taskId: 'task-1',
      changes: ['content'],
    });

    expect(calls).toEqual(['update', 'save(clean)']);
    expect(calls).not.toContain('sign');
    expect(result.state.pending).toHaveLength(0);
    expect(result.state.tasks['fix-142']?.taskId).toBe('task-1');
  });
});

describe('execRefund', () => {
  test('follows the same barrier ordering as create', async () => {
    const { deps, calls } = harness();
    const tracked: SyncState = {
      version: 1,
      tasks: { 'fix-142': { taskId: 'task-1', lastAppliedHash: 'h', lastSyncedAt: 't' } },
      pending: [],
    };

    const result = await execRefund(deps, tracked, { id: 'fix-142', taskId: 'task-1' });

    expect(calls).toEqual([
      'prepareRefund',
      'save(pending)',
      'sign',
      'submitRefund',
      'save(clean)',
    ]);
    expect(result.state.tasks['fix-142']).toBeUndefined();
    expect(result.state.pending).toHaveLength(0);
  });

  test('announces the refund submit after the marker and the signature', async () => {
    const { deps, calls } = harness();
    deps.log = (message) => calls.push(`log: ${message}`);
    const tracked: SyncState = {
      version: 1,
      tasks: { 'fix-142': { taskId: 'task-1', lastAppliedHash: 'h', lastSyncedAt: 't' } },
      pending: [],
    };

    await execRefund(deps, tracked, { id: 'fix-142', taskId: 'task-1' });

    expect(calls.slice(0, 5)).toEqual([
      'prepareRefund',
      'save(pending)',
      'sign',
      'log: … submitting fix-142 (refund)',
      'submitRefund',
    ]);
  });
});

describe('toCreateInput', () => {
  test('maps an entry onto the SDK payload, resolving defaults', () => {
    expect(toCreateInput(entry)).toEqual({
      title: 'Fix memory leak in parser',
      content: '<p>See #142.</p>',
      tags: ['bug', 'rust'],
      payment: { mintAddress: DEFAULT_MINT, amount: '40.00' },
      minSubmissionAmount: '5.00',
    });
  });

  test('defaults minSubmissionAmount to the full amount', () => {
    const input = toCreateInput({ ...entry, minSubmission: undefined });
    expect(input.minSubmissionAmount).toBe('40.00');
  });
});
