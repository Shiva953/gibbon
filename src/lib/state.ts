import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  BountyEntry,
  Environment,
  PendingOperation,
  SyncState,
  TrackedTask,
} from '../types.js';
import { DEFAULT_MINT } from '../types.js';

export const STATE_DIR = '.gibwork';
export const STATE_FILE = 'state.json';

export function stateFilePath(cwd: string = process.cwd()): string {
  return resolve(join(cwd, STATE_DIR, STATE_FILE));
}

export function emptyState(): SyncState {
  return { version: 1, tasks: {}, pending: [] };
}

/**
 * Hash of the Gibwork-relevant fields of an entry.
 *
 * `id` and `issue` are deliberately excluded: `id` is the lookup key rather
 * than content, and `issue` is a local cross-reference that is never sent to
 * Gibwork, so editing it must not show up as drift. Keys are sorted so the
 * hash does not depend on YAML key order.
 */
export function hashEntry(entry: BountyEntry): string {
  const canonical = {
    title: entry.title,
    content: entry.content,
    tags: [...entry.tags].sort(),
    amount: entry.amount,
    mint: entry.mint ?? DEFAULT_MINT,
    minSubmission: entry.minSubmission ?? null,
    deadline: entry.deadline ?? null,
    allowOnlyVerifiedSubmissions: entry.allowOnlyVerifiedSubmissions ?? false,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads state.json, returning a fresh empty state if it does not exist. */
export function loadState(cwd: string = process.cwd()): SyncState {
  const path = stateFilePath(cwd);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    if (isRecord(cause) && cause['code'] === 'ENOENT') return emptyState();
    throw cause;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `${path} is not valid JSON. Fix or delete it, then re-run \`gibwork-sync import\` to rebuild it.`,
    );
  }

  if (!isRecord(parsed) || parsed['version'] !== 1) {
    throw new Error(`${path} is not a gibwork-sync v1 state file.`);
  }

  const tasks = isRecord(parsed['tasks']) ? (parsed['tasks'] as Record<string, TrackedTask>) : {};
  const pending = Array.isArray(parsed['pending']) ? (parsed['pending'] as PendingOperation[]) : [];

  return {
    version: 1,
    ...(typeof parsed['wallet'] === 'string' ? { wallet: parsed['wallet'] } : {}),
    ...(parsed['environment'] === 'production' || parsed['environment'] === 'stage'
      ? { environment: parsed['environment'] as Environment }
      : {}),
    tasks,
    pending,
  };
}

/**
 * Writes state.json atomically (temp file + rename), so a process killed
 * mid-write cannot leave a half-written state file behind. That matters here:
 * this file is the only record of what an interrupted apply was doing.
 */
export function saveState(state: SyncState, cwd: string = process.cwd()): void {
  const path = stateFilePath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

/** Records that a write operation is about to start. Call BEFORE signing. */
export function markPending(state: SyncState, operation: PendingOperation): SyncState {
  const pending = state.pending.filter(
    (p) => !(p.id === operation.id && p.kind === operation.kind),
  );
  return { ...state, pending: [...pending, operation] };
}

/** Clears a pending marker once the operation reached a confirmed end state. */
export function clearPending(
  state: SyncState,
  id: string,
  kind: PendingOperation['kind'],
): SyncState {
  return { ...state, pending: state.pending.filter((p) => !(p.id === id && p.kind === kind)) };
}

/**
 * Records a confirmed create/update so future runs can detect drift.
 *
 * `entry` is optional because `status` may adopt a task whose file entry has
 * since been deleted. In that case there is nothing to hash, and the mapping
 * itself is the part worth keeping.
 */
export function recordTask(
  state: SyncState,
  id: string,
  taskId: string,
  entry?: BountyEntry,
): SyncState {
  const tracked: TrackedTask = {
    taskId,
    lastAppliedHash: entry ? hashEntry(entry) : 'unknown',
    lastSyncedAt: new Date().toISOString(),
  };
  return { ...state, tasks: { ...state.tasks, [id]: tracked } };
}

/** Drops a task from tracking after a confirmed refund. */
export function forgetTask(state: SyncState, id: string): SyncState {
  const tasks = { ...state.tasks };
  delete tasks[id];
  return { ...state, tasks };
}

/**
 * Guards against reading one wallet's or environment's state as another's.
 *
 * Without this, running `--environment production` against a stage state file
 * would show every tracked task as missing from live, and every file entry as
 * needing creation — a plan that could refund or duplicate real bounties.
 */
export function assertStateMatches(
  state: SyncState,
  wallet: string,
  environment: Environment,
): void {
  if (state.wallet && state.wallet !== wallet) {
    throw new Error(
      `.gibwork/state.json belongs to wallet ${state.wallet}, but the configured ` +
        `wallet is ${wallet}. Use the original wallet, or start from a separate directory.`,
    );
  }
  if (state.environment && state.environment !== environment) {
    throw new Error(
      `.gibwork/state.json was written against ${state.environment}, but this run targets ` +
        `${environment}. Stage and production state must never be mixed.`,
    );
  }
}

/** Records which wallet and environment this state file belongs to. */
export function stampState(
  state: SyncState,
  wallet: string,
  environment: Environment,
): SyncState {
  return { ...state, wallet, environment };
}
