import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dump, load } from 'js-yaml';
import type { BountyEntry } from '../types.js';
import { CliError, EXIT } from './errors.js';

export class BountyFileError extends CliError {
  override readonly name = 'BountyFileError';
  constructor(message: string) {
    super(message, 'USAGE_ERROR', EXIT.USAGE);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Amounts are decimal strings on purpose. YAML would happily parse `40.00`
 * into the float 40, and float rounding has no place anywhere near an escrow
 * amount, so we require the string form and say so clearly.
 */
function requireDecimalString(value: unknown, field: string, index: number): string {
  if (typeof value === 'number') {
    throw new BountyFileError(
      `Entry #${index + 1}: \`${field}\` must be a quoted string, not a number. ` +
        `Write ${field}: "${value.toFixed(2)}" so the amount is never rounded.`,
    );
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BountyFileError(`Entry #${index + 1}: \`${field}\` is required and must be a string.`);
  }
  if (!/^\d+(\.\d+)?$/.test(value.trim())) {
    throw new BountyFileError(
      `Entry #${index + 1}: \`${field}\` must be a positive decimal amount, got "${value}".`,
    );
  }
  return value.trim();
}

function requireString(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BountyFileError(`Entry #${index + 1}: \`${field}\` is required and must be a string.`);
  }
  return value;
}

function parseEntry(raw: unknown, index: number): BountyEntry {
  if (!isRecord(raw)) {
    throw new BountyFileError(`Entry #${index + 1} is not a mapping.`);
  }

  const tagsRaw = raw['tags'] ?? [];
  if (!Array.isArray(tagsRaw) || tagsRaw.some((t) => typeof t !== 'string')) {
    throw new BountyFileError(`Entry #${index + 1}: \`tags\` must be a list of strings.`);
  }

  const entry: BountyEntry = {
    id: requireString(raw['id'], 'id', index),
    title: requireString(raw['title'], 'title', index),
    content: requireString(raw['content'], 'content', index),
    tags: tagsRaw as string[],
    amount: requireDecimalString(raw['amount'], 'amount', index),
  };

  if (raw['issue'] !== undefined) entry.issue = String(raw['issue']);
  if (raw['mint'] !== undefined) entry.mint = requireString(raw['mint'], 'mint', index);
  if (raw['minSubmission'] !== undefined) {
    entry.minSubmission = requireDecimalString(raw['minSubmission'], 'minSubmission', index);
  }
  if (raw['deadline'] !== undefined) entry.deadline = requireString(raw['deadline'], 'deadline', index);
  if (raw['allowOnlyVerifiedSubmissions'] !== undefined) {
    if (typeof raw['allowOnlyVerifiedSubmissions'] !== 'boolean') {
      throw new BountyFileError(
        `Entry #${index + 1}: \`allowOnlyVerifiedSubmissions\` must be true or false.`,
      );
    }
    entry.allowOnlyVerifiedSubmissions = raw['allowOnlyVerifiedSubmissions'];
  }

  return entry;
}

/** Parses and validates bounties.yaml. An absent file is an error worth saying out loud. */
export function loadBounties(path: string): BountyEntry[] {
  const absolute = resolve(path);
  let raw: string;
  try {
    raw = readFileSync(absolute, 'utf8');
  } catch (cause) {
    if (isRecord(cause) && cause['code'] === 'ENOENT') {
      throw new BountyFileError(
        `No bounty file at ${absolute}.\n` +
          'Create one, or run `gibwork-sync import` to generate it from your live tasks.',
      );
    }
    throw cause;
  }

  return parseBounties(raw, absolute);
}

/** The pure half of loadBounties, so it can be unit tested without the disk. */
export function parseBounties(raw: string, label = 'bounties.yaml'): BountyEntry[] {
  let parsed: unknown;
  try {
    parsed = load(raw);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new BountyFileError(`${label} is not valid YAML: ${reason}`);
  }

  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    throw new BountyFileError(`${label} must contain a top-level list of bounty entries.`);
  }

  const entries = parsed.map((item, index) => parseEntry(item, index));

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new BountyFileError(
        `Duplicate id "${entry.id}" in ${label}. Each entry needs a unique, stable id.`,
      );
    }
    seen.add(entry.id);
  }

  return entries;
}

/** Serializes entries back to YAML. Used by `import`. */
export function dumpBounties(entries: BountyEntry[]): string {
  const header = [
    '# bounties.yaml — the bounties that should exist on Gibwork.',
    '#',
    '# `id` is your own stable key, not the Gibwork UUID. Do not change it once',
    '# applied: gibwork-sync would read that as "refund the old, create a new".',
    '#',
    '# Preview changes with `gibwork-sync plan`, then `gibwork-sync apply`.',
    '',
  ].join('\n');

  const body = entries.length === 0 ? '[]\n' : dump(entries, { lineWidth: 100, noRefs: true });
  return `${header}${body}`;
}

export function saveBounties(path: string, entries: BountyEntry[]): void {
  writeFileSync(resolve(path), dumpBounties(entries), 'utf8');
}
