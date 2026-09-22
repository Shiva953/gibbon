import type { TaskDetails, WalletTaskSummary } from '@gibwork/sdk';
import type { BountyEntry, LiveTask, ResolvedEntry } from '../types.js';
import { DEFAULT_MINT } from '../types.js';

/**
 * Renders a whole-token amount as a canonical decimal string. For
 * `minSubmissionAmount`, which the API reports in whole tokens — not for
 * `asset.amount`, which is base units. See formatBaseUnits.
 */
export function formatAmount(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  // Trailing zeros trimmed so "40.00", "40.0" and 40 compare equal.
  return String(Number(n.toFixed(9)));
}

/** Normalizes a decimal string from YAML into the same canonical form. */
export function normalizeAmount(value: string): string {
  return formatAmount(value) ?? value;
}

/**
 * Converts a base-unit amount into a canonical whole-token decimal string.
 *
 * The live API mixes both units on the same object, and declares a string
 * field as a number, so both forms are accepted:
 *
 *   asset.amount        "1000000"  base units, as a string   (decimals: 6)
 *   minSubmissionAmount 1          whole tokens, as a number
 *
 * Returns null when `decimals` is absent rather than guessing a scale; the
 * diff then treats it as "not reported" instead of manufacturing drift.
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
 * Applies defaults once, so hashing, diffing and creating all agree on what an
 * entry means. `minSubmission` defaults to the full amount (a single-winner
 * bounty) because the API requires it and a smaller default would silently
 * let the pot be split in ways the file never asked for.
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
 * Compares two HTML content blobs. Deliberately conservative: only line
 * endings and surrounding whitespace are normalized.
 *
 * Collapsing whitespace between tags would guard against phantom drift if the
 * API re-serializes stored HTML, but over-normalizing silently swallows a real
 * edit, while under-normalizing costs at most one free, unsigned update.
 * Verify against stage before loosening this.
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
