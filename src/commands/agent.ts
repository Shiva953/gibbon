import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CliError, EXIT } from '../lib/errors.js';
import { assertAnthropicCredentials, requestEdit } from '../lib/llm.js';
import { diffLines } from '../lib/render.js';
import { loadState } from '../lib/state.js';
import { BountyFileError, parseBounties } from '../lib/yaml.js';

export interface AgentOptions {
  file: string;
  prompt: string;
  dryRun?: boolean;
  model?: string;
}

function readIfPresent(path: string): string {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch {
    return '[]\n';
  }
}

/**
 * Rewrites bounties.yaml from a natural-language request.
 *
 * The one command that needs no wallet: it reads local files, calls Claude and
 * writes a file — it never contacts Gibwork or signs anything. The model's
 * output is re-parsed with our own loader before it reaches disk.
 */
export async function agentCommand(options: AgentOptions): Promise<void> {
  if (!options.prompt.trim()) {
    throw new CliError('Describe the change you want, in quotes.', 'USAGE_ERROR', EXIT.USAGE);
  }

  assertAnthropicCredentials();

  const currentYaml = readIfPresent(options.file);

  // Best-effort: the request may well be "fix the broken file".
  let entries: ReturnType<typeof parseBounties> = [];
  try {
    entries = parseBounties(currentYaml, options.file);
  } catch {
    process.stdout.write(`\n(${options.file} does not currently parse; asking for a repair)\n`);
  }

  // From local state, so no network call and no credentials.
  const liveIds = Object.keys(loadState().tasks);

  process.stdout.write('\nAsking Claude to edit the file...\n');
  const result = await requestEdit({
    prompt: options.prompt,
    currentYaml,
    entries,
    liveIds,
    ...(options.model ? { model: options.model } : {}),
  });

  try {
    parseBounties(result.yaml, 'the proposed file');
  } catch (error) {
    const reason = error instanceof BountyFileError ? error.message : String(error);
    throw new CliError(
      `The proposed edit is not a valid bounty file, so nothing was written.\n  ${reason}`,
      'USAGE_ERROR',
      EXIT.USAGE,
    );
  }

  const diff = diffLines(currentYaml.trimEnd(), result.yaml.trimEnd());
  const changed = diff.filter((line) => line.startsWith('+') || line.startsWith('-'));

  process.stdout.write('\n');
  if (changed.length === 0) {
    process.stdout.write('No change to the file.\n');
  } else {
    for (const line of diff) process.stdout.write(`${line}\n`);
  }

  if (result.changes.length > 0) {
    process.stdout.write('\nChanges:\n');
    for (const change of result.changes) {
      if (change.action === 'unchanged') continue;
      process.stdout.write(`  ${change.action.padEnd(9)} ${change.id.padEnd(16)} ${change.detail}\n`);
    }
  }

  if (result.assumptions.length > 0) {
    process.stdout.write('\nAssumptions:\n');
    for (const assumption of result.assumptions) process.stdout.write(`  · ${assumption}\n`);
  }

  if (result.refused.length > 0) {
    process.stdout.write('\nNot applied:\n');
    for (const refusal of result.refused) {
      process.stdout.write(`  ! ${refusal.request}\n`);
      process.stdout.write(`    ${refusal.reason}\n`);
    }
  }

  if (options.dryRun) {
    process.stdout.write(`\n--dry-run: ${options.file} was not modified.\n\n`);
    return;
  }

  if (changed.length > 0) {
    writeFileSync(resolve(options.file), result.yaml.endsWith('\n') ? result.yaml : `${result.yaml}\n`);
    process.stdout.write(`\nWrote ${options.file}. Review it, then run \`gibwork-sync plan\`.\n\n`);
  } else {
    process.stdout.write('\n');
  }
}
