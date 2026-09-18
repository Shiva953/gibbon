import type { Command } from 'commander';
import { agentCommand } from './commands/agent.js';
import { applyCommand } from './commands/apply.js';
import { importCommand } from './commands/import.js';
import { planCommand } from './commands/plan.js';
import { statusCommand } from './commands/status.js';
import type { RuntimeFactory } from './runtime.js';

export const DEFAULT_FILE = 'bounties.yaml';

/**
 * Registers the four sync verbs onto any commander command.
 *
 * This is the portable unit. It knows nothing about how credentials were
 * resolved or how global flags are spelled — only how to get a Runtime.
 *
 *   standalone:  registerSync(program, () => createRuntime(readGlobals()))
 *   embedded:    registerSync(new Command('sync'), createRuntime)
 *
 * so the same file serves `gibwork-sync plan` and a hypothetical
 * `gibwork sync plan` without edits.
 */
export function registerSync(parent: Command, getRuntime: RuntimeFactory): Command {
  parent
    .command('plan')
    .description('Preview changes: diff bounties.yaml against live Gibwork state (read-only)')
    .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
    .action(async (opts: { file: string }) => {
      await planCommand(await getRuntime(), { file: opts.file });
    });

  parent
    .command('apply')
    .description('Reconcile Gibwork with bounties.yaml: create, update, and refund as needed')
    .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
    .option('-y, --yes', 'skip the interactive confirmation (for CI)', false)
    .action(async (opts: { file: string; yes: boolean }) => {
      await applyCommand(await getRuntime(), { file: opts.file, yes: opts.yes });
    });

  parent
    .command('import')
    .description("Generate bounties.yaml from this wallet's existing live tasks")
    .option('-f, --file <path>', 'path to write the bounties file', DEFAULT_FILE)
    .action(async (opts: { file: string }) => {
      await importCommand(await getRuntime(), { file: opts.file });
    });

  /* The one verb that needs no wallet: it reads local files, calls Claude, and
     writes a file. Registered without getRuntime so it never resolves Solana
     credentials — an agent editing the file should not be able to reach the
     platform at all. */
  parent
    .command('agent')
    .description('Rewrite bounties.yaml from a natural-language request (never applies it)')
    .argument('<prompt>', 'what to change, in quotes')
    .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
    .option('--dry-run', 'show the edit without writing the file', false)
    .option('--model <id>', 'Claude model to use')
    .action(async (prompt: string, opts: { file: string; dryRun: boolean; model?: string }) => {
      await agentCommand({
        file: opts.file,
        prompt,
        dryRun: opts.dryRun,
        ...(opts.model ? { model: opts.model } : {}),
      });
    });

  parent
    .command('status')
    .description('Resolve unresolved apply operations against live Gibwork state')
    .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
    .option('--dry-run', 'report without rewriting .gibwork/state.json', false)
    .action(async (opts: { file: string; dryRun: boolean }) => {
      await statusCommand(await getRuntime(), { file: opts.file, dryRun: opts.dryRun });
    });

  return parent;
}
