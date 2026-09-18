import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearPending,
  emptyState,
  forgetTask,
  hashEntry,
  loadState,
  markPending,
  recordTask,
  saveState,
  stateFilePath,
} from '../src/lib/state.js';
import { diffLines } from '../src/lib/render.js';
import type { BountyEntry } from '../src/types.js';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'gibwork-sync-test-'));
}

const entry: BountyEntry = {
  id: 'fix-142',
  title: 'Fix memory leak in parser',
  content: '<p>See #142.</p>',
  tags: ['bug', 'rust'],
  amount: '40.00',
  minSubmission: '5.00',
};

describe('hashEntry', () => {
  test('is stable across repeated calls', () => {
    expect(hashEntry(entry)).toBe(hashEntry({ ...entry }));
  });

  test('ignores tag ordering', () => {
    expect(hashEntry({ ...entry, tags: ['rust', 'bug'] })).toBe(hashEntry(entry));
  });

  test('ignores the local-only issue reference', () => {
    // `issue` is never sent to Gibwork, so editing it must not read as drift.
    expect(hashEntry({ ...entry, issue: '#999' })).toBe(hashEntry(entry));
  });

  test('changes when a Gibwork-visible field changes', () => {
    expect(hashEntry({ ...entry, content: '<p>Rewritten.</p>' })).not.toBe(hashEntry(entry));
    expect(hashEntry({ ...entry, amount: '41.00' })).not.toBe(hashEntry(entry));
  });
});

describe('state file', () => {
  test('returns an empty state when the file does not exist', () => {
    const state = loadState(scratch());
    expect(state).toEqual(emptyState());
  });

  test('round-trips through disk', () => {
    const cwd = scratch();
    const saved = recordTask(emptyState(), 'fix-142', 'uuid-1', entry);
    saveState(saved, cwd);

    const loaded = loadState(cwd);
    expect(loaded.tasks['fix-142']?.taskId).toBe('uuid-1');
    expect(loaded.tasks['fix-142']?.lastAppliedHash).toBe(hashEntry(entry));
  });

  test('writes valid, human-readable JSON', () => {
    const cwd = scratch();
    saveState(recordTask(emptyState(), 'fix-142', 'uuid-1', entry), cwd);
    const raw = readFileSync(stateFilePath(cwd), 'utf8');
    expect(raw).toEndWith('\n');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test('rejects a state file it did not write', () => {
    const cwd = scratch();
    saveState(emptyState(), cwd);
    writeFileSync(stateFilePath(cwd), JSON.stringify({ version: 99 }), 'utf8');
    expect(() => loadState(cwd)).toThrow(/not a gibwork-sync v1 state file/);
  });

  test('rejects a corrupt state file with a recoverable message', () => {
    const cwd = scratch();
    saveState(emptyState(), cwd);
    writeFileSync(stateFilePath(cwd), '{ not json', 'utf8');
    expect(() => loadState(cwd)).toThrow(/not valid JSON/);
  });
});

describe('pending operations', () => {
  test('markPending records an unresolved operation', () => {
    const state = markPending(emptyState(), {
      id: 'fix-142',
      kind: 'create',
      startedAt: new Date().toISOString(),
    });
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0]?.id).toBe('fix-142');
  });

  test('markPending replaces rather than duplicates the same id+kind', () => {
    let state = markPending(emptyState(), {
      id: 'fix-142',
      kind: 'create',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    state = markPending(state, {
      id: 'fix-142',
      kind: 'create',
      startedAt: '2026-01-02T00:00:00.000Z',
      intentId: 'intent-1',
    });
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0]?.intentId).toBe('intent-1');
  });

  test('clearPending only clears the matching operation', () => {
    let state = markPending(emptyState(), { id: 'a', kind: 'create', startedAt: 'x' });
    state = markPending(state, { id: 'b', kind: 'refund', startedAt: 'x' });
    state = clearPending(state, 'a', 'create');
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0]?.id).toBe('b');
  });

  test('a pending marker survives a save/load cycle', () => {
    // The whole point: a killed process must leave this behind on disk.
    const cwd = scratch();
    saveState(markPending(emptyState(), { id: 'fix-142', kind: 'create', startedAt: 'x' }), cwd);
    expect(loadState(cwd).pending).toHaveLength(1);
  });
});

describe('forgetTask', () => {
  test('drops a task after a confirmed refund', () => {
    const state = forgetTask(recordTask(emptyState(), 'fix-142', 'uuid-1', entry), 'fix-142');
    expect(state.tasks['fix-142']).toBeUndefined();
  });
});

describe('diffLines', () => {
  test('marks only the changed line', () => {
    const before = 'a\nb\nc';
    const after = 'a\nB\nc';
    expect(diffLines(before, after)).toEqual(['  a', '- b', '+ B', '  c']);
  });

  test('reports an insertion without rewriting the rest', () => {
    expect(diffLines('a\nc', 'a\nb\nc')).toEqual(['  a', '+ b', '  c']);
  });

  test('reports a deletion', () => {
    expect(diffLines('a\nb\nc', 'a\nc')).toEqual(['  a', '- b', '  c']);
  });

  test('identical input produces no +/- lines', () => {
    const diff = diffLines('a\nb', 'a\nb');
    expect(diff.some((l) => l.startsWith('+') || l.startsWith('-'))).toBe(false);
  });
});
