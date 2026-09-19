import { describe, expect, test } from 'bun:test';
import type { TaskDetails } from '@gibwork/sdk';
import { slugify, toEntry } from '../src/commands/import.js';
import { computePlan } from '../src/lib/diff.js';
import { toLiveTask } from '../src/lib/normalize.js';
import { hashEntry } from '../src/lib/state.js';
import type { SyncState } from '../src/types.js';
import { DEFAULT_MINT, isNoOp } from '../src/types.js';

/**
 * Shaped from a real stage response observed on 2026-09-18 — note the two
 * different units on the same object, and the server-assigned deadline we
 * never sent.
 */
function details(over: Partial<TaskDetails> = {}): TaskDetails {
  return {
    id: 'fcfb7a61-edd5-42f7-ad2e-59ae229bbac9',
    title: 'gibwork-sync probe A',
    content: '<p>Test bounty for gibwork-sync. Please do not submit.</p>',
    tags: ['test'],
    status: 'CREATED',
    isOpen: true,
    deadline: '2026-09-18T11:27:22.001Z',
    allowOnlyVerifiedSubmissions: false,
    minSubmissionAmount: 1,
    asset: { mintAddress: DEFAULT_MINT, amount: '1000000', decimals: 6 },
    ...over,
  } as unknown as TaskDetails;
}

describe('slugify', () => {
  test('derives a readable, stable id from the title', () => {
    expect(slugify('gibwork-sync probe A')).toBe('gibwork-sync-probe-a');
    expect(slugify('Fix memory leak in parser!')).toBe('fix-memory-leak-in-parser');
  });

  test('never produces an empty or trailing-dash id', () => {
    expect(slugify('!!!')).toBe('bounty');
    expect(slugify('a'.repeat(80))).toHaveLength(40);
    expect(slugify('word ---')).toBe('word');
  });
});

describe('import round-trip', () => {
  test('a generated entry reports zero changes against the task it came from', () => {
    // The whole point of import: what it writes must already agree with live
    // state, or adopting the tool proposes work that should not happen.
    const d = details();
    const live = toLiveTask(d);
    const entry = toEntry('gibwork-sync-probe-a', d, live);

    const state: SyncState = {
      version: 1,
      tasks: {
        'gibwork-sync-probe-a': {
          taskId: live.taskId,
          lastAppliedHash: hashEntry(entry),
          lastSyncedAt: 't',
        },
      },
      pending: [],
    };

    const plan = computePlan({ desired: [entry], live: [live], state });
    expect(isNoOp(plan)).toBe(true);
    expect(plan.blocked).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(1);
  });

  test('converts base units to a whole-token amount', () => {
    const d = details();
    expect(toEntry('x', d, toLiveTask(d)).amount).toBe('1');
  });

  test('omits the server-assigned deadline so it stays unmanaged', () => {
    const d = details();
    expect(toEntry('x', d, toLiveTask(d)).deadline).toBeUndefined();
  });

  test('records a non-default mint, and omits the default one', () => {
    const usdc = details();
    expect(toEntry('x', usdc, toLiveTask(usdc)).mint).toBeUndefined();

    const other = details({
      asset: { mintAddress: 'So11111111111111111111111111111111111111112', amount: '2000000', decimals: 6 },
    } as Partial<TaskDetails>);
    expect(toEntry('x', other, toLiveTask(other)).mint).toBe(
      'So11111111111111111111111111111111111111112',
    );
  });

  test('records verified-only when the task requires it', () => {
    const d = details({ allowOnlyVerifiedSubmissions: true } as Partial<TaskDetails>);
    const entry = toEntry('x', d, toLiveTask(d));
    expect(entry.allowOnlyVerifiedSubmissions).toBe(true);
    const state: SyncState = {
      version: 1,
      tasks: { x: { taskId: d.id, lastAppliedHash: hashEntry(entry), lastSyncedAt: 't' } },
      pending: [],
    };
    expect(isNoOp(computePlan({ desired: [entry], live: [toLiveTask(d)], state }))).toBe(true);
  });
});
