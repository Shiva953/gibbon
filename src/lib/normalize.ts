import type { TaskDetails, WalletTaskSummary } from '@gibwork/sdk';
import type { BountyEntry, LiveTask, ResolvedEntry } from '../types.js';
import { DEFAULT_MINT } from '../types.js';

/**
 * Renders a whole-token amount as a canonical decimal string.
 *
 * Used for `minSubmissionAmount`, which the API reports in WHOLE TOKENS as a
 * number (1 means 1.00 USDC). Not for `asset.amount` — see formatBaseUnits.
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
 * Converts a base-unit amount into a canonical whole-token decimal string.
 *
 * Verified against the live API, which is inconsistent between two fields of
 * the same object:
 *
 *   asset.amount        "1000000"  base units, as a string   (decimals: 6)
 *   minSubmissionAmount 1          whole tokens, as a number
 *
 * The SDK's typedef declares `asset.amount: number`; the wire format is a
 * string, so both are accepted here.
 *
 * Returns null when `decimals` is absent rather than guessing a scale —
 * an unknown value is treated as "not reported" and skipped by the diff,
 * which is preferable to manufacturing drift a maintainer cannot act on.
 */
export function formatBaseUnits(
  value: string | number | null | undefined,
  decimals: number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0) return null;

  const raw = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(raw)) return null;

  return formatAmount(raw / 10 ** decimals);
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
    amount: formatBaseUnits(details.asset?.amount, details.asset?.decimals) ?? '0',
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
