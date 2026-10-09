import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_MINT } from '../types.js';
import { CliError, EXIT } from './errors.js';
export const STATE_DIR = '.gibwork';
export const STATE_FILE = 'state.json';
export function stateFilePath(cwd = process.cwd()) {
    return resolve(join(cwd, STATE_DIR, STATE_FILE));
}
export function emptyState() {
    return { version: 1, tasks: {}, pending: [] };
}
/**
 * Hash of the Gibwork-relevant fields of an entry. `id` is the lookup key and
 * `issue` is never sent to Gibwork, so neither counts as drift. Keys are
 * sorted so the hash does not depend on YAML key order.
 */
export function hashEntry(entry) {
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
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Reads state.json, returning a fresh empty state if it does not exist. */
export function loadState(cwd = process.cwd()) {
    const path = stateFilePath(cwd);
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    }
    catch (cause) {
        if (isRecord(cause) && cause['code'] === 'ENOENT')
            return emptyState();
        throw cause;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`${path} is not valid JSON. Fix or delete it, then re-run \`gibbon import\` to rebuild it.`);
    }
    if (!isRecord(parsed) || parsed['version'] !== 1) {
        throw new Error(`${path} is not a gibbon v1 state file.`);
    }
    const tasks = isRecord(parsed['tasks']) ? parsed['tasks'] : {};
    const pending = Array.isArray(parsed['pending']) ? parsed['pending'] : [];
    return {
        version: 1,
        ...(typeof parsed['wallet'] === 'string' ? { wallet: parsed['wallet'] } : {}),
        ...(parsed['environment'] === 'production' || parsed['environment'] === 'stage'
            ? { environment: parsed['environment'] }
            : {}),
        tasks,
        pending,
    };
}
/**
 * Writes state.json atomically (temp file + rename): this is the only record
 * of what an interrupted apply was doing, so it must never be half-written.
 */
export function saveState(state, cwd = process.cwd()) {
    const path = stateFilePath(cwd);
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    renameSync(tmp, path);
}
/** Records that a write operation is about to start. Call BEFORE signing. */
export function markPending(state, operation) {
    const pending = state.pending.filter((p) => !(p.id === operation.id && p.kind === operation.kind));
    return { ...state, pending: [...pending, operation] };
}
/** Clears a pending marker once the operation reached a confirmed end state. */
export function clearPending(state, id, kind) {
    return { ...state, pending: state.pending.filter((p) => !(p.id === id && p.kind === kind)) };
}
/**
 * Records a confirmed create/update so future runs can detect drift. `entry`
 * is optional because `status` may adopt a task whose file entry is gone — the
 * mapping is still worth keeping even with nothing to hash.
 */
export function recordTask(state, id, taskId, entry) {
    const tracked = {
        taskId,
        lastAppliedHash: entry ? hashEntry(entry) : 'unknown',
        lastSyncedAt: new Date().toISOString(),
    };
    return { ...state, tasks: { ...state.tasks, [id]: tracked } };
}
/** Drops a task from tracking after a confirmed refund. */
export function forgetTask(state, id) {
    const tasks = { ...state.tasks };
    delete tasks[id];
    return { ...state, tasks };
}
/**
 * Guards against reading one wallet's or environment's state as another's.
 * Running production against a stage state file would show every tracked task
 * as missing and every entry as new — a plan that could duplicate real bounties.
 */
export function assertStateMatches(state, wallet, environment) {
    // Same guard @gibwork/cli applies before submission recovery, same wording.
    if (state.wallet && state.wallet !== wallet) {
        throw new CliError('Recovery requires the original wallet, environment, and API location. ' +
            `.gibwork/state.json belongs to ${state.wallet}, but this run uses ${wallet}.`, 'RECOVERY_ERROR', EXIT.INTERNAL);
    }
    if (state.environment && state.environment !== environment) {
        throw new CliError('Recovery requires the original wallet, environment, and API location. ' +
            `.gibwork/state.json was written against ${state.environment}, but this run targets ${environment}.`, 'RECOVERY_ERROR', EXIT.INTERNAL);
    }
}
/** Records which wallet and environment this state file belongs to. */
export function stampState(state, wallet, environment) {
    return { ...state, wallet, environment };
}
//# sourceMappingURL=state.js.map