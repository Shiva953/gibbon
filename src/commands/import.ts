import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GibworkClient, TaskDetails, WalletTaskSummary } from '@gibwork/sdk';
import { computePlan } from '../lib/diff.js';
import { CliError, EXIT } from '../lib/errors.js';
import { listAllSummaries } from '../lib/live.js';
import { formatAmount, formatBaseUnits, toLiveTask } from '../lib/normalize.js';
import { emitJson } from '../lib/render.js';
import { assertStateMatches, hashEntry, loadState, saveState, stampState } from '../lib/state.js';
import { parseBounties, saveBounties } from '../lib/yaml.js';
import type { Runtime } from '../runtime.js';
import type { BountyEntry, LiveTask, SyncState } from '../types.js';
import { DEFAULT_MINT, isNoOp } from '../types.js';

export interface ImportOptions {
  file: string;
  /** Overwrite a non-empty bounties.yaml. */
  force?: boolean;
}

/** A readable, stable key derived from the title. Never the Gibwork UUID. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'bounty';
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Builds a file entry that round-trips to zero drift. Only fields the diff
 * compares are written; `deadline` is omitted because Gibwork assigns one at
 * creation and an omitted optional field is unmanaged.
 */
export function toEntry(id: string, details: TaskDetails, live: LiveTask): BountyEntry {
  const entry: BountyEntry = {
    id,
    title: live.title,
    content: live.content,
    tags: live.tags,
    amount: formatBaseUnits(details.asset?.amount, details.asset?.decimals) ?? '0',
  };

  const minSubmission = formatAmount(details.minSubmissionAmount);
  if (minSubmission !== null) entry.minSubmission = minSubmission;
  if (live.mint && live.mint !== DEFAULT_MINT) entry.mint = live.mint;
  if (live.allowOnlyVerifiedSubmissions) entry.allowOnlyVerifiedSubmissions = true;

  return entry;
}

function fileHasContent(path: string): boolean {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return false;
  try {
    return parseBounties(readFileSync(absolute, 'utf8'), path).length > 0;
  } catch {
    return true; // unparseable but present: still refuse to clobber it
  }
}

/**
 * Generates bounties.yaml and .gibwork/state.json from this wallet's live
 * tasks, so an existing creator can adopt gibwork-sync without a hand-written
 * file — which would otherwise plan `+ create` over bounties that already
 * exist and fund duplicates.
 *
 * Self-checking: the generated file is diffed against the live state it came
 * from, and anything but a no-op is reported rather than written.
 */
export async function importCommand(runtime: Runtime, options: ImportOptions): Promise<void> {
  const { client, walletAddress, environment, signal, output } = runtime;

  const existing = loadState();
  assertStateMatches(existing, walletAddress, environment);

  if (!options.force && fileHasContent(options.file)) {
    throw new CliError(
      `${options.file} already has entries. Importing would overwrite them. ` +
        'Move it aside, or pass --force.',
      'USAGE_ERROR',
      EXIT.USAGE,
    );
  }

  if (!output.json && !output.quiet) {
    process.stdout.write(`\nwallet ${walletAddress}  ·  ${environment}\n\nReading live tasks...\n`);
  }

  const summaries = await listAllSummaries(client, signal);
  const candidates = summaries.filter((task) => task.isOpen && task.canEdit);

  const entries: BountyEntry[] = [];
  const live: LiveTask[] = [];
  const taken = new Set<string>();
  let state: SyncState = stampState(existing, walletAddress, environment);

  for (const summary of candidates) {
    const details = await fetchDetails(client, summary, signal);
    const liveTask = toLiveTask(details, summary);
    const id = uniqueId(slugify(liveTask.title), taken);
    taken.add(id);

    const entry = toEntry(id, details, liveTask);
    entries.push(entry);
    live.push(liveTask);

    state = {
      ...state,
      tasks: {
        ...state.tasks,
        [id]: {
          taskId: liveTask.taskId,
          lastAppliedHash: hashEntry(entry),
          lastSyncedAt: new Date().toISOString(),
        },
      },
    };

    if (!output.json && !output.quiet) {
      process.stdout.write(`  ${id.padEnd(28)} ${entry.amount.padStart(10)}  (${liveTask.taskId.slice(0, 8)})\n`);
    }
  }

  // What we write must already agree with live state, or the import is lossy.
  const check = computePlan({ desired: entries, live, state });
  if (!isNoOp(check) || check.blocked.length > 0) {
    throw new CliError(
      'The generated file does not round-trip to zero changes, so nothing was written.\n' +
        `  would create ${check.toCreate.length}, update ${check.toUpdate.length}, ` +
        `refund ${check.toRefund.length}, blocked ${check.blocked.length}\n` +
        '  This is a bug in gibwork-sync — please report it with your task list.',
      'PROTOCOL_ERROR',
      EXIT.INTERNAL,
    );
  }

  saveBounties(options.file, entries);
  saveState(state);

  if (output.json) {
    emitJson({
      wallet: walletAddress,
      environment,
      imported: entries.length,
      skipped: summaries.length - candidates.length,
      file: options.file,
      ids: entries.map((entry) => entry.id),
    });
    return;
  }

  const skipped = summaries.length - candidates.length;
  process.stdout.write(
    `\nImported ${entries.length} bounty(s) into ${options.file}` +
      (skipped > 0 ? `, skipped ${skipped} not open or not editable by this wallet` : '') +
      '.\n' +
      'Verified: the generated file reports zero changes against live state.\n\n' +
      'Run `gibwork-sync plan` to confirm, then edit the file as your source of truth.\n\n',
  );
}

async function fetchDetails(
  client: GibworkClient,
  summary: WalletTaskSummary,
  signal?: AbortSignal,
): Promise<TaskDetails> {
  return client.tasks.get(summary.id, signal ? { signal } : undefined);
}
