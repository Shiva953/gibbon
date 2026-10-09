import type { TaskDetails, WalletTaskSummary } from '@gibwork/sdk';
import type { BountyEntry, LiveTask, ResolvedEntry } from '../types.js';
/**
 * Renders a whole-token amount as a canonical decimal string. For
 * `minSubmissionAmount`, which the API reports in whole tokens — not for
 * `asset.amount`, which is base units. See formatBaseUnits.
 */
export declare function formatAmount(value: number | string | null | undefined): string | null;
/** Normalizes a decimal string from YAML into the same canonical form. */
export declare function normalizeAmount(value: string): string;
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
export declare function formatBaseUnits(value: string | number | null | undefined, decimals: number | null | undefined): string | null;
/**
 * Applies defaults once, so hashing, diffing and creating all agree on what an
 * entry means. `minSubmission` defaults to the full amount (a single-winner
 * bounty) because the API requires it and a smaller default would silently
 * let the pot be split in ways the file never asked for.
 */
export declare function resolveEntry(entry: BountyEntry): ResolvedEntry;
/** Adapts the SDK's TaskDetails (plus its list summary) into a LiveTask. */
export declare function toLiveTask(details: TaskDetails, summary?: WalletTaskSummary): LiveTask;
/**
 * Compares two HTML content blobs. Deliberately conservative: only line
 * endings and surrounding whitespace are normalized.
 *
 * Collapsing whitespace between tags would guard against phantom drift if the
 * API re-serializes stored HTML, but over-normalizing silently swallows a real
 * edit, while under-normalizing costs at most one free, unsigned update.
 * Verify against stage before loosening this.
 */
export declare function contentEquals(a: string, b: string): boolean;
export declare function normalizeContent(html: string): string;
/** Treats null and undefined as the same absent value. */
export declare function sameOptional(a: string | null | undefined, b: string | null | undefined): boolean;
//# sourceMappingURL=normalize.d.ts.map