import type { TaskDetails, WalletTaskSummary } from '@gibwork/sdk';
import type { BountyEntry, LiveTask, ResolvedEntry } from '../types.js';
import { DEFAULT_MINT } from '../types.js';

/**
 * Renders a numeric amount as a canonical decimal string.
 *
 * ASSUMPTION, and the one place it lives: `TaskDetails.asset.amount` is in
 * whole tokens (40 means 40 USDC), matching the format `CreateTaskInput`
 * accepts. If it turns out to be base units, only this function changes.
 *
 * The failure mode is benign by construction: `amount` is immutable on a live
 * task, so a wrong reading here can only ever produce a spurious `blocked`
 * warning — noisy, but it can never trigger a refund or a duplicate create.
 */
export function formatAmount(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  // Trim trailing zeros so "40.00", "40.0" and 40 all compare equal.
  return String(Number(n.toFixed(9)));
}

/** Normalizes a decimal string from YAML into the same canonical form. */
export function normalizeAmount(value: string): string {
  return formatAmount(value) ?? value;
}

/**
 * Applies defaults once, so every downstream consumer agrees on what an entry
 * means. `minSubmission` defaults to the full amount — a single-winner bounty,
 * the common shape — because `CreateTaskInput.minSubmissionAmount` is required
 * and silently picking a smaller value would let the pot be fragmented in ways
 * the file never asked for.
 */
export function resolveEntry(entry: BountyEntry): ResolvedEntry {
  return {
    ...entry,
    mint: entry.mint ?? DEFAULT_MINT,
    minSubmission: entry.minSubmission ?? entry.amount,
  };
}

/** Adapts the SDK's TaskDetails (plus its list summary) into a LiveTask. */
export function toLiveTask(details: TaskDetails, summary?: WalletTaskSummary): LiveTask {
  return {
    taskId: details.id,
    title: details.title,
    content: details.content,
    tags: details.tags ?? [],
    amount: formatAmount(details.asset?.amount) ?? '0',
    mint: details.asset?.mintAddress ?? null,
    minSubmission: formatAmount(details.minSubmissionAmount),
    deadline: details.deadline ?? null,
    allowOnlyVerifiedSubmissions: details.allowOnlyVerifiedSubmissions ?? false,
    isOpen: details.isOpen ?? false,
    status: details.status ?? 'unknown',
    canRefund: summary?.canRefund ?? details.isOpen ?? false,
  };
}

/**
 * Compares two HTML content blobs.
 *
 * Deliberately CONSERVATIVE: only line endings and surrounding whitespace are
 * normalized. Internal whitespace stays significant.
 *
 * The temptation is to collapse whitespace between tags, in case the API
 * re-serializes stored HTML and produces permanent phantom drift. But we have
 * not yet confirmed that it does, and the two failure modes are not equally
 * bad. Over-normalizing makes the tool silently ignore a real edit — the
 * maintainer changes their bounty text, `plan` reports "no changes", and the
 * live bounty never updates. Under-normalizing at worst re-applies identical
 * content, which is one free, unsigned `tasks.update` call.
 *
 * Verify against stage (create a task, read it back, byte-compare) before
 * loosening this. TODO in the roadmap.
 */
export function contentEquals(a: string, b: string): boolean {
  return normalizeContent(a) === normalizeContent(b);
}

export function normalizeContent(html: string): string {
  return html.replace(/\r\n/g, '\n').trim();
}

/** Treats null and undefined as the same absent value. */
export function sameOptional(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}
