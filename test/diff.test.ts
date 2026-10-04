import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computePlan } from '../src/lib/diff.js';
import { formatBaseUnits, toLiveTask } from '../src/lib/normalize.js';
import { BountyFileError, parseBounties } from '../src/lib/yaml.js';
import type { BountyEntry, LiveTask, SyncState } from '../src/types.js';
import { DEFAULT_MINT } from '../src/types.js';

const fixture = readFileSync(join(import.meta.dir, 'fixtures/bounties.sample.yaml'), 'utf8');

/* ---------- builders: one canonical bounty, varied per test ---------- */

function entry(over: Partial<BountyEntry> = {}): BountyEntry {
  return {
    id: 'fix-142',
    title: 'Fix memory leak in parser',
    content: '<p>See #142.</p>',
    tags: ['bug', 'rust'],
    amount: '40.00',
    minSubmission: '5.00',
    ...over,
  };
}

function live(over: Partial<LiveTask> = {}): LiveTask {
  return {
    taskId: 'uuid-1',
    title: 'Fix memory leak in parser',
    content: '<p>See #142.</p>',
    tags: ['bug', 'rust'],
    amount: '40',
    mint: DEFAULT_MINT,
    minSubmission: '5',
    deadline: null,
    allowOnlyVerifiedSubmissions: false,
    isOpen: true,
    status: 'in progress',
    canRefund: true,
    ...over,
  };
}

function tracking(id = 'fix-142', taskId = 'uuid-1'): SyncState {
  return {
    version: 1,
    tasks: { [id]: { taskId, lastAppliedHash: 'hash', lastSyncedAt: '2026-09-15T00:00:00.000Z' } },
    pending: [],
  };
}

const empty: SyncState = { version: 1, tasks: {}, pending: [] };

/* ---------- the reconciliation rules ---------- */

describe('computePlan', () => {
  test('creates an entry that is in the file with no state mapping', () => {
    const plan = computePlan({ desired: [entry()], live: [], state: empty });
    expect(plan.toCreate.map((e) => e.id)).toEqual(['fix-142']);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toRefund).toHaveLength(0);
  });

  test('leaves an entry unchanged when it matches the live task', () => {
    const plan = computePlan({ desired: [entry()], live: [live()], state: tracking() });
    expect(plan.unchanged.map((e) => e.id)).toEqual(['fix-142']);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.blocked).toHaveLength(0);
  });

  test('updates when only content drifts', () => {
    const plan = computePlan({
      desired: [entry({ content: '<p>Rewritten.</p>' })],
      live: [live()],
      state: tracking(),
    });
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]?.changes).toEqual(['content']);
    expect(plan.toUpdate[0]?.taskId).toBe('uuid-1');
  });

  test('a server-assigned deadline is not drift when the file omits it', () => {
    // Verified live on 2026-09-18: creating with no deadline returns one
    // anyway (createdAt + 45m). Diffing it produced an update that could
    // never converge, because apply sends no deadline for an undefined field.
    const plan = computePlan({
      desired: [entry({ deadline: undefined })],
      live: [live({ deadline: '2026-09-18T11:27:22.001Z' })],
      state: tracking(),
    });
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(1);
  });

  test('an omitted verified-only flag is unmanaged', () => {
    const plan = computePlan({
      desired: [entry({ allowOnlyVerifiedSubmissions: undefined })],
      live: [live({ allowOnlyVerifiedSubmissions: true })],
      state: tracking(),
    });
    expect(plan.toUpdate).toHaveLength(0);
  });

  test('but a deadline the file DOES state is still enforced', () => {
    const plan = computePlan({
      desired: [entry({ deadline: '2026-10-01T12:00:00.000Z' })],
      live: [live({ deadline: '2026-09-18T11:27:22.001Z' })],
      state: tracking(),
    });
    expect(plan.toUpdate[0]?.changes).toEqual(['deadline']);
  });

  test('updates when deadline or verified-only drift', () => {
    const plan = computePlan({
      desired: [entry({ deadline: '2026-10-01T12:00:00.000Z', allowOnlyVerifiedSubmissions: true })],
      live: [live()],
      state: tracking(),
    });
    expect(plan.toUpdate[0]?.changes.sort()).toEqual([
      'allowOnlyVerifiedSubmissions',
      'deadline',
    ]);
  });

  test.each([
    ['title', { title: 'Something else' }],
    ['amount', { amount: '75.00' }],
    ['tags', { tags: ['bug'] }],
    ['minSubmission', { minSubmission: '10.00' }],
  ])('blocks an immutable change to %s', (field, override) => {
    const plan = computePlan({
      desired: [entry(override as Partial<BountyEntry>)],
      live: [live()],
      state: tracking(),
    });
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]?.fields).toContain(field);
    expect(plan.blocked[0]?.reason).toMatch(/cannot be changed/);
  });

  test('blocks when a tracked task is not visible to the wallet', () => {
    // Recreating here could fund a second bounty — there is no idempotency key.
    const plan = computePlan({ desired: [entry()], live: [], state: tracking() });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]?.reason).toMatch(/was not returned by this wallet/);
  });

  test('blocks rather than recreating a completed or refunded task', () => {
    const plan = computePlan({
      desired: [entry()],
      live: [live({ isOpen: false, status: 'complete' })],
      state: tracking(),
    });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.blocked[0]?.reason).toMatch(/no longer open \(status: complete\)/);
  });

  test('refunds a tracked task that was deleted from the file', () => {
    const plan = computePlan({ desired: [], live: [live()], state: tracking() });
    expect(plan.toRefund).toEqual([
      { id: 'fix-142', taskId: 'uuid-1', title: 'Fix memory leak in parser' },
    ]);
  });

  test('never refunds a live task it does not track', () => {
    // This is what makes adopting the tool on an established wallet safe.
    const plan = computePlan({
      desired: [],
      live: [live({ taskId: 'someone-elses-task' })],
      state: empty,
    });
    expect(plan.toRefund).toHaveLength(0);
  });

  test('surfaces an unrefundable task instead of silently dropping it', () => {
    // canRefund goes false while submissions are pending. Skipping quietly
    // would leave the maintainer's funds in escrow with an empty plan.
    const plan = computePlan({
      desired: [],
      live: [live({ canRefund: false })],
      state: tracking(),
    });
    expect(plan.toRefund).toHaveLength(0);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]?.id).toBe('fix-142');
    expect(plan.blocked[0]?.entry).toBeUndefined();
    expect(plan.blocked[0]?.reason).toMatch(/cannot refund it right now/);
  });

  test('stays silent about a removed task that is already closed', () => {
    const plan = computePlan({
      desired: [],
      live: [live({ isOpen: false, status: 'refunded', canRefund: false })],
      state: tracking(),
    });
    expect(plan.toRefund).toHaveLength(0);
    expect(plan.blocked).toHaveLength(0);
  });

  test('ignores live tasks that were never tracked', () => {
    const plan = computePlan({
      desired: [entry()],
      live: [live(), live({ taskId: 'untracked', title: 'Not ours' })],
      state: tracking(),
    });
    expect(plan.unchanged).toHaveLength(1);
    expect(plan.toRefund).toHaveLength(0);
    expect(plan.blocked).toHaveLength(0);
  });

  test('handles create, update, refund and block in one plan', () => {
    const state: SyncState = {
      version: 1,
      tasks: {
        'fix-142': { taskId: 'uuid-1', lastAppliedHash: 'h', lastSyncedAt: 't' },
        'old-audit': { taskId: 'uuid-2', lastAppliedHash: 'h', lastSyncedAt: 't' },
        'perf-bench': { taskId: 'uuid-3', lastAppliedHash: 'h', lastSyncedAt: 't' },
      },
      pending: [],
    };
    const plan = computePlan({
      desired: [
        entry({ content: '<p>New copy.</p>' }),
        entry({ id: 'docs-cli', title: 'Docs', amount: '15.00' }),
        entry({ id: 'perf-bench', title: 'Bench', amount: '999.00' }),
      ],
      live: [
        live(),
        live({ taskId: 'uuid-2', title: 'Old audit' }),
        live({ taskId: 'uuid-3', title: 'Bench', amount: '120' }),
      ],
      state,
    });

    expect(plan.toCreate.map((e) => e.id)).toEqual(['docs-cli']);
    expect(plan.toUpdate.map((u) => u.entry.id)).toEqual(['fix-142']);
    expect(plan.toRefund.map((r) => r.id)).toEqual(['old-audit']);
    expect(plan.blocked.map((b) => b.id)).toEqual(['perf-bench']);
  });
});

/* ---------- normalization: where phantom drift would come from ---------- */

describe('normalization', () => {
  test('surrounding whitespace and line endings are not drift', () => {
    const plan = computePlan({
      desired: [entry({ content: '\r\n  <p>See #142.</p>  \r\n' })],
      live: [live({ content: '<p>See #142.</p>' })],
      state: tracking(),
    });
    expect(plan.unchanged).toHaveLength(1);
  });

  test('internal whitespace IS drift, on purpose', () => {
    // Conservative by design: silently swallowing a real content edit is worse
    // than one redundant unsigned update call. See normalize.ts#contentEquals.
    const plan = computePlan({
      desired: [entry({ content: '<p>  See #142.</p>' })],
      live: [live({ content: '<p>See #142.</p>' })],
      state: tracking(),
    });
    expect(plan.toUpdate).toHaveLength(1);
  });

  test('asset.amount is base units; minSubmissionAmount is whole tokens', () => {
    // Verified against the live API on 2026-09-18 for a 1.00 USDC bounty:
    //   asset: { amount: "1000000", decimals: 6 }   <- base units, string
    //   minSubmissionAmount: 1                      <- whole tokens, number
    const live = toLiveTask({
      id: 'uuid-1',
      title: 'gibbon probe A',
      content: '<p>x</p>',
      tags: ['test'],
      status: 'CREATED',
      isOpen: true,
      deadline: null,
      allowOnlyVerifiedSubmissions: false,
      minSubmissionAmount: 1,
      asset: { mintAddress: DEFAULT_MINT, amount: '1000000', decimals: 6 },
    } as never);

    expect(live.amount).toBe('1');
    expect(live.minSubmission).toBe('1');
  });

  test('formatBaseUnits scales by decimals, and refuses to guess', () => {
    expect(formatBaseUnits('1000000', 6)).toBe('1');
    expect(formatBaseUnits('40500000', 6)).toBe('40.5');
    expect(formatBaseUnits(1000000, 6)).toBe('1');
    expect(formatBaseUnits('1000000', undefined)).toBeNull();   // unknown scale -> not reported
    expect(formatBaseUnits(null, 6)).toBeNull();
  });

  test('a 1.00 entry does not drift against its own live task', () => {
    // The exact regression that blocked probe-a: "1.00" vs base-unit "1000000".
    const plan = computePlan({
      desired: [entry({ amount: '1.00', minSubmission: '1.00' })],
      live: [live({ amount: '1', minSubmission: '1' })],
      state: tracking(),
    });
    expect(plan.blocked).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(1);
  });

  test('"40.00" and 40 are the same amount', () => {
    const plan = computePlan({
      desired: [entry({ amount: '40.00' })],
      live: [live({ amount: '40' })],
      state: tracking(),
    });
    expect(plan.blocked).toHaveLength(0);
  });

  test('an omitted minSubmission defaults to the full amount', () => {
    const plan = computePlan({
      desired: [entry({ minSubmission: undefined })],
      live: [live({ minSubmission: '40' })],
      state: tracking(),
    });
    expect(plan.blocked).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(1);
  });

  test('a null mint from the API is not treated as drift', () => {
    const plan = computePlan({
      desired: [entry()],
      live: [live({ mint: null, minSubmission: null })],
      state: tracking(),
    });
    expect(plan.blocked).toHaveLength(0);
  });

  test('tag order does not matter', () => {
    const plan = computePlan({
      desired: [entry({ tags: ['rust', 'bug'] })],
      live: [live({ tags: ['bug', 'rust'] })],
      state: tracking(),
    });
    expect(plan.unchanged).toHaveLength(1);
  });
});

/* ---------- the desired-state half ---------- */

describe('bounties.yaml parsing', () => {
  test('parses the sample file', () => {
    const entries = parseBounties(fixture);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.id).toBe('fix-142');
    expect(entries[1]?.allowOnlyVerifiedSubmissions).toBe(true);
  });

  test('treats an empty file as zero entries', () => {
    expect(parseBounties('')).toEqual([]);
    expect(parseBounties('[]')).toEqual([]);
  });

  test('rejects duplicate ids', () => {
    const raw = '- id: dup\n  title: A\n  content: A\n  tags: []\n  amount: "1.00"\n' +
      '- id: dup\n  title: B\n  content: B\n  tags: []\n  amount: "1.00"\n';
    expect(() => parseBounties(raw)).toThrow(BountyFileError);
    expect(() => parseBounties(raw)).toThrow(/Duplicate id "dup"/);
  });

  test('rejects an unquoted numeric amount', () => {
    // YAML would turn 40.00 into the float 40 and lose precision an escrow
    // amount depends on, so this has to be a hard error.
    const raw = '- id: a\n  title: A\n  content: A\n  tags: []\n  amount: 40.00\n';
    expect(() => parseBounties(raw)).toThrow(/must be a quoted string/);
  });

  test('rejects an amount below the platform minimum', () => {
    // Verified against the stage API: "payment.amount must be between
    // 1.00 and 100000.00 inclusive". Caught at parse time, before any request.
    const raw = '- id: a\n  title: A\n  content: A\n  tags: []\n  amount: "0.50"\n';
    expect(() => parseBounties(raw)).toThrow(/must be between 1.00 and 100000.00/);
  });

  test('rejects an amount above the platform maximum', () => {
    const raw = '- id: a\n  title: A\n  content: A\n  tags: []\n  amount: "100001.00"\n';
    expect(() => parseBounties(raw)).toThrow(/must be between 1.00 and 100000.00/);
  });

  test('accepts the boundaries themselves', () => {
    for (const amount of ['1.00', '100000.00']) {
      const raw = `- id: a\n  title: A\n  content: A\n  tags: []\n  amount: "${amount}"\n`;
      expect(parseBounties(raw)[0]?.amount).toBe(amount);
    }
  });

  test('rejects a top-level mapping instead of a list', () => {
    expect(() => parseBounties('id: a')).toThrow(/top-level list/);
  });

  test('rejects an entry missing a required field', () => {
    expect(() => parseBounties('- id: a\n  title: A\n')).toThrow(/`content` is required/);
  });
});
