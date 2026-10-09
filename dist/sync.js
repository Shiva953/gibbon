import { agentCommand } from './commands/agent.js';
import { applyCommand } from './commands/apply.js';
import { importCommand } from './commands/import.js';
import { planCommand } from './commands/plan.js';
import { statusCommand } from './commands/status.js';
export const DEFAULT_FILE = 'bounties.yaml';
/**
 * Registers the sync verbs onto any commander command. The portable unit: it
 * knows only how to get a Runtime, not how credentials or global flags were
 * resolved, so the same file serves `gibbon plan` and a hypothetical
 * `gibwork sync plan` unchanged.
 */
export function registerSync(parent, getRuntime) {
    parent
        .command('plan')
        .description('Preview changes: diff bounties.yaml against live Gibwork state (read-only)')
        .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
        .action(async (opts) => {
        await planCommand(await getRuntime(), { file: opts.file });
    });
    parent
        .command('apply')
        .description('Reconcile Gibwork with bounties.yaml: create, update, and refund as needed')
        .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
        .option('-y, --yes', 'skip the interactive confirmation (for CI)', false)
        .action(async (opts) => {
        await applyCommand(await getRuntime(), { file: opts.file, yes: opts.yes });
    });
    parent
        .command('import')
        .description("Generate bounties.yaml from this wallet's existing live tasks")
        .option('-f, --file <path>', 'path to write the bounties file', DEFAULT_FILE)
        .option('--force', 'overwrite a bounties file that already has entries', false)
        .action(async (opts) => {
        await importCommand(await getRuntime(), { file: opts.file, force: opts.force });
    });
    /* Registered without getRuntime, so it never resolves Solana credentials —
       an agent editing the file must not be able to reach the platform. */
    parent
        .command('agent')
        .description('Rewrite bounties.yaml from a natural-language request (never applies it)')
        .argument('<prompt>', 'what to change, in quotes')
        .option('-f, --file <path>', 'path to the bounties file', DEFAULT_FILE)
        .option('--dry-run', 'show the edit without writing the file', false)
        .option('--model <id>', 'Claude model to use')
        .action(async (prompt, opts) => {
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
        .action(async (opts) => {
        await statusCommand(await getRuntime(), { file: opts.file, dryRun: opts.dryRun });
    });
    return parent;
}
//# sourceMappingURL=sync.js.map