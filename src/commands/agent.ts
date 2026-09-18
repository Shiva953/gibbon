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
 * Deliberately the one command that needs no wallet: it reads local files and
 * calls Claude, then writes a file. Nothing here contacts Gibwork, signs
 * anything, or spends money — `plan` and `apply` remain the only path to the
 * platform, and both still require a human.
 *
 * The model's output is never trusted. It is re-parsed with this project's own
 * loader before the file is written, so an invalid edit fails here rather than
 * at apply time.
 */
export async function agentCommand(options: AgentOptions): Promise<void> {
  if (!options.prompt.trim()) {
    throw new CliError('Describe the change you want, in quotes.', 'USAGE_ERROR', EXIT.USAGE);
  }

  // Fail before doing any work if Claude is unreachable.
  assertAnthropicCredentials();

  const currentYaml = readIfPresent(options.file);

  // Parsing the current file is best-effort: the request may well be "fix it".
  let entries: ReturnType<typeof parseBounties> = [];
  try {
    entries = parseBounties(currentYaml, options.file);
  } catch {
    process.stdout.write(`\n(${options.file} does not currently parse; asking for a repair)\n`);
  }

  // Live ids come from local state — no network call, no credentials.
  const liveIds = Object.keys(loadState().tasks);

  process.stdout.write('\nAsking Claude to edit the file...\n');
  const result = await requestEdit({
    prompt: options.prompt,
    currentYaml,
    entries,
    liveIds,
    ...(options.model ? { model: options.model } : {}),
  });

  // Validate with our own loader before anything reaches disk.
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

  // The reason this command exists: catching impossible edits at authoring
  // time rather than after a network round trip.
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
